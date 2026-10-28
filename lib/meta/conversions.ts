import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import type { DashboardContext } from "@/lib/dashboard/data";
import { authorizeSales, SalesAccessError } from "@/lib/sales/data";
import { META_WORKSPACE_ID } from "./config";
import { metaConversionConfiguration } from "./conversion-config";
import { MetaConversionError, sendMetaConversion, type ConversionStage } from "./conversion-provider";

type Claimed = { id: string; provider_lead_id: string; stage: ConversionStage; occurred_at: Date; attempts: number };

export async function runMetaConversionWorker() {
  const config = metaConversionConfiguration(), pool = getDatabasePool();
  // Metadata has bounded retention even while delivery is paused.
  await pool.query("DELETE FROM meta_conversion_events WHERE workspace_id=$1 AND occurred_at<now()-interval '90 days'", [META_WORKSPACE_ID]);
  await pool.query(`UPDATE meta_conversion_events SET state='expired',error_code='event_outside_upload_window',lease_token=NULL,lease_expires_at=NULL
    WHERE workspace_id=$1 AND state NOT IN ('accepted','expired') AND occurred_at<=now()-interval '7 days'`, [META_WORKSPACE_ID]);
  if (!config.ready) return { checked: 0, failed: 0, more: false };
  await pool.query(`UPDATE meta_conversion_events SET state='failed',error_code='retry_window_expired',lease_token=NULL,lease_expires_at=NULL
    WHERE workspace_id=$1 AND state IN ('pending','working') AND (first_attempt_at<=now()-interval '24 hours' OR attempts>=12)
      AND (lease_expires_at IS NULL OR lease_expires_at<now())`, [META_WORKSPACE_ID]);
  const lease = randomUUID();
  const claimed = await pool.query<Claimed>(`UPDATE meta_conversion_events e SET state='working',dataset_id=$3,delivery_mode=$4,
      attempts=e.attempts+1,first_attempt_at=COALESCE(e.first_attempt_at,now()),lease_token=$5,lease_expires_at=now()+interval '2 minutes',updated_at=now()
    WHERE e.id=(SELECT c.id FROM meta_conversion_events c JOIN leads l ON l.id=c.lead_id AND l.workspace_id=c.workspace_id
      JOIN workspaces w ON w.id=c.workspace_id
      WHERE c.workspace_id=$1 AND c.page_id=$2 AND w.status='active' AND l.anonymized_at IS NULL
        AND (c.state IN ('pending','working') OR ($4='live' AND c.state='tested'))
        AND c.next_attempt_at<=now() AND (c.lease_expires_at IS NULL OR c.lease_expires_at<now())
        AND (c.dataset_id IS NULL OR c.dataset_id=$3) AND (c.delivery_mode IS NULL OR c.delivery_mode=$4 OR (c.state='tested' AND $4='live'))
        AND c.attempts<12
      ORDER BY c.occurred_at,c.id FOR UPDATE OF c SKIP LOCKED LIMIT 1)
    RETURNING e.id,e.provider_lead_id,e.stage,e.occurred_at,e.attempts`,
  [META_WORKSPACE_ID, config.pageId, config.datasetId, config.mode, lease]);
  const event = claimed.rows[0];
  if (!event) return { checked: 0, failed: 0, more: false };
  try {
    await sendMetaConversion({ id: event.id, providerLeadId: event.provider_lead_id, stage: event.stage, occurredAt: event.occurred_at }, config);
    await pool.query(`UPDATE meta_conversion_events SET state=$3,lease_token=NULL,lease_expires_at=NULL,error_code=NULL,updated_at=now(),
      tested_at=CASE WHEN $3='tested' THEN now() ELSE tested_at END,accepted_at=CASE WHEN $3='accepted' THEN now() ELSE NULL END,
      attempts=CASE WHEN $3='tested' THEN 0 ELSE attempts END,first_attempt_at=CASE WHEN $3='tested' THEN NULL ELSE first_attempt_at END
      WHERE id=$1 AND lease_token=$2`, [event.id, lease, config.mode === "test" ? "tested" : "accepted"]);
    return { checked: 1, failed: 0, more: true };
  } catch (error) {
    const failure = error instanceof MetaConversionError ? error : new MetaConversionError("response_unconfirmed", true);
    const retry = failure.retryable && event.attempts < 12;
    await pool.query(`UPDATE meta_conversion_events SET state=$3,error_code=$4,lease_token=NULL,lease_expires_at=NULL,
      next_attempt_at=now()+($5 * interval '1 second'),updated_at=now() WHERE id=$1 AND lease_token=$2`,
    [event.id, lease, retry ? "pending" : "failed", failure.code, Math.min(21600, 60 * 2 ** event.attempts)]);
    return { checked: 1, failed: 1, more: true };
  }
}

export async function getMetaConversionStatus(context: DashboardContext) {
  await authorizeSales(context);
  if (context.workspace.id !== META_WORKSPACE_ID) return null;
  const config = metaConversionConfiguration();
  const rows = await getDatabasePool().query<{ state: string; count: string; last: Date | null }>(
    "SELECT state,count(*)::text count,max(COALESCE(accepted_at,tested_at,updated_at)) last FROM meta_conversion_events WHERE workspace_id=$1 GROUP BY state", [context.workspace.id]);
  const problems = await getDatabasePool().query<{ error_code: string; count: string }>(`SELECT COALESCE(error_code,'destination_or_mode_changed') error_code,count(*)::text count
    FROM meta_conversion_events WHERE workspace_id=$1 AND state NOT IN ('accepted','expired')
      AND (error_code IS NOT NULL OR (dataset_id IS NOT NULL AND dataset_id<>$2) OR (delivery_mode IS NOT NULL AND delivery_mode<>$3 AND NOT(state='tested' AND $3='live')))
    GROUP BY 1 ORDER BY 1 LIMIT 8`, [context.workspace.id, config.datasetId, config.mode]);
  return { configured: config.configured, ready: config.ready, mode: config.mode, datasetId: config.datasetId,
    counts: rows.rows.map(r => ({ state: r.state, count: Number(r.count), last: r.last?.toISOString() || null })),
    problems: problems.rows.map(r => ({ code: r.error_code, count: Number(r.count) })) };
}

export async function retryMetaConversions(context: DashboardContext) {
  if (context.workspace.id !== META_WORKSPACE_ID) throw new SalesAccessError("This connection belongs to the internal workspace.");
  const config = metaConversionConfiguration(), db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    const access = await db.query(`SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id
      WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin') AND w.status='active' FOR SHARE OF m,w`, [context.workspace.id, context.user.id]);
    if (!access.rowCount) throw new SalesAccessError("Only an owner or administrator can retry conversions.");
    const result = await db.query(`UPDATE meta_conversion_events SET state='pending',attempts=0,next_attempt_at=now(),error_code=NULL,updated_at=now()
      WHERE workspace_id=$1 AND page_id=$2 AND dataset_id=$3 AND delivery_mode=$4 AND state='failed'
        AND occurred_at>now()-interval '7 days' AND first_attempt_at>now()-interval '24 hours'`,
    [context.workspace.id, config.pageId, config.datasetId, config.mode]);
    await insertAuditLog(db, { workspaceId: context.workspace.id, actorUserId: context.user.id,
      action: "meta.conversions_retried", targetType: "integration", metadata: { count: result.rowCount } });
    await db.query("COMMIT");
    return result.rowCount || 0;
  } catch (error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
}
