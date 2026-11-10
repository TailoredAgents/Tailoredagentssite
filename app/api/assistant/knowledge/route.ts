import {z} from 'zod';
import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {AssistantError,json} from '@/lib/assistant/config';
import {body,checkOrigin,endpoint} from '@/lib/assistant/http';
import {listKnowledge,draftKnowledge,knowledgeDraftKey} from '@/lib/assistant/knowledge';
import {knowledgeDraftSchema} from '@/lib/assistant/knowledge-contract';
import {cardRateLimit} from '@/lib/smart-cards/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function identity(){const c=await getOptionalDashboardContext();if(!c)throw new AssistantError('unauthorized','Sign in to use company knowledge.',401);return c;}
export async function GET(request:Request){return endpoint(async()=>{const c=await identity(),params=new URL(request.url).searchParams,query=z.string().max(200).parse(params.get('query')??'');const result=await listKnowledge(c,query,params.get('mine')==='1');const employees=(await getDatabasePool().query('SELECT u.id,u.name FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id WHERE m.workspace_id=$1 AND m.status=\'active\' ORDER BY u.name',[c.workspace.id])).rows;return json({...result,employees,canCreate:c.role!=='viewer'});});}
export async function POST(request:Request){return endpoint(async()=>{checkOrigin(request,true);const c=await identity();await cardRateLimit('assistant:knowledge',c.user.id,30,3600);const key=z.uuid().parse(request.headers.get('idempotency-key')),input=knowledgeDraftSchema.parse(await body(request));return json({entry:await draftKnowledge(c,input,knowledgeDraftKey(key,input))},201);});}
