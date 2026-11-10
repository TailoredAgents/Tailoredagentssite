import {z} from 'zod';
import {headers} from 'next/headers';
import {getDashboardAuth} from '@/lib/dashboard/auth';
import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {nativePrincipal} from '@/lib/assistant/chat-store';
import {body,checkOrigin,endpoint} from '@/lib/assistant/http';
import {AssistantError,json} from '@/lib/assistant/config';
import {listRoutines,saveRoutine,setRoutineEnabled} from '@/lib/assistant/routines';
import {routineSchema} from '@/lib/assistant/routine-contract';
import {cardRateLimit} from '@/lib/smart-cards/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function identity(){const c=await getOptionalDashboardContext(),session=await getDashboardAuth()?.api.getSession({headers:await headers()});if(!c||!session||session.user.id!==c.user.id)throw new AssistantError('unauthorized','Sign in to manage your routines.',401);return nativePrincipal(c,session.session.id);}
export async function GET(){return endpoint(async()=>{const p=await identity();return json({...await listRoutines(p),canEdit:p.scopes.includes('routines:write')&&!p.writesPaused&&p.context.role!=='viewer',background:p.authority==='background',expiresAt:p.expiresAt,proactiveAvailable:process.env.ASSISTANT_PROACTIVE_ENABLED!=='false'});});}
export async function POST(request:Request){return endpoint(async()=>{checkOrigin(request,true);const p=await identity();await cardRateLimit('assistant:routines',p.context.user.id,30,3600);const value=z.discriminatedUnion('operation',[z.object({operation:z.literal('save'),routine:routineSchema}).strict(),z.object({operation:z.literal('enabled'),id:z.uuid(),revision:z.number().int().positive(),enabled:z.boolean()}).strict()]).parse(await body(request));const result=value.operation==='save'?await saveRoutine(p,value.routine):await setRoutineEnabled(p,value.id,value.revision,value.enabled);return json(result);});}
