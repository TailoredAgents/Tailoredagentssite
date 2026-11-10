import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {AssistantError} from './config';
import {documentRecord,documentURL,recordDocumentUse} from './documents';
import {knowledgeDraftSchema,type KnowledgeDraft,type KnowledgeSummary,type KnowledgeDetail,knowledgeControlSchema} from './knowledge-contract';
import {knowledgeVisible,invalidateKnowledge,refreshKnowledgeRetention} from './knowledge-lifecycle';
type DB=Pick<PoolClient,'query'>;
const owner=(c:DashboardContext)=>[c.workspace.id,c.user.id];
const unavailable=()=>new AssistantError('knowledge_unavailable','This knowledge entry is unavailable or no longer shared with you.',404);
const columns="k.*,k.effective_on::text effective_date,k.review_on::text review_date";
export const knowledgeURL=(id:string)=>'/dashboard/assistant/knowledge/'+id;
async function active(c:DashboardContext,db:DB=getDatabasePool(),write=false){
 if(process.env.ASSISTANT_KNOWLEDGE_ENABLED==='false')throw new AssistantError('knowledge_disabled','Company knowledge is temporarily unavailable.',503);
 const r=(await db.query("SELECT m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active'",owner(c))).rows[0];
 if(!r)throw unavailable();if(write&&r.role==='viewer')throw new AssistantError('read_only','Your account can read shared knowledge but cannot publish it.',403);return r.role as string;
}
type Row=Record<string,unknown>&{id:string;user_id:string;source_refs:{id:string;chunk:string;name:string;hash:string;location:string}[];source_ids:string[];shared_with:string[]};
function summary(c:DashboardContext,k:Row,conflicts=0):KnowledgeSummary{return {id:k.id,seriesId:String(k.series_id),version:Number(k.version),revision:Number(k.revision),title:String(k.title),topic:String(k.topic),status:String(k.status),audience:String(k.audience),sharedWith:k.user_id===c.user.id?k.shared_with:[],effectiveOn:String(k.effective_date),reviewOn:String(k.review_date),stale:String(k.review_date)<new Date().toISOString().slice(0,10),conflicts,owned:k.user_id===c.user.id,canPublish:k.user_id===c.user.id&&c.role!=='viewer'&&k.status==='draft',url:knowledgeURL(k.id),excerpt:String(k.content).slice(0,500)};}
async function sourcesAccessible(c:DashboardContext,k:Row,db:DB){for(const id of k.source_ids){const d=await documentRecord(c,id,db);if(d.status!=='ready')throw unavailable();}}
export async function listKnowledge(c:DashboardContext,query='',mine=false){
 await active(c);const db=getDatabasePool();const rows=(await db.query<Row>(`SELECT ${columns} FROM assistant_knowledge k WHERE ${mine?"k.workspace_id=$1 AND k.user_id=$2":knowledgeVisible} AND ($3='' OR k.search@@plainto_tsquery('simple',$3)) ORDER BY k.created_at DESC,k.id LIMIT 51`,[...owner(c),query])).rows;
 const items:KnowledgeSummary[]=[];for(const k of rows.slice(0,50)){try{await sourcesAccessible(c,k,db);items.push(summary(c,k));}catch(e){if(!(e instanceof AssistantError&&e.status===404))throw e;}}
 return {items,hasMore:rows.length>50,note:'Published guidance is explicitly approved by its author. Check review dates and read the full source before relying on it. Private memories stay separate.'};
}
export async function readKnowledge(c:DashboardContext,id:string,turnId?:string):Promise<KnowledgeDetail>{
 await active(c);const db=getDatabasePool(),k=(await db.query<Row>(`SELECT ${columns},u.name publisher FROM assistant_knowledge k LEFT JOIN "user" u ON u.id=k.published_by WHERE k.id=$3 AND ((${knowledgeVisible}) OR (k.workspace_id=$1 AND k.user_id=$2))`,[...owner(c),id])).rows[0];
 if(!k)throw unavailable();await sourcesAccessible(c,k,db);
 const peers=(await db.query<Row>(`SELECT ${columns} FROM assistant_knowledge k WHERE ${knowledgeVisible} AND k.topic=$3 AND k.series_id<>$4 LIMIT 20`,[...owner(c),k.topic,k.series_id])).rows;
 let conflicts=0;for(const peer of peers){try{await sourcesAccessible(c,peer,db);conflicts++;}catch(e){if(!(e instanceof AssistantError&&e.status===404))throw e;}}
 if(turnId){if(k.status!=='published'||String(k.effective_date)>new Date().toISOString().slice(0,10))throw new AssistantError('knowledge_draft','Only effective published guidance can be used as company knowledge.',409);
  for(const source of k.source_ids)await recordDocumentUse(c,source,turnId);
  const used=await db.query(`INSERT INTO assistant_knowledge_uses(knowledge_id,turn_id,revision) SELECT $1,t.id,$2 FROM assistant_chat_turns t JOIN assistant_chat_threads thread ON thread.id=t.thread_id WHERE t.id=$3 AND thread.workspace_id=$4 AND thread.user_id=$5 ON CONFLICT(knowledge_id,turn_id) DO UPDATE SET revision=EXCLUDED.revision RETURNING knowledge_id`,[id,k.revision,turnId,...owner(c)]);if(!used.rowCount)throw unavailable();
 }
 return {...summary(c,k,conflicts),content:String(k.content),provenance:String(k.provenance),publisher:k.publisher as string|null,sources:k.source_refs.map(s=>({...s,url:documentURL(s.id)+'#'+s.chunk}))};
}
export async function draftKnowledge(c:DashboardContext,raw:KnowledgeDraft,requestKey:string){
 const v=knowledgeDraftSchema.parse(raw),db=await getDatabasePool().connect();
 try{await db.query('BEGIN');await active(c,db,true);await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[c.workspace.id+':assistant-knowledge']);
  const prior=(await db.query<Row>(`SELECT ${columns} FROM assistant_knowledge k WHERE workspace_id=$1 AND user_id=$2 AND request_key=$3`,[...owner(c),requestKey])).rows[0];if(prior){await db.query('COMMIT');return summary(c,prior);}
  if(Number((await db.query('SELECT count(*) n FROM assistant_knowledge WHERE workspace_id=$1',[c.workspace.id])).rows[0].n)>=1000)throw new AssistantError('knowledge_limit','The company knowledge limit is 1,000 saved versions. Archive unused guidance and ask an administrator to review retention.',409);
  let series=randomUUID(),version=1;
  if(v.replaces){const parent=(await db.query<Row>('SELECT * FROM assistant_knowledge WHERE id=$1 AND workspace_id=$2 AND user_id=$3',[v.replaces,...owner(c)])).rows[0];if(!parent)throw unavailable();series=parent.series_id as `${string}-${string}-${string}-${string}-${string}`;version=Number((await db.query('SELECT max(version) n FROM assistant_knowledge WHERE series_id=$1',[series])).rows[0].n)+1;}
  const refs=[];for(const source of v.sources){const d=await documentRecord(c,source.id,db),chunk=(await db.query('SELECT location FROM assistant_document_chunks WHERE document_id=$1 AND key=$2',[source.id,source.chunk])).rows[0];if(d.status!=='ready'||!chunk)throw unavailable();refs.push({...source,name:d.name,hash:d.content_hash,location:chunk.location});}
  const k=(await db.query<Row>(`INSERT INTO assistant_knowledge(id,workspace_id,user_id,series_id,version,request_key,title,topic,content,provenance,effective_on,review_on,source_ids,source_refs) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb) RETURNING *,effective_on::text effective_date,review_on::text review_date`,[randomUUID(),...owner(c),series,version,requestKey,v.title,v.topic.toLowerCase().replace(/\s+/g,' '),v.content,v.provenance,v.effectiveOn,v.reviewOn,[...new Set(v.sources.map(s=>s.id))],JSON.stringify(refs)])).rows[0];await db.query('COMMIT');return summary(c,k);
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export function knowledgeDraftKey(turnId:string,input:KnowledgeDraft){return 'draft:'+turnId+':'+createHash('sha256').update(JSON.stringify(input)).digest('hex');}
export async function controlKnowledge(c:DashboardContext,id:string,raw:unknown){
 const v=knowledgeControlSchema.parse(raw),db=await getDatabasePool().connect();try{await db.query('BEGIN');await active(c,db,true);await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[c.workspace.id+':assistant-knowledge']);
  const k=(await db.query<Row>(`SELECT ${columns} FROM assistant_knowledge k WHERE id=$1 AND workspace_id=$2 AND user_id=$3 FOR UPDATE`,[id,...owner(c)])).rows[0];if(!k)throw unavailable();if(Number(k.revision)!==v.revision)throw new AssistantError('stale_knowledge','This entry changed. Refresh and review it again.',409);
  if(v.operation==='publish'){
   if(k.status!=='draft')throw new AssistantError('knowledge_published','Create a new version to correct published guidance.',409);
   const today=new Date().toISOString().slice(0,10);if(String(k.effective_date)>today||String(k.review_date)<today)throw new AssistantError('knowledge_dates','Publish guidance effective today or earlier, with a review date today or later. Create a corrected version if needed.',409);
   const employees=[...new Set(v.employees)];if(v.audience==='employees'&&!employees.length)throw new AssistantError('knowledge_audience','Choose at least one employee.');
   const members=await db.query("SELECT user_id FROM workspace_memberships WHERE workspace_id=$1 AND user_id=ANY($2::text[]) AND status='active'",[c.workspace.id,employees]);if(members.rowCount!==employees.length)throw new AssistantError('knowledge_audience','Choose current employees in this workspace.');
   // Lock every ancestor before publication; source owners can withdraw them later.
   const sources=(await db.query(`WITH RECURSIVE sources AS(SELECT id,source_ids FROM assistant_documents WHERE id=ANY($1::uuid[]) UNION SELECT d.id,d.source_ids FROM assistant_documents d JOIN sources s ON d.id=ANY(s.source_ids)) SELECT d.* FROM assistant_documents d JOIN sources s ON s.id=d.id ORDER BY d.id FOR UPDATE OF d`,[k.source_ids])).rows;
   for(const source of sources){await documentRecord(c,source.id,db);if(source.status!=='ready'||source.knowledge_ids.length)throw new AssistantError('knowledge_source','Use original source documents, not results derived from another knowledge entry.',409);
    if(v.audience==='workspace'?source.audience!=='workspace':employees.some(employee=>source.user_id!==employee&&source.audience!=='workspace'&&!(source.audience==='employees'&&source.shared_with.includes(employee))))throw new AssistantError('knowledge_source_audience','Share every source document with the proposed audience before publishing. No private source is shared automatically.',409);
   }
   if((await db.query("SELECT 1 FROM assistant_knowledge WHERE series_id=$1 AND version>=$2 AND status IN('published','superseded') LIMIT 1",[k.series_id,k.version])).rowCount)throw new AssistantError('knowledge_old_version','A newer version was already published. Create a correction from the current version.',409);
   const retired=(await db.query("UPDATE assistant_knowledge SET status='superseded',revision=revision+1 WHERE series_id=$1 AND status='published' RETURNING id",[k.series_id])).rows.map(r=>r.id);await invalidateKnowledge(db,retired);
   await db.query("UPDATE assistant_knowledge SET status='published',audience=$2,shared_with=$3,published_by=$4,published_at=now(),revision=revision+1 WHERE id=$1",[id,v.audience,v.audience==='employees'?employees:[],c.user.id]);
  }else{
   const ids=v.operation==='delete'?(await db.query('SELECT id FROM assistant_knowledge WHERE series_id=$1',[k.series_id])).rows.map(r=>r.id):[id];
   await invalidateKnowledge(db,ids);await db.query("UPDATE assistant_knowledge SET status='archived',revision=revision+1,content=CASE WHEN $2 THEN '' ELSE content END,title=CASE WHEN $2 THEN 'Deleted guidance' ELSE title END,provenance=CASE WHEN $2 THEN '' ELSE provenance END,source_refs=CASE WHEN $2 THEN '[]'::jsonb ELSE source_refs END,source_ids=CASE WHEN $2 THEN '{}'::uuid[] ELSE source_ids END WHERE id=ANY($1::uuid[])",[ids,v.operation==='delete']);
  }
  await refreshKnowledgeRetention(db);await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
