import 'server-only';
import {randomUUID} from 'node:crypto';
import type {DashboardContext} from '@/lib/dashboard/data';
import {insertAuditLog} from '@/lib/dashboard/db';
import {SalesAccessError} from '@/lib/sales/data';
import {relationshipIds,relationshipAccess} from './service';
import {workTransaction,once} from './transactions';
import {briefSchema} from './solution-contract';
import type {RelationshipTarget} from './contract';
const columns={lead:'lead_id',business:'business_id',opportunity:'opportunity_id',client:'client_id',contact:'contact_id'} as const;
export async function listSolutionBriefs(c:DashboardContext,target:RelationshipTarget){
 const ids=(await relationshipIds(c,target)).map(r=>r.id);
 return workTransaction(c,false,async db=>{
  const briefs=(await db.query(`SELECT b.*,u.name author FROM crm_solution_briefs b LEFT JOIN "user" u ON u.id=b.updated_by WHERE b.workspace_id=$1 AND COALESCE(b.lead_id,b.business_id,b.opportunity_id,b.client_id,b.contact_id)=ANY($2::uuid[]) ORDER BY b.updated_at DESC,b.id LIMIT 50`,[c.workspace.id,ids])).rows;
  const versions=(await db.query(`SELECT v.*,u.name author FROM crm_solution_brief_versions v JOIN crm_solution_briefs b ON b.id=v.brief_id AND b.workspace_id=$1 LEFT JOIN "user" u ON u.id=v.author_user_id WHERE v.brief_id=ANY($2::uuid[]) ORDER BY v.created_at DESC LIMIT 200`,[c.workspace.id,briefs.map(b=>b.id)])).rows;
  return {briefs,versions,limits:{briefs:50,versions:200}};
 });
}
export async function saveSolutionBrief(c:DashboardContext,input:unknown){
 const v=briefSchema.parse(input),ids=(await relationshipIds(c,v)).map(r=>r.id);
 return workTransaction(c,true,async db=>{
  await relationshipAccess(c,v,db);
  return once(db,c,'solution_brief',v.requestId,v,async()=>{
   // Only team-shared sources may be cited in a team-visible brief. Private
   // meetings must be deliberately shared through their existing controls first.
   for(const source of v.sources){
    const table=source.kind==='discovery'?'crm_discovery_notes':'meetings';
    const visible=source.kind==='meeting'?"AND visibility='team' AND status NOT IN ('deleting','deleted') AND expires_at>now()":'';
    if(!(await db.query(`SELECT 1 FROM ${table} WHERE workspace_id=$1 AND id=$2 AND (lead_id=ANY($3::uuid[]) OR business_id=ANY($3::uuid[]) OR opportunity_id=ANY($3::uuid[]) OR client_id=ANY($3::uuid[]) OR contact_id=ANY($3::uuid[])) ${visible}`,[c.workspace.id,source.id,ids])).rowCount)throw new SalesAccessError('Each source must be connected to this relationship and shared with the team.');
   }
   let id=v.briefId,revision=1;
   if(id){
    const current=(await db.query(`SELECT revision FROM crm_solution_briefs WHERE workspace_id=$1 AND id=$2 AND COALESCE(lead_id,business_id,opportunity_id,client_id,contact_id)=ANY($3::uuid[]) FOR UPDATE`,[c.workspace.id,id,ids])).rows[0];
    if(!current||current.revision!==v.revision)throw new SalesAccessError('This brief changed. Refresh and read its current version.');
    revision=current.revision+1;
    await db.query('UPDATE crm_solution_briefs SET title=$3,status=$4,fields=$5,sources=$6,revision=$7,updated_by=$8,updated_at=now() WHERE workspace_id=$1 AND id=$2',[c.workspace.id,id,v.title,v.status,v.fields,JSON.stringify(v.sources),revision,c.user.id]);
   }else{
    id=randomUUID();await db.query(`INSERT INTO crm_solution_briefs(id,workspace_id,${columns[v.kind]},title,status,fields,sources,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id,c.workspace.id,v.id,v.title,v.status,v.fields,JSON.stringify(v.sources),c.user.id]);
   }
   await db.query('INSERT INTO crm_solution_brief_versions(brief_id,revision,title,status,fields,sources,author_user_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,revision,v.title,v.status,v.fields,JSON.stringify(v.sources),c.user.id]);
   await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'solution.brief_saved',targetType:v.kind,targetId:v.id,metadata:{briefId:id,revision,status:v.status}});
   return {id,revision,status:v.status};
  });
 });
}
