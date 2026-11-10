import {z} from 'zod';
import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {AssistantError,json} from '@/lib/assistant/config';
import {body,checkOrigin,endpoint} from '@/lib/assistant/http';
import {readKnowledge,controlKnowledge} from '@/lib/assistant/knowledge';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
async function identity(){const c=await getOptionalDashboardContext();if(!c)throw new AssistantError('unauthorized','Sign in to use company knowledge.',401);return c;}
export async function GET(_request:Request,context:Context){return endpoint(async()=>json(await readKnowledge(await identity(),z.uuid().parse((await context.params).id))));}
export async function POST(request:Request,context:Context){return endpoint(async()=>{checkOrigin(request,true);await controlKnowledge(await identity(),z.uuid().parse((await context.params).id),await body(request));return json({saved:true});});}
