import {z} from 'zod';
import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {AssistantError,json,privateHeaders} from '@/lib/assistant/config';
import {body,checkOrigin,endpoint} from '@/lib/assistant/http';
import {controlDocument,documentDownload,readDocument} from '@/lib/assistant/documents';
import {documentControlSchema} from '@/lib/assistant/document-contract';
import {cardRateLimit} from '@/lib/smart-cards/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Params={params:Promise<{id:string}>};
async function identity(){const c=await getOptionalDashboardContext();if(!c)throw new AssistantError('unauthorized','Sign in to open this document.',401);return c;}
export async function GET(request:Request,{params}:Params){return endpoint(async()=>{
 const c=await identity(),id=z.uuid().parse((await params).id),url=new URL(request.url);await cardRateLimit('assistant:document-read',c.user.id,60,60);
 if(url.searchParams.get('download')==='1'){
  const file=await documentDownload(c,id),ascii=file.document.name.replace(/[^a-zA-Z0-9._ -]/g,'_');
  return new Response(new Uint8Array(file.bytes),{headers:{...privateHeaders,'Content-Type':file.mime,'Content-Length':String(file.bytes.length),'Content-Disposition':`attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.document.name).replaceAll("'",'%27')}`,'Content-Security-Policy':"sandbox; default-src 'none'"}});
 }
 const offset=z.coerce.number().int().min(0).max(12000).parse(url.searchParams.get('offset')??0);const query=z.string().max(200).parse(url.searchParams.get('query')??'');const data=await readDocument(c,id,{offset,query});
 const employees=data.document.owned?(await getDatabasePool().query(`SELECT u.id,u.name FROM workspace_memberships m JOIN "user" u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.status='active' AND u.id<>$2 ORDER BY u.name LIMIT 100`,[c.workspace.id,c.user.id])).rows:[];
 return json({...data,employees});
});}
export async function POST(request:Request,{params}:Params){return endpoint(async()=>{
 checkOrigin(request,true);const c=await identity(),id=z.uuid().parse((await params).id),input=documentControlSchema.parse(await body(request,10000));await cardRateLimit('assistant:document-control',c.user.id,20,60);await controlDocument(c,id,input);return json({ok:true});
});}
