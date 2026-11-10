import 'server-only';
import {createPrivateKey,sign,createHash} from 'node:crypto';
import {connect,sensitiveHeaders} from 'node:http2';
export type PushEnvironment='development'|'production';
export function apnsConfiguration(){
 const team=process.env.ASSISTANT_APNS_TEAM_ID??'',keyId=process.env.ASSISTANT_APNS_KEY_ID??'',key=(process.env.ASSISTANT_APNS_PRIVATE_KEY??'').replaceAll('\\n','\n');
 const environment=process.env.ASSISTANT_APNS_ENVIRONMENT;
 return {ready:process.env.ASSISTANT_PUSH_ENABLED==='true'&&/^[A-Z0-9]{10}$/.test(team)&&/^[A-Z0-9]{10}$/.test(keyId)&&key.includes('BEGIN PRIVATE KEY')&&['development','production'].includes(environment??''),team,keyId,key,environment,topic:'com.tailoredagents.workspace'};
}
let cached:{key:string;issued:number;value:string}|undefined;
export function apnsAuthorization(config:ReturnType<typeof apnsConfiguration>,now=Date.now()){
 const key=createHash('sha256').update(config.team+config.keyId+config.key+config.environment).digest('hex'),issued=Math.floor(now/1000);
 if(cached?.key===key&&issued-cached.issued>=0&&issued-cached.issued<3000)return cached.value;
 const header=Buffer.from(JSON.stringify({alg:'ES256',kid:config.keyId})).toString('base64url'),claims=Buffer.from(JSON.stringify({iss:config.team,iat:issued})).toString('base64url');
 const input=header+'.'+claims,privateKey=createPrivateKey(config.key);
 if(privateKey.asymmetricKeyType!=='ec'||privateKey.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('invalid_apns_key');
 const value=input+'.'+sign('sha256',Buffer.from(input),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');cached={key,issued,value};return value;
}
export type PushResult={status:'accepted'|'failed'|'unknown';reason?:string;invalidDevice?:boolean};
/** Fixed Apple hosts, bounded payload/time, no retry after an uncertain submission. */
export async function sendPush(input:{token:string;environment:PushEnvironment;id:string;expiresAt:Date;payload:Record<string,unknown>;collapseId?:string}):Promise<PushResult>{
 const config=apnsConfiguration();if(!config.ready||config.environment!==input.environment)return {status:'failed',reason:'push_not_configured'};
 if(!/^[a-f0-9]{32,512}$/.test(input.token)||!/^[0-9a-f-]{36}$/.test(input.id)||input.collapseId&&Buffer.byteLength(input.collapseId)>64)throw Error('invalid_push_request');
 const body=JSON.stringify(input.payload);if(Buffer.byteLength(body)>4096)throw Error('oversized_push');
 let authorization:string;try{authorization=apnsAuthorization(config);}catch{return {status:'failed',reason:'push_credentials_invalid'};}
 const host=input.environment==='production'?'https://api.push.apple.com':'https://api.sandbox.push.apple.com';
 return new Promise(resolve=>{
  const client=connect(host,{minVersion:'TLSv1.2'});let finished=false,submitted=false,bytes=0,status=0,output='',responseId='';
  const done=(result:PushResult)=>{if(finished)return;finished=true;clearTimeout(timer);client.destroy();resolve(result);};
  const timer=setTimeout(()=>done({status:submitted?'unknown':'failed',reason:'push_timeout'}),10000);
  client.on('error',()=>done({status:submitted?'unknown':'failed',reason:'push_connection_failed'}));
  client.on('connect',()=>{
   if(finished)return;
   try{const request=client.request({':method':'POST',':path':'/3/device/'+input.token,authorization:'bearer '+authorization,'apns-topic':config.topic,'apns-push-type':'alert','apns-id':input.id,'apns-expiration':String(Math.max(0,Math.min(Math.floor(input.expiresAt.getTime()/1000),Math.floor(Date.now()/1000)+86400))),'apns-priority':'10',...(input.collapseId?{'apns-collapse-id':input.collapseId}:{}),[sensitiveHeaders]:['authorization',':path']});
   request.on('response',headers=>{status=Number(headers[':status']);responseId=String(headers['apns-id']??'');});request.setEncoding('utf8');
   request.on('data',(data:string)=>{bytes+=Buffer.byteLength(data);if(bytes>8192){done({status:'unknown',reason:'push_response_invalid'});return;}output+=data;});
   request.on('error',()=>done({status:'unknown',reason:'push_outcome_unknown'}));
   request.on('end',()=>{if(status===200){done(responseId===input.id?{status:'accepted'}:{status:'unknown',reason:'push_response_identity'});return;}let reason='push_rejected';try{const value=JSON.parse(output).reason;if(typeof value==='string'&&/^[A-Za-z]{1,80}$/.test(value))reason=value;}catch{}done({status:status>=400&&status<500?'failed':'unknown',reason,invalidDevice:status===410||status===400&&['BadDeviceToken','DeviceTokenNotForTopic'].includes(reason)});});
   submitted=true;request.end(body);}catch{done({status:submitted?'unknown':'failed',reason:'push_request_failed'});}
  });
 });
}
