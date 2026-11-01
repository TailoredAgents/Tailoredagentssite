import 'server-only';
import { CARD_ORIGIN } from './types';
import { getDatabasePool } from '@/lib/dashboard/db';
export class CardError extends Error { constructor(message:string,public status=400){super(message);} }
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store'}});}
export async function readCardRequest(request:Request,limit=24000) {
  const origin=request.headers.get('origin');
  const local=process.env.NODE_ENV!=='production' && (origin===new URL(request.url).origin || origin===process.env.NEXT_PUBLIC_SITE_URL);
  if(origin!==CARD_ORIGIN && !local)throw new CardError('Please open this form on the Tailored Agents website.',403);
  if(!request.headers.get('content-type')?.includes('application/json'))throw new CardError('Use the website form.',415);
  if(Number(request.headers.get('content-length')||0)>limit)throw new CardError('Your message is too long.',413);
  const reader=request.body?.getReader();if(!reader)throw new CardError('No message received.');
  let size=0,raw='';const decoder=new TextDecoder();
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel();throw new CardError('Your message is too long.',413);}raw+=decoder.decode(part.value,{stream:true});}}finally{reader.releaseLock();}
  try{return JSON.parse(raw+decoder.decode());}catch{throw new CardError('Please check your message.');}
}
export async function cardRateLimit(scope:string,key:string,limit:number,seconds:number){
  const result=await getDatabasePool().query<{count:number}>(`INSERT INTO request_rate_limits(scope,key_hash,count,window_started_at,expires_at) VALUES($1,$2,1,now(),now()+make_interval(secs=>$3)) ON CONFLICT(scope,key_hash) DO UPDATE SET count=CASE WHEN request_rate_limits.expires_at<=now() THEN 1 ELSE request_rate_limits.count+1 END,window_started_at=CASE WHEN request_rate_limits.expires_at<=now() THEN now() ELSE request_rate_limits.window_started_at END,expires_at=CASE WHEN request_rate_limits.expires_at<=now() THEN now()+make_interval(secs=>$3) ELSE request_rate_limits.expires_at END RETURNING count`,[scope,key,seconds]);
  if(result.rows[0].count>limit)throw new CardError('Please wait a little before trying again.',429);
}
export function cardError(error:unknown){return json({message:error instanceof CardError?error.message:'This is temporarily unavailable. Please call or email us using the contact buttons.'},error instanceof CardError?error.status:503);}
