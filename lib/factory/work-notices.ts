import "server-only";
import {randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import type {DashboardContext} from "@/lib/dashboard/data";
import {getDatabasePool,insertAuditLog} from "@/lib/dashboard/db";
import {leadDisplayName} from "@/lib/operations/format";
import {authorizeFactory,factoryTransaction} from "./data";
import {FactoryInputError} from "./types";

export type FactoryWorkNotice={id:string;projectId:string;kind:"plan_ready"|"website_ready"|"needs_attention";leadName:string;ownerName:string|null;createdAt:string};
export type FactoryWorkNoticeList={items:FactoryWorkNotice[];canEdit:boolean};

/** A notice follows the current actionable state, never an older failed build. */
async function reconcile(db:PoolClient,workspaceId:string){
  const rows=(await db.query<{project_id:string;kind:FactoryWorkNotice["kind"]|null;event_key:string|null;owner_user_id:string|null}>(`
    WITH states AS (
      SELECT p.id project_id,p.created_by,l.owner_user_id lead_owner,j.requested_by,b.approved_by,
        CASE
          WHEN p.status IN ('research_queued','researching') OR j.status IN ('queued','running') THEN NULL
          WHEN p.status='failed' AND j.status='failed' THEN 'needs_attention'
          WHEN p.status='plan_ready' AND pl.id IS NOT NULL THEN 'plan_ready'
          WHEN p.status='approved' AND b.plan_id=p.current_plan_id AND b.status='failed' THEN 'needs_attention'
          WHEN p.status='approved' AND b.plan_id=p.current_plan_id AND b.status='ready' AND b.revoked_at IS NULL AND b.expires_at>now() THEN 'website_ready'
        END kind,
        CASE
          WHEN p.status='failed' AND j.status='failed' THEN 'job:'||j.id::text
          WHEN p.status='plan_ready' AND pl.id IS NOT NULL THEN 'plan:'||pl.id::text
          WHEN p.status='approved' AND b.plan_id=p.current_plan_id AND b.status='failed' THEN 'build:'||b.id::text||':'||extract(epoch FROM b.updated_at)::text
          WHEN p.status='approved' AND b.plan_id=p.current_plan_id THEN 'build:'||b.id::text
        END source_key,
        p.status='approved' use_approver
      FROM factory_projects p
      JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id AND l.anonymized_at IS NULL
      JOIN workspaces w ON w.id=p.workspace_id AND w.status='active'
      LEFT JOIN factory_plans pl ON pl.id=p.current_plan_id AND pl.project_id=p.id AND pl.workspace_id=p.workspace_id
      LEFT JOIN LATERAL (SELECT id,status,requested_by FROM factory_jobs WHERE project_id=p.id AND workspace_id=p.workspace_id ORDER BY created_at DESC,id DESC LIMIT 1) j ON true
      LEFT JOIN LATERAL (SELECT v.id,v.status,v.revoked_at,v.expires_at,v.updated_at,r.plan_id,r.approved_by FROM factory_build_versions v JOIN factory_build_requests r ON r.id=v.build_request_id AND r.workspace_id=v.workspace_id WHERE v.project_id=p.id AND v.workspace_id=p.workspace_id ORDER BY v.version DESC LIMIT 1) b ON true
      WHERE p.workspace_id=$1
    )
    SELECT s.project_id,s.kind,CASE WHEN s.kind IS NOT NULL THEN s.kind||':'||s.source_key END event_key,owner.user_id owner_user_id
    FROM states s LEFT JOIN LATERAL (
      SELECT m.user_id FROM unnest(CASE WHEN s.use_approver THEN ARRAY[s.lead_owner,s.approved_by,s.created_by] ELSE ARRAY[s.lead_owner,s.requested_by,s.created_by] END) WITH ORDINALITY candidates(user_id,priority)
      JOIN workspace_memberships m ON m.user_id=candidates.user_id AND m.workspace_id=$1 AND m.status='active' AND m.role<>'viewer'
      ORDER BY candidates.priority LIMIT 1
    ) owner ON true`,[workspaceId])).rows;
  const wanted=new Map(rows.filter(row=>row.kind&&row.event_key).map(row=>[row.project_id,row]));
  const current=(await db.query<{id:string;project_id:string;event_key:string}>("SELECT id,project_id,event_key FROM factory_work_notices WHERE workspace_id=$1 AND status='open'",[workspaceId])).rows;
  for(const notice of current)if(wanted.get(notice.project_id)?.event_key!==notice.event_key)
    await db.query("UPDATE factory_work_notices SET status='resolved',updated_at=now() WHERE id=$1 AND workspace_id=$2 AND status='open'",[notice.id,workspaceId]);
  for(const row of wanted.values())await db.query(`INSERT INTO factory_work_notices(id,workspace_id,project_id,event_key,kind,owner_user_id) VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(project_id,event_key) DO UPDATE SET owner_user_id=EXCLUDED.owner_user_id,
      status=CASE WHEN factory_work_notices.status='resolved' THEN 'open' ELSE factory_work_notices.status END,
      updated_at=CASE WHEN factory_work_notices.status='resolved' OR factory_work_notices.owner_user_id IS DISTINCT FROM EXCLUDED.owner_user_id THEN now() ELSE factory_work_notices.updated_at END`,[randomUUID(),workspaceId,row.project_id,row.event_key,row.kind,row.owner_user_id]);
}

/** Catch up durable notices after worker work. No external messages or provider requests. */
export async function syncFactoryWorkNotices(){
  const workspaces=(await getDatabasePool().query<{id:string}>("SELECT w.id FROM workspaces w WHERE w.status='active' AND EXISTS(SELECT 1 FROM factory_projects p WHERE p.workspace_id=w.id) ORDER BY w.id")).rows;
  for(const {id}of workspaces)await factoryTransaction(id,db=>reconcile(db,id));
}

export async function getFactoryWorkNotices(context:DashboardContext,scope:"mine"|"team"="mine"):Promise<FactoryWorkNoticeList>{
  return factoryTransaction(context.workspace.id,async db=>{
    const role=await authorizeFactory(db,context);
    await reconcile(db,context.workspace.id);
    const rows=(await db.query<{id:string;project_id:string;kind:FactoryWorkNotice["kind"];name:string|null;organization:string|null;phone:string|null;email:string|null;owner_name:string|null;created_at:Date}>(`
      SELECT n.id,n.project_id,n.kind,l.name,l.organization,l.phone,l.email,u.name owner_name,n.created_at
      FROM factory_work_notices n JOIN factory_projects p ON p.id=n.project_id AND p.workspace_id=n.workspace_id
      JOIN leads l ON l.id=p.lead_id AND l.workspace_id=p.workspace_id AND l.anonymized_at IS NULL
      LEFT JOIN "user" u ON u.id=n.owner_user_id
      WHERE n.workspace_id=$1 AND n.status='open' AND ($3='team' OR n.owner_user_id=$2 OR n.owner_user_id IS NULL)
      ORDER BY CASE n.kind WHEN 'needs_attention' THEN 0 WHEN 'plan_ready' THEN 1 ELSE 2 END,n.created_at DESC,n.id LIMIT 50`,[context.workspace.id,context.user.id,scope])).rows;
    return {canEdit:role!=="viewer",items:rows.map(row=>({id:row.id,projectId:row.project_id,kind:row.kind,leadName:leadDisplayName(row),ownerName:row.owner_name,createdAt:row.created_at.toISOString()}))};
  });
}

export async function markFactoryWorkNoticeSeen(context:DashboardContext,id:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new FactoryInputError("Choose a website update to mark seen.");
  return factoryTransaction(context.workspace.id,async db=>{
    await authorizeFactory(db,context,"edit");
    await reconcile(db,context.workspace.id);
    const changed=await db.query(`UPDATE factory_work_notices n SET status='seen',seen_at=now(),seen_by=$3,updated_at=now()
      FROM factory_projects p,leads l WHERE n.id=$1 AND n.workspace_id=$2 AND n.status='open' AND p.id=n.project_id AND p.workspace_id=n.workspace_id AND l.id=p.lead_id AND l.workspace_id=p.workspace_id AND l.anonymized_at IS NULL RETURNING n.project_id`,[id,context.workspace.id,context.user.id]);
    if(!changed.rowCount)throw new FactoryInputError("This website update is no longer waiting for attention.");
    await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:"factory.update_seen",targetType:"factory_project",targetId:changed.rows[0].project_id,metadata:{noticeId:id}});
    return {projectId:changed.rows[0].project_id as string};
  });
}
