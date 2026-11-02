import 'server-only';
import {AssistantError,type AssistantScope} from './config';
import {refreshPrincipal,type Principal} from './oauth';
import {assistantExecution} from './execution-context';
export function requireScopes(p:Principal,required:AssistantScope[],write=false){
 if(process.env.OPERATIONS_ASSISTANT_ENABLED==='false')throw new AssistantError('disabled','Operations access is paused.',503);
 if(required.some(s=>!p.scopes.includes(s)))throw new AssistantError('insufficient_scope','Reconnect and select the permissions needed for this tool.',403);
 if(write&&(p.writesPaused||p.context.role==='viewer'||process.env.OPERATIONS_ASSISTANT_WRITES_ENABLED==='false'))throw new AssistantError('writes_paused','Changes are paused or your account is read-only.',403);
}
export async function asAssistant<T>(p:Principal,required:AssistantScope[],write:boolean,run:(fresh:Principal)=>Promise<T>){
 const fresh=await refreshPrincipal(p);requireScopes(fresh,required,write);
 return assistantExecution.run({userId:fresh.context.user.id,sessionId:fresh.sessionId,grantId:fresh.grantId},()=>run(fresh));
}
