import "server-only";
import { enqueueFactoryLead } from "@/lib/factory/service";
import { enqueueLeadAlerts } from "./lead-alerts";
import { randomUUID } from "node:crypto";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import type { DashboardContext } from "@/lib/dashboard/data";
import { authorizeSales, SalesAccessError } from "@/lib/sales/data";
import { META_WORKSPACE_ID as workspaceId, metaConfiguration } from "./config";
import { leadEventSchema, mapMetaLead, webhookSchema } from "./validation";
import { fetchMetaLead, MetaProviderError } from "./provider";

export async function enqueueMetaLeads(payload: unknown) {
  const parsed = webhookSchema.parse(payload);
  const config = metaConfiguration();
  const client = await getDatabasePool().connect();
  let accepted = 0;
  try {
    await client.query("BEGIN");
    for (const entry of parsed.entry) {
      if (entry.id !== config.pageId) continue;
      for (const change of entry.changes) {
        if (change.field !== "leadgen") continue;
        const event = leadEventSchema.parse(change.value);
        if (event.page_id && event.page_id !== config.pageId) continue;
        const result = await client.query(
          `INSERT INTO meta_lead_events(id,workspace_id,page_id,provider_lead_id,form_id)
           VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,page_id,provider_lead_id) DO NOTHING`,
          [
            randomUUID(),
            workspaceId,
            config.pageId,
            event.leadgen_id,
            event.form_id,
          ],
        );
        accepted += result.rowCount || 0;
      }
    }
    await client.query("COMMIT");
    return accepted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** One recoverable lease at a time; provider failures never acknowledge away a lead. */
export async function runMetaLeadWorker() {
  const config = metaConfiguration();
  if (!config.enabled || !config.ready)
    return { checked: 0, failed: 0, more: false };
  const pool = getDatabasePool();
  const lease = randomUUID();
  const claimed = await pool.query<{
    id: string;
    provider_lead_id: string;
    form_id: string;
    attempts: number;
  }>(
    `UPDATE meta_lead_events SET status='working',attempts=attempts+1,lease_token=$3,lease_expires_at=now()+interval '2 minutes'
     WHERE id=(SELECT id FROM meta_lead_events WHERE workspace_id=$1 AND page_id=$2
       AND status IN ('pending','working') AND next_attempt_at<=now()
       AND (lease_expires_at IS NULL OR lease_expires_at<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
     RETURNING id,provider_lead_id,form_id,attempts`,
    [workspaceId, config.pageId, lease],
  );
  const job = claimed.rows[0];
  if (!job) return { checked: 0, failed: 0, more: false };
  let failed = 0;
  try {
    const lead = mapMetaLead(await fetchMetaLead(job.provider_lead_id));
    if (
      lead.context.leadId !== job.provider_lead_id ||
      lead.context.formId !== job.form_id
    )
      throw new MetaProviderError("identity_mismatch");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const active = await client.query(
        "SELECT id FROM meta_lead_events WHERE id=$1 AND lease_token=$2 AND lease_expires_at>now() FOR UPDATE",
        [job.id, lease],
      );
      if (!active.rowCount) {
        await client.query("ROLLBACK");
        return { checked: 1, failed: 0, more: true };
      }
      const current = metaConfiguration();
      if (!current.enabled || current.pageId !== config.pageId)
        throw new MetaProviderError("configuration_changed");
      const leadId = randomUUID();
      await client.query(
        `INSERT INTO leads(id,workspace_id,submission_id,source,status,name,organization,email,phone,description,delivery_status,meta_context)
         VALUES($1,$2,$3,'facebook','new',$4,$5,$6,$7,$8,'not_configured',$9::jsonb)`,
        [
          leadId,
          workspaceId,
          `meta:${config.pageId}:${job.provider_lead_id}`,
          lead.name,
          lead.organization,
          lead.email,
          lead.phone,
          lead.description,
          JSON.stringify(lead.context),
        ],
      );
      await client.query(
        "UPDATE meta_lead_events SET status='imported',lead_id=$3,imported_at=now(),error_code=NULL,lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2",
        [job.id, lease, leadId],
      );
      await enqueueLeadAlerts(client, workspaceId, job.id, leadId);
      await enqueueFactoryLead(client, workspaceId, leadId);
      await insertAuditLog(client, {
        workspaceId,
        action: "lead.received",
        targetType: "lead",
        targetId: leadId,
        metadata: { source: "facebook" },
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    failed = 1;
    const code =
      error instanceof MetaProviderError ? error.code : "import_failed";
    await pool.query(
      `UPDATE meta_lead_events SET status=$3,error_code=$4,lease_token=NULL,lease_expires_at=NULL,
       next_attempt_at=now()+make_interval(secs=>$5) WHERE id=$1 AND lease_token=$2`,
      [
        job.id,
        lease,
        job.attempts >= 12 ? "failed" : "pending",
        code,
        Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)),
      ],
    );
  }
  const due = await pool.query(
    "SELECT 1 FROM meta_lead_events WHERE workspace_id=$1 AND page_id=$2 AND status IN ('pending','working') AND next_attempt_at<=now() AND (lease_expires_at IS NULL OR lease_expires_at<now()) LIMIT 1",
    [workspaceId, config.pageId],
  );
  return { checked: 1, failed, more: Boolean(due.rowCount) };
}

export async function getMetaStatus(context: DashboardContext) {
  await authorizeSales(context);
  if (context.workspace.id !== workspaceId) return null;
  const config = metaConfiguration();
  const result = await getDatabasePool().query<{
    status: string;
    count: string;
    last: Date | null;
    has_error: boolean;
  }>(
    "SELECT status,count(*)::text, max(imported_at) AS last, bool_or(error_code IS NOT NULL) AS has_error FROM meta_lead_events WHERE workspace_id=$1 AND page_id=$2 GROUP BY status",
    [workspaceId, config.pageId],
  );
  return {
    configured: config.ready,
    enabled: config.enabled,
    pageId: config.pageId,
    needsAttention: result.rows.some((row) => row.has_error),
    counts: result.rows.map((row) => ({
      status: row.status,
      count: Number(row.count),
      last: row.last?.toISOString() || null,
    })),
  };
}

export async function retryMetaImports(context: DashboardContext) {
  if (context.workspace.id !== workspaceId)
    throw new SalesAccessError(
      "This connection belongs to the internal workspace.",
    );
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const access = await client.query(
      "SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin') AND w.status='active' FOR SHARE OF m,w",
      [workspaceId, context.user.id],
    );
    if (!access.rowCount)
      throw new SalesAccessError(
        "Only an owner or administrator can retry imports.",
      );
    await client.query(
      "UPDATE meta_lead_events SET status='pending',attempts=0,next_attempt_at=now(),error_code=NULL WHERE workspace_id=$1 AND page_id=$2 AND status='failed'",
      [workspaceId, metaConfiguration().pageId],
    );
    await insertAuditLog(client, {
      workspaceId,
      actorUserId: context.user.id,
      action: "meta.imports_retried",
      targetType: "integration",
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
