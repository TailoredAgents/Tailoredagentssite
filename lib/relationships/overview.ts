import 'server-only';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {SalesAccessError} from '@/lib/sales/data';
import {readRelationship} from './service';
import {listHandoffs} from './handoffs';
import type {RelationshipTarget} from './contract';

export function relationshipHref(t:RelationshipTarget){return `/dashboard/relationships/${t.kind}/${t.id}`;}
export type RelatedRecord={kind:RelationshipTarget['kind'];id:string;name:string;detail:string|null;status:string;owner:string|null;email:string|null;phone:string|null;client_id:string|null;updated_at:string;source:string|null;campaign:string|null};
export function recordHref(r:RelatedRecord){
 if(r.kind==='lead')return `/dashboard/leads/${r.id}`;
 if(r.kind==='opportunity')return `/dashboard/sales/${r.id}`;
 if(r.kind==='client')return `/dashboard/clients/${r.id}`;
 if(r.kind==='contact'&&r.client_id)return `/dashboard/clients/${r.client_id}/contacts/${r.id}`;
 return relationshipHref(r);
}
export async function getRelationshipOverview(c:DashboardContext,target:RelationshipTarget,includeMeetings=false){
 const relationship=await readRelationship(c,target),ids=relationship.related.map(r=>r.id),db=getDatabasePool();
 // Explicit canonical IDs only. No name/phone matching; no mailbox/message content.
 const records=(await db.query<RelatedRecord>(`SELECT 'lead' kind,l.id,COALESCE(NULLIF(l.name,''),NULLIF(l.organization,''),l.email,l.phone,'Prospect') name,l.organization detail,l.status,u.name owner,l.email,l.phone,l.client_id,l.updated_at,l.source,l.smart_card_context->>'campaign' campaign
 FROM leads l LEFT JOIN "user" u ON u.id=l.owner_user_id WHERE l.workspace_id=$1 AND l.id=ANY($2::uuid[]) AND l.anonymized_at IS NULL
 UNION ALL SELECT 'business',b.id,b.name,NULL,'relationship',NULL,b.normalized_email,b.normalized_phone,b.client_id,b.updated_at,NULL,NULL FROM crm_businesses b WHERE b.workspace_id=$1 AND b.id=ANY($2::uuid[]) AND b.anonymized_at IS NULL
 UNION ALL SELECT 'opportunity',o.id,o.title,NULL,o.stage,u.name,NULL,NULL,o.client_id,o.updated_at,o.source,NULL FROM crm_opportunities o LEFT JOIN "user" u ON u.id=o.owner_user_id WHERE o.workspace_id=$1 AND o.id=ANY($2::uuid[])
 UNION ALL SELECT 'client',cl.id,cl.name,NULL,cl.status,u.name,NULL,NULL,cl.id,cl.updated_at,NULL,NULL FROM clients cl LEFT JOIN "user" u ON u.id=cl.account_manager_user_id WHERE cl.workspace_id=$1 AND cl.id=ANY($2::uuid[])
 UNION ALL SELECT 'contact',ct.id,ct.name,ct.title,'contact',NULL,ct.email,ct.phone,ct.client_id,ct.updated_at,NULL,NULL FROM contacts ct WHERE ct.workspace_id=$1 AND ct.id=ANY($2::uuid[])`,[c.workspace.id,ids])).rows.map(r=>({...r,updated_at:new Date(r.updated_at).toISOString()}));
 const current=records.find(r=>r.kind===target.kind&&r.id===target.id);
 if(!current)throw new SalesAccessError('That relationship is unavailable.');
 const [projects,tasks,handoffs,meetings,leadSteps,bookings]=await Promise.all([
  db.query<{id:string;name:string;status:string;owner:string|null;due_at:Date|null}>(`SELECT p.id,p.name,p.status,u.name owner,p.due_at FROM projects p LEFT JOIN "user" u ON u.id=p.owner_user_id WHERE p.workspace_id=$1 AND (p.client_id=ANY($2::uuid[]) OR p.lead_id=ANY($2::uuid[]) OR p.id IN(SELECT project_id FROM crm_opportunities WHERE workspace_id=$1 AND id=ANY($2::uuid[]))) ORDER BY p.updated_at DESC,p.id LIMIT 50`,[c.workspace.id,ids]),
  db.query<{id:string;title:string;kind:string;owner:string|null;due_at:Date;opportunity_id:string|null}>(`SELECT t.id,t.title,t.kind,u.name owner,t.due_at,t.opportunity_id FROM crm_tasks t LEFT JOIN "user" u ON u.id=t.owner_user_id WHERE t.workspace_id=$1 AND t.opportunity_id=ANY($2::uuid[]) AND t.status='open' ORDER BY t.due_at,t.id LIMIT 50`,[c.workspace.id,ids]),
  listHandoffs(c,'team',relationship.related),
  includeMeetings?db.query<{id:string;title:string;status:string;created_at:Date}>(`SELECT id,title,status,created_at FROM meetings WHERE workspace_id=$1 AND (owner_user_id=$2 OR visibility='team') AND status NOT IN ('deleting','deleted') AND expires_at>now() AND (lead_id=ANY($3::uuid[]) OR business_id=ANY($3::uuid[]) OR opportunity_id=ANY($3::uuid[]) OR client_id=ANY($3::uuid[]) OR contact_id=ANY($3::uuid[])) ORDER BY created_at DESC,id LIMIT 20`,[c.workspace.id,c.user.id,ids]):Promise.resolve({rows:[]}),
  db.query<{id:string;title:string;owner:string|null;due_at:Date|null}>(`SELECT l.id,l.next_action title,u.name owner,l.next_action_at due_at FROM leads l LEFT JOIN "user" u ON u.id=l.owner_user_id WHERE l.workspace_id=$1 AND l.id=ANY($2::uuid[]) AND l.anonymized_at IS NULL AND NULLIF(l.next_action,'') IS NOT NULL ORDER BY l.next_action_at NULLS LAST,l.id LIMIT 50`,[c.workspace.id,ids]),
  db.query<{id:string;owner:string;starts_at:Date;ends_at:Date}>(`SELECT s.id,p.display_name owner,s.starts_at,s.ends_at FROM booking_slots s JOIN smart_card_profiles p ON p.workspace_id=s.workspace_id AND p.slug=s.profile_slug WHERE s.workspace_id=$1 AND s.lead_id=ANY($2::uuid[]) AND s.status='booked' ORDER BY s.starts_at,s.id LIMIT 50`,[c.workspace.id,ids]),
 ]);
 return {current,records,discovery:relationship.notes.map(n=>({id:n.id,fields:n.fields,source:n.source,author:n.author,createdAt:new Date(n.created_at).toISOString()})),introductions:relationship.introductions.map(i=>({id:i.id,partnerId:i.partner_id,name:i.name,organization:i.organization,note:i.note,createdAt:new Date(i.created_at).toISOString()})),
  projects:projects.rows.map(p=>({...p,due_at:p.due_at?.toISOString()??null})),tasks:tasks.rows.map(t=>({...t,due_at:t.due_at.toISOString()})),handoffs,
  meetings:meetings.rows.map(m=>({...m,created_at:m.created_at.toISOString()})),leadSteps:leadSteps.rows.map(t=>({...t,due_at:t.due_at?.toISOString()??null})),bookings:bookings.rows.map(b=>({...b,starts_at:b.starts_at.toISOString(),ends_at:b.ends_at.toISOString()})),limits:'Latest 100 discovery notes/introductions/handoffs, 50 projects/tasks/prospect steps/bookings and 20 permitted meetings. This overview never reads or marks communication messages.'};
}
