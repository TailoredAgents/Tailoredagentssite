import {resolveDashboardConfiguration} from '@/lib/dashboard/config';

export const scopeLabels = {
 'operations:read': 'Read business records, calendar, reporting and integration status',
 'operations:write': 'Prepare changes to business records for your review',
 'conversations:read': 'Read permitted customer conversations and call history',
 'conversations:send': 'Prepare text messages for your approval (standard messaging charges apply)',
 'personal:read': 'Read your private goals',
 'personal:write': 'Prepare changes to your private goals',
} as const;
export type AssistantScope = keyof typeof scopeLabels;
export const isWriteScope=(scope:string)=>scope.endsWith(':write')||scope.endsWith(':send');
export const scopes = Object.keys(scopeLabels) as AssistantScope[];
export class AssistantError extends Error {
 constructor(public code:string,message:string,public status=400){super(message);}
}
export class AssistantOutcomeError extends Error {
 constructor(public outcome:'failed'|'outcome_unknown',public result:unknown){super('Check the saved message status before taking further action.');}
}
export function assistantOrigin(){
 const url=new URL(resolveDashboardConfiguration().baseUrl);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
  (url.protocol!=='https:' && !(process.env.NODE_ENV!=='production' && ['localhost','127.0.0.1'].includes(url.hostname))))
  throw new AssistantError('unavailable','Assistant origin is not configured.',503);
 return url.origin;
}
export const resourceUri=()=>`${assistantOrigin()}/api/mcp/operations`;
export function parseScopes(value:string|undefined){
 const requested=value===undefined?['operations:read']:value.split(/\s+/).filter(Boolean);
 if(!requested.length||requested.some(s=>!scopes.includes(s as AssistantScope)))throw new AssistantError('invalid_scope','Choose supported Operations permissions.');
 return [...new Set(requested)] as AssistantScope[];
}
export function validRedirect(value:string){
 // eslint-disable-next-line no-control-regex -- Reject control characters in callback URLs.
 try{const u=new URL(value);return !/[\u0000-\u0020\u007f]/.test(value)&&!u.username&&!u.password&&!value.includes('#')&&
  (u.protocol==='https:' || (u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)));}catch{return false;}
}
export const privateHeaders={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export const json=(value:unknown,status=200)=>Response.json(value,{status,headers:privateHeaders});
export function failure(error:unknown){return error instanceof AssistantError?json({error:error.code,error_description:error.message},error.status):json({error:'temporarily_unavailable',error_description:'Operations is temporarily unavailable. Try again later.'},503);}
