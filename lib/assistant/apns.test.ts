import {EventEmitter} from 'node:events';
import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const stub=vi.hoisted(()=>({connect:vi.fn()}));
vi.mock('node:http2',async original=>({...await original<typeof import('node:http2')>(),connect:stub.connect}));
import {sendPush} from './apns';
beforeEach(()=>{
 const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 vi.stubEnv('ASSISTANT_PUSH_ENABLED','true');vi.stubEnv('ASSISTANT_APNS_TEAM_ID','ABCDEFGHIJ');vi.stubEnv('ASSISTANT_APNS_KEY_ID','1234567890');vi.stubEnv('ASSISTANT_APNS_PRIVATE_KEY',pair.privateKey.export({type:'pkcs8',format:'pem'}).toString());vi.stubEnv('ASSISTANT_APNS_ENVIRONMENT','development');stub.connect.mockReset();
});
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
const input=()=>({token:'a'.repeat(64),environment:'development' as const,id:randomUUID(),expiresAt:new Date(Date.now()+600000),payload:{aps:{alert:'Generic update'}}});
function transport(status:number,reason?:string,wrongId=false){
 const client=Object.assign(new EventEmitter(),{destroy:vi.fn(),request:vi.fn()});
 client.request.mockImplementation(headers=>{
  const stream=Object.assign(new EventEmitter(),{setEncoding:vi.fn(),end:vi.fn()});
  stream.end.mockImplementation(()=>queueMicrotask(()=>{stream.emit('response',{':status':status,'apns-id':wrongId?randomUUID():headers['apns-id']});if(reason)stream.emit('data',JSON.stringify({reason}));stream.emit('end');}));return stream;
 });
 stub.connect.mockImplementation(()=>{queueMicrotask(()=>client.emit('connect'));return client;});return client;
}
it('uses the fixed Apple host, topic and alert headers, and confirms the response identity',async()=>{
 const client=transport(200),v=input();expect(await sendPush(v)).toEqual({status:'accepted'});expect(stub.connect.mock.calls[0][0]).toBe('https://api.sandbox.push.apple.com');expect(client.request.mock.calls[0][0]).toMatchObject({'apns-id':v.id,'apns-topic':'com.tailoredagents.workspace','apns-push-type':'alert',':path':'/3/device/'+v.token});expect(client.destroy).toHaveBeenCalledOnce();
 transport(200,undefined,true);expect((await sendPush(input())).status).toBe('unknown');
});
it.each([[410,'Unregistered','failed',true],[400,'BadDeviceToken','failed',true],[403,'InvalidProviderToken','failed',false],[503,'ServiceUnavailable','unknown',false]])('classifies Apple response %s without automatic retry',async(status,reason,outcome,invalid)=>{
 transport(status as number,reason as string);expect(await sendPush(input())).toMatchObject({status:outcome,invalidDevice:invalid});expect(stub.connect).toHaveBeenCalledOnce();
});
it('does not connect with mismatched environments or oversized content',async()=>{
 expect((await sendPush({...input(),environment:'production'})).status).toBe('failed');await expect(sendPush({...input(),payload:{text:'x'.repeat(5000)}})).rejects.toThrow('oversized_push');expect(stub.connect).not.toHaveBeenCalled();
});
it('keeps a timed-out submission uncertain',async()=>{
 vi.useFakeTimers();const client=transport(200);client.request.mockImplementation(()=>Object.assign(new EventEmitter(),{setEncoding:vi.fn(),end:vi.fn()}));const result=sendPush(input());await vi.advanceTimersByTimeAsync(11000);expect(await result).toMatchObject({status:'unknown',reason:'push_timeout'});expect(stub.connect).toHaveBeenCalledOnce();
});
