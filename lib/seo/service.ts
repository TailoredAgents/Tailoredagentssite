import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import type { DashboardContext } from "@/lib/dashboard/data";
import { requireReportingSite } from "@/lib/dashboard/site-access";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import {
  SEO_SITE_ID,
  SEO_WORKSPACE_ID,
  SEO_ORIGIN,
  managedPath,
  seoConfiguration,
  SEO_MONTHLY_MAX,
} from "./config";
import {
  SeoInputError,
  type SeoManager,
  type SeoChange,
  type SeoRun,
} from "./types";
import { businessProfile } from "./profile";
import { readPublicPage } from "./http";
import { parsePage } from "./audit";
import { seoMetrics } from "./metrics";
import { settleCost } from "./budget";
async function authorize(context: DashboardContext, manage = false) {
  const site = await requireReportingSite(context, manage);
  if (site.id !== SEO_SITE_ID || context.workspace.id !== SEO_WORKSPACE_ID)
    throw new SeoInputError(
      "The internal SEO manager is unavailable for this site.",
    );
  return site;
}
export async function seoTransaction<T>(
  site: string,
  work: (db: PoolClient) => Promise<T>,
) {
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `seo-work:${site}`,
    ]);
    const r = await work(db);
    await db.query("COMMIT");
    return r;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
export async function getSeoDashboard(context: DashboardContext) {
  await authorize(context);
  const pool = getDatabasePool(),
    scope = [context.workspace.id, SEO_SITE_ID];
  const [m, pages, runs, changes, costs, research, metrics, strategy] = await Promise.all(
    [
      pool.query<SeoManager>(
        "SELECT * FROM seo_managers WHERE workspace_id=$1 AND site_id=$2",
        scope,
      ),
      pool.query(
        "SELECT path,snapshot,crawled_at FROM seo_pages WHERE workspace_id=$1 AND site_id=$2 ORDER BY path",
        scope,
      ),
      pool.query<SeoRun>(
        "SELECT * FROM seo_runs WHERE workspace_id=$1 AND site_id=$2 ORDER BY created_at DESC LIMIT 12",
        scope,
      ),
      pool.query<SeoChange>(
        "SELECT * FROM seo_changes WHERE workspace_id=$1 AND site_id=$2 ORDER BY created_at DESC LIMIT 30",
        scope,
      ),
      pool.query(
        "SELECT id,provider,operation,status,reserved_micros,actual_micros,provider_id,created_at FROM seo_costs WHERE workspace_id=$1 AND site_id=$2 AND period=date_trunc('month',now() AT TIME ZONE 'UTC')::date ORDER BY created_at DESC LIMIT 100",
        scope,
      ),
      pool.query(
        "SELECT keyword,location,device,status,result,checked_at FROM seo_research WHERE workspace_id=$1 AND site_id=$2 ORDER BY created_at DESC,id LIMIT 30",
        scope,
      ),
      seoMetrics(scope[0], scope[1]),
      pool.query<SeoRun>("SELECT * FROM seo_runs WHERE workspace_id=$1 AND site_id=$2 AND kind='strategy' AND status='succeeded' AND context->>'safetyCase' IS NULL ORDER BY finished_at DESC LIMIT 1",scope),
    ],
  );
  const manager = m.rows[0];
  if (!manager)
    throw new SeoInputError("Apply the SEO manager database migration first.");
  const spent = (
    await pool.query(
      "SELECT COALESCE(sum(CASE WHEN status='settled' THEN actual_micros WHEN status IN ('reserved','uncertain') THEN reserved_micros ELSE 0 END),0)::text used FROM seo_costs WHERE workspace_id=$1 AND site_id=$2 AND period=date_trunc('month',now() AT TIME ZONE 'UTC')::date",
      scope,
    )
  ).rows[0].used;
  const canManage = Boolean(
    (
      await pool.query(
        "SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2 AND status='active' AND role IN ('owner','admin')",
        [scope[0], context.user.id],
      )
    ).rowCount,
  );
  const health = (await pool.query(`SELECT
    (SELECT max(finished_at) FROM seo_runs WHERE workspace_id=$1 AND site_id=$2 AND kind='monitor' AND status='succeeded') AS last_scan,
    (SELECT max(finished_at) FROM seo_runs WHERE workspace_id=$1 AND site_id=$2 AND kind='strategy' AND status='succeeded' AND context->>'safetyCase' IS NULL) AS last_strategy,
    EXISTS(SELECT 1 FROM seo_costs WHERE workspace_id=$1 AND site_id=$2 AND status='uncertain') AS uncertain,
    EXISTS(SELECT 1 FROM seo_runs WHERE workspace_id=$1 AND site_id=$2 AND status IN ('queued','running')) AS working,
    COALESCE(sum(actual_micros) FILTER(WHERE status='settled'),0)::text AS settled,
    COALESCE(sum(reserved_micros) FILTER(WHERE status IN ('reserved','uncertain')),0)::text AS reserved
    FROM seo_costs WHERE workspace_id=$1 AND site_id=$2 AND period=date_trunc('month',now() AT TIME ZONE 'UTC')::date`,scope)).rows[0];
  const stale = !manager.last_worker_success_at || Date.now()-manager.last_worker_success_at.getTime()>20*60_000;
  const remaining = Math.max(0,Math.min(Number(manager.monthly_limit_micros),SEO_MONTHLY_MAX)-Number(spent));
  const status = health.uncertain ? "Needs attention" : stale && (manager.enabled || manager.ai_enabled) ? "Needs attention" :
    manager.pilot_enabled ? "Model pilot" : !manager.ai_enabled ? "Paid AI paused" : !seoConfiguration().ai ? "Needs connection" : remaining === 0 ? "Budget reached" : runs.rows.some(r=>["failed","blocked","uncertain"].includes(r.status)) ? "Needs attention" : health.working ? "Working" : "Ready";
  return {
    health: {...health, stale, remaining, status},
    manager,
    strategy: strategy.rows[0],
    profile: businessProfile(manager.local_markets),
    pages: pages.rows,
    runs: runs.rows,
    changes: changes.rows,
    costs: costs.rows,
    research: research.rows,
    metrics,
    spent: Number(spent),
    canManage,
    configuration: seoConfiguration(),
  };
}
const settingsSchema = z.object({
  enabled: z.boolean(),
  aiEnabled: z.boolean().default(false),
  budget: z.coerce.number().finite().min(1).max(10),
  localMarkets: z.string().max(2000),
  keywords: z.string().max(7000),
  instructions: z.string().trim().max(6000),
  profileReviewed: z.boolean(),
});
export async function saveSeoSettings(
  context: DashboardContext,
  input: unknown,
) {
  await authorize(context, true);
  const p = settingsSchema.parse(input),
    markets = p.localMarkets
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
    keywords = [
      ...new Set(
        p.keywords
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
  if (
    markets.length > 8 ||
    markets.some((v) => v.length > 150) ||
    keywords.length > 50 ||
    keywords.some((v) => v.length > 120) ||
    !keywords.length
  )
    throw new SeoInputError(
      "Use up to eight service areas and 1–50 keywords, one per line.",
    );
  if (p.aiEnabled && !p.profileReviewed)
    throw new SeoInputError(
      "Review the business facts and service areas before starting paid SEO work.",
    );
  await seoTransaction(SEO_SITE_ID, async (db) => {
    if (p.aiEnabled) {
      const reviewed = await db.query("SELECT 1 FROM seo_managers WHERE site_id=$1 AND workspace_id=$2 AND ai_reviewed_at IS NOT NULL",[SEO_SITE_ID,context.workspace.id]);
      if (!reviewed.rowCount || !seoConfiguration().ai) throw new SeoInputError("Finish the model pilot and connect the SEO API key before enabling paid recommendations.");
    }
    await db.query(
      "UPDATE seo_managers SET enabled=$3,monthly_limit_micros=$4,local_markets=$5,keywords=$6,instructions=$7,profile_reviewed_at=CASE WHEN $8 THEN now() ELSE NULL END,ai_enabled=$9,updated_at=now() WHERE workspace_id=$1 AND site_id=$2",
      [
        context.workspace.id,
        SEO_SITE_ID,
        p.enabled,
        Math.round(p.budget * 1_000_000),
        markets,
        keywords,
        p.instructions,
        p.profileReviewed,
        p.aiEnabled,
      ],
    );
    await insertAuditLog(db, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "seo.settings.updated",
      targetType: "site",
      targetId: SEO_SITE_ID,
      metadata: {
        enabled: p.enabled,
        budgetMicros: Math.round(p.budget * 1_000_000),
      },
    });
  });
}
export async function pauseSeo(context: DashboardContext) {
  await authorize(context, true);
  await getDatabasePool().query(
    "UPDATE seo_managers SET ai_enabled=false,pilot_enabled=false,updated_at=now() WHERE site_id=$1 AND workspace_id=$2",
    [SEO_SITE_ID, context.workspace.id],
  );
}
export async function queueSeoRun(
  context: DashboardContext,
  kind: "monitor" | "strategy" | "research",
) {
  await authorize(context, true);
  if (kind === "research" && !seoConfiguration().research) throw new SeoInputError("City ranking checks are off. No external data account is needed.");
  return seoTransaction(SEO_SITE_ID, async (db) => {
    const manager = (await db.query("SELECT * FROM seo_managers WHERE site_id=$1 AND workspace_id=$2",[SEO_SITE_ID,context.workspace.id])).rows[0];
    if (kind !== "monitor" && (!manager?.ai_enabled || !manager?.ai_reviewed_at || !manager?.profile_reviewed_at || !seoConfiguration().ai))
      throw new SeoInputError("Connect the SEO key, complete the model pilot and enable paid recommendations first.");
    if (kind !== "monitor" && (await db.query("SELECT 1 FROM seo_costs WHERE site_id=$1 AND workspace_id=$2 AND status='uncertain' LIMIT 1",[SEO_SITE_ID,context.workspace.id])).rowCount)
      throw new SeoInputError("Review the uncertain provider charge before requesting more paid work.");
    const retry = await db.query("UPDATE seo_runs r SET status='queued',error_code=NULL,finished_at=NULL,next_attempt_at=now() WHERE r.id=(SELECT id FROM seo_runs WHERE site_id=$1 AND workspace_id=$2 AND kind=$3 AND status IN ('blocked','failed') ORDER BY created_at DESC LIMIT 1) AND NOT EXISTS(SELECT 1 FROM seo_costs c WHERE c.run_id=r.id AND (c.status='uncertain' OR (c.operation=r.stage AND c.attempted_at IS NOT NULL))) AND NOT EXISTS(SELECT 1 FROM seo_runs active WHERE active.site_id=r.site_id AND active.kind=r.kind AND active.status IN ('queued','running')) RETURNING r.id",[SEO_SITE_ID,context.workspace.id,kind]);
    if (retry.rowCount) return retry.rows[0].id;
    const existing = (
      await db.query<{ id: string }>(
        "SELECT id FROM seo_runs WHERE workspace_id=$1 AND site_id=$2 AND kind=$3 AND status IN ('queued','running') ORDER BY created_at LIMIT 1",
        [context.workspace.id, SEO_SITE_ID, kind],
      )
    ).rows[0];
    if (existing) return existing.id;
    const id = randomUUID();
    await db.query(
      "INSERT INTO seo_runs(id,workspace_id,site_id,kind,schedule_key,stage) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id,
        context.workspace.id,
        SEO_SITE_ID,
        kind,
        `manual:${id}`,
        kind === "monitor"
          ? "collect"
          : kind === "research"
            ? "research"
            : "plan",
      ],
    );
    await insertAuditLog(db, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "seo.run.queued",
      targetType: "seo_run",
      targetId: id,
      metadata: { kind },
    });
    return id;
  });
}
export async function getSeoChange(context: DashboardContext, id: string) {
  await authorize(context);
  if (!z.uuid().safeParse(id).success)
    throw new SeoInputError("SEO change unavailable.");
  const row = (
    await getDatabasePool().query<SeoChange>(
      "SELECT * FROM seo_changes WHERE workspace_id=$1 AND site_id=$2 AND id=$3",
      [context.workspace.id, SEO_SITE_ID, id],
    )
  ).rows[0];
  if (!row) throw new SeoInputError("SEO change unavailable.");
  return row;
}
const publicationSchema = z.object({
  id: z.uuid(),
  version: z.coerce.number().int().positive(),
  title: z.string().trim().min(10).max(90),
  description: z.string().trim().min(30).max(250),
  factChecked: z.boolean(),
});
export function validatePublicCopy(title: string, description: string) {
  if (
    /[<>]/.test(title + description) ||
    [...(title + description)].some((c) => c.charCodeAt(0) < 32)
  )
    throw new SeoInputError("Use plain text for public SEO wording.");
}
export async function publishSeoChange(
  context: DashboardContext,
  input: unknown,
) {
  await authorize(context, true);
  const p = publicationSchema.parse(input);
  validatePublicCopy(p.title, p.description);
  if (!p.factChecked)
    throw new SeoInputError(
      "Review the final wording against the page's facts before publishing.",
    );
  const change = await getSeoChange(context, p.id);
  if (
    change.status !== "ready" ||
    !change.review?.approved ||
    !managedPath(change.path)
  )
    throw new SeoInputError("This change is not ready for publication.");
  const observedPublication =
    (
      await getDatabasePool().query(
        "SELECT change_id FROM seo_publications WHERE site_id=$1 AND path=$2",
        [SEO_SITE_ID, change.path],
      )
    ).rows[0]?.change_id || null;
  const current = await readPublicPage(change.path),
    snapshot = parsePage(change.path, current.body, current.status);
  if (
    snapshot.status !== 200 ||
    snapshot.fingerprint !== change.baseline.fingerprint
  ) {
    await getDatabasePool().query(
      "UPDATE seo_changes SET status='stale',version=version+1 WHERE id=$1 AND workspace_id=$2 AND site_id=$3 AND status='ready' AND version=$4",
      [p.id, context.workspace.id, SEO_SITE_ID, p.version],
    );
    throw new SeoInputError(
      "This page changed after the proposal. Scan and plan again before publishing.",
    );
  }
  const metrics = await seoMetrics(
    context.workspace.id,
    SEO_SITE_ID,
    change.path,
  );
  await seoTransaction(SEO_SITE_ID, async (db) => {
    const access = await db.query(
      "SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2 AND status='active' AND role IN ('owner','admin') FOR SHARE",
      [context.workspace.id, context.user.id],
    );
    if (!access.rowCount)
      throw new SeoInputError(
        "Your publishing access changed. Reload before continuing.",
      );
    const locked = (
      await db.query<SeoChange>(
        "SELECT * FROM seo_changes WHERE id=$1 AND workspace_id=$2 AND site_id=$3 FOR UPDATE",
        [p.id, context.workspace.id, SEO_SITE_ID],
      )
    ).rows[0];
    if (!locked || locked.version !== p.version || locked.status !== "ready")
      throw new SeoInputError(
        "A teammate already changed this proposal. Reload before continuing.",
      );
    const prior =
      (
        await db.query(
          "SELECT change_id FROM seo_publications WHERE site_id=$1 AND path=$2",
          [SEO_SITE_ID, change.path],
        )
      ).rows[0]?.change_id || null;
    if (prior !== observedPublication)
      throw new SeoInputError(
        "A teammate changed the active publication. Reload and scan before continuing.",
      );
    await db.query(
      "UPDATE seo_changes SET title=$2,description=$3,status='published',version=version+1,reviewed_by_user_id=$4,human_reviewed_at=now(),previous_change_id=$5,baseline_metrics=$6,published_at=now(),evaluation_due_at=now()+interval '28 days' WHERE id=$1",
      [
        p.id,
        p.title,
        p.description,
        context.user.id,
        prior,
        JSON.stringify(metrics),
      ],
    );
    await db.query(
      "INSERT INTO seo_publications(workspace_id,site_id,path,change_id) VALUES($1,$2,$3,$4) ON CONFLICT(site_id,path) DO UPDATE SET change_id=EXCLUDED.change_id,updated_at=now()",
      [context.workspace.id, SEO_SITE_ID, change.path, p.id],
    );
    await db.query(
      "INSERT INTO seo_runs(id,workspace_id,site_id,kind,schedule_key,stage,context) VALUES($1,$2,$3,'verify',$4,'verify',$5)",
      [
        randomUUID(),
        context.workspace.id,
        SEO_SITE_ID,
        `publication:${p.id}`,
        JSON.stringify({ changeId: p.id }),
      ],
    );
    await insertAuditLog(db, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "seo.change.published",
      targetType: "seo_change",
      targetId: p.id,
      metadata: { path: change.path, version: p.version + 1 },
    });
  });
  return change.path;
}
export async function rollbackSeoChange(context: DashboardContext, id: string) {
  await authorize(context, true);
  return rollbackPublication(
    context.workspace.id,
    SEO_SITE_ID,
    id,
    context.user.id,
  );
}
export async function rollbackPublication(
  workspace: string,
  site: string,
  id: string,
  actor: string | null = null,
) {
  return seoTransaction(site, async (db) => {
    const c = (
      await db.query<SeoChange>(
        "SELECT * FROM seo_changes WHERE id=$1 AND workspace_id=$2 AND site_id=$3 FOR UPDATE",
        [id, workspace, site],
      )
    ).rows[0];
    if (!c) throw new SeoInputError("SEO change unavailable.");
    const active = (
      await db.query(
        "SELECT change_id FROM seo_publications WHERE site_id=$1 AND path=$2 FOR UPDATE",
        [site, c.path],
      )
    ).rows[0];
    if (active?.change_id !== id)
      throw new SeoInputError(
        "A newer publication is active. Review that version before rolling back.",
      );
    if (c.previous_change_id)
      await db.query(
        "UPDATE seo_publications SET change_id=$3,updated_at=now() WHERE site_id=$1 AND path=$2",
        [site, c.path, c.previous_change_id],
      );
    else
      await db.query(
        "DELETE FROM seo_publications WHERE site_id=$1 AND path=$2",
        [site, c.path],
      );
    await db.query(
      "UPDATE seo_changes SET status='rolled_back',version=version+1 WHERE id=$1",
      [id],
    );
    await insertAuditLog(db, {
      workspaceId: workspace,
      actorUserId: actor,
      action: "seo.change.rolled_back",
      targetType: "seo_change",
      targetId: id,
      metadata: { path: c.path },
    });
    return c.path;
  });
}
export async function rejectSeoChange(context: DashboardContext, id: string) {
  await authorize(context, true);
  await getDatabasePool().query(
    "UPDATE seo_changes SET status='rejected',version=version+1 WHERE id=$1 AND workspace_id=$2 AND site_id=$3 AND status IN ('proposed','ready')",
    [id, context.workspace.id, SEO_SITE_ID],
  );
}
export async function reconcileSeoCost(
  context: DashboardContext,
  input: unknown,
) {
  await authorize(context, true);
  const p = z
    .object({
      id: z.uuid(),
      actual: z.coerce.number().finite().min(0).max(1000),
      reference: z.string().trim().min(3).max(200),
    })
    .parse(input);
  const row = (
    await getDatabasePool().query(
      "SELECT id FROM seo_costs WHERE id=$1 AND workspace_id=$2 AND site_id=$3 AND status='uncertain'",
      [p.id, context.workspace.id, SEO_SITE_ID],
    )
  ).rows[0];
  if (!row)
    throw new SeoInputError("This charge is not awaiting reconciliation.");
  await settleCost(p.id, Math.ceil(p.actual * 1_000_000), p.reference, {
    reconciledBy: context.user.id,
  });
}
export function canonicalSeoTarget() {
  return SEO_ORIGIN;
}
