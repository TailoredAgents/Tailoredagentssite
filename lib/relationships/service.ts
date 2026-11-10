import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool,insertAuditLog} from '@/lib/dashboard/db';
import {authorizeSales,SalesAccessError} from '@/lib/sales/data';
import {discoverySchema,targetSchema,type RelationshipTarget} from './contract';
const tables={lead:'leads',business:'crm_businesses',opportunity:'crm_opportunities',client:'clients',contact:'contacts'} as const;
const columns={lead:'lead_id',business:'business_id',opportunity:'opportunity_id',client:'client_id',contact:'contact_id'} as const;
export async function relationshipAccess(c:DashboardContext,target:RelationshipTarget,db=getDatabasePool()){
 const t=targetSchema.parse(target);await authorizeSales(c);
 if(!(await db.query(`SELECT id FROM ${tables[t.kind]} WHERE workspace_id=$1 AND id=$2 ${['lead','business'].includes(t.kind)?'AND anonymized_at IS NULL':''}`,[c.workspace.id,t.id])).rowCount)throw new SalesAccessError('That relationship is unavailable.');
 return t;
}
// Traverse the canonical CRM links, not names or AI identity guesses. This keeps
// original attribution visible after conversion without copying or overwriting it.
export async function relationshipIds(c:DashboardContext,target:RelationshipTarget){
 const t=await relationshipAccess(c,target);
 const result=await getDatabasePool().query<{kind:RelationshipTarget['kind'];id:string}>(`WITH RECURSIVE edges(a,b) AS (
 SELECT 'lead:'||id,'business:'||business_id FROM leads WHERE workspace_id=$1 AND business_id IS NOT NULL UNION ALL
 SELECT 'lead:'||id,'client:'||client_id FROM leads WHERE workspace_id=$1 AND client_id IS NOT NULL UNION ALL
 SELECT 'client:'||id,'lead:'||lead_id FROM clients WHERE workspace_id=$1 AND lead_id IS NOT NULL UNION ALL
 SELECT 'business:'||id,'client:'||client_id FROM crm_businesses WHERE workspace_id=$1 AND client_id IS NOT NULL UNION ALL
 SELECT 'opportunity:'||id,'business:'||business_id FROM crm_opportunities WHERE workspace_id=$1 UNION ALL
 SELECT 'opportunity:'||id,'lead:'||lead_id FROM crm_opportunities WHERE workspace_id=$1 AND lead_id IS NOT NULL UNION ALL
 SELECT 'opportunity:'||id,'client:'||client_id FROM crm_opportunities WHERE workspace_id=$1 AND client_id IS NOT NULL UNION ALL
 SELECT 'contact:'||id,'business:'||business_id FROM contacts WHERE workspace_id=$1 AND business_id IS NOT NULL UNION ALL
 SELECT 'contact:'||id,'client:'||client_id FROM contacts WHERE workspace_id=$1 AND client_id IS NOT NULL
 ), links(a,b) AS (SELECT a,b FROM edges UNION SELECT b,a FROM edges), related(key) AS (
 SELECT $2::text UNION SELECT l.b FROM links l JOIN related r ON l.a=r.key
 ) SELECT split_part(key,':',1) kind,split_part(key,':',2) id FROM related`,[c.workspace.id,`${t.kind}:${t.id}`]);
 return result.rows;
}
export async function readRelationship(c:DashboardContext,target:RelationshipTarget){
 const related=await relationshipIds(c,target),ids=related.map(x=>x.id);
 const condition='workspace_id=$1 AND (lead_id=ANY($2::uuid[]) OR business_id=ANY($2::uuid[]) OR opportunity_id=ANY($2::uuid[]) OR client_id=ANY($2::uuid[]) OR contact_id=ANY($2::uuid[]))';
 const [notes,introductions,partners]=await Promise.all([
 getDatabasePool().query(`SELECT n.*,u.name author FROM crm_discovery_notes n LEFT JOIN "user" u ON u.id=n.author_user_id WHERE ${condition} ORDER BY n.created_at DESC LIMIT 100`,[c.workspace.id,ids]),
 getDatabasePool().query(`SELECT i.*,p.name,p.organization FROM (SELECT * FROM crm_introductions WHERE ${condition}) i JOIN crm_referral_partners p ON p.id=i.partner_id AND p.workspace_id=i.workspace_id ORDER BY i.created_at DESC LIMIT 100`,[c.workspace.id,ids]),
 getDatabasePool().query<{id:string;name:string;organization:string}>('SELECT id,name,organization FROM crm_referral_partners WHERE workspace_id=$1 ORDER BY name LIMIT 500',[c.workspace.id])]);
 return {notes:notes.rows,introductions:introductions.rows,partners:partners.rows,related};
}
async function mutate<T>(c:DashboardContext,work:(db:PoolClient)=>Promise<T>){
 await authorizeSales(c,true);const db=await getDatabasePool().connect();
 try{await db.query('BEGIN');const access=await db.query("SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role<>'viewer' AND w.status='active' FOR SHARE OF m,w",[c.workspace.id,c.user.id]);if(!access.rowCount)throw new SalesAccessError('Editing access is required.');const result=await work(db);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function saveDiscovery(c:DashboardContext,input:unknown){
 const v=discoverySchema.parse(input);await relationshipAccess(c,v);
 return mutate(c,async db=>{const id=randomUUID();await db.query(`INSERT INTO crm_discovery_notes(id,workspace_id,${columns[v.kind]},fields,author_user_id) VALUES($1,$2,$3,$4,$5)`,[id,c.workspace.id,v.id,v.fields,c.user.id]);await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'discovery.recorded',targetType:v.kind,targetId:v.id});return id;});
}
export async function addIntroduction(c:DashboardContext,input:unknown){
 const v=targetSchema.extend({partnerId:z.union([z.uuid(),z.literal('')]),name:z.string().trim().max(160),organization:z.string().trim().max(160),note:z.string().trim().max(2000)}).parse(input);await relationshipAccess(c,v);
 return mutate(c,async db=>{
 let partner=v.partnerId;
 if(!partner){if(!v.name)throw new SalesAccessError('Choose a referral partner or enter their name.');partner=randomUUID();await db.query('INSERT INTO crm_referral_partners(id,workspace_id,name,organization,created_by) VALUES($1,$2,$3,$4,$5)',[partner,c.workspace.id,v.name,v.organization,c.user.id]);}
 else if(!(await db.query('SELECT 1 FROM crm_referral_partners WHERE workspace_id=$1 AND id=$2',[c.workspace.id,partner])).rowCount)throw new SalesAccessError('Choose a referral partner in this workspace.');
 const id=randomUUID();await db.query(`INSERT INTO crm_introductions(id,workspace_id,partner_id,${columns[v.kind]},note,created_by) VALUES($1,$2,$3,$4,$5,$6)`,[id,c.workspace.id,partner,v.id,v.note,c.user.id]);await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'relationship.introduction_recorded',targetType:v.kind,targetId:v.id});return id;
 });
}
export async function setAccountManager(c:DashboardContext,input:unknown){
 const v=z.object({clientId:z.uuid(),userId:z.string().max(200)}).parse(input);await relationshipAccess(c,{kind:'client',id:v.clientId});
 return mutate(c,async db=>{if(v.userId&&!(await db.query("SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2 AND status='active' AND role<>'viewer'",[c.workspace.id,v.userId])).rowCount)throw new SalesAccessError('Choose an active teammate.');await db.query('UPDATE clients SET account_manager_user_id=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2',[c.workspace.id,v.clientId,v.userId||null]);await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'client.account_manager_changed',targetType:'client',targetId:v.clientId,metadata:{userId:v.userId||null}});});
}
