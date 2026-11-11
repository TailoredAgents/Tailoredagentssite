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
  SeoStaleError,
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
        "SELECT id,provider,operation,status,reserved_micros,actual_micros,provider_id,created_at FROM seo_costs WHERE workspace_id=$1 AND site_id=$2 AND period=business_month() ORDER BY created_at DESC LIMIT 100",
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
      "SELECT COALESCE(sum(CASE WHEN status='settled' THEN actual_micros WHEN status IN ('reserved','uncertain') THEN reserved_micros ELSE 0 END),0)::text used FROM seo_costs WHERE workspace_id=$1 AND site_id=$2 AND period=business_month()",
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
    EXISTS(SELECT 1 FROM seo_runs r WHERE r.workspace_id=$1 AND r.site_id=$2 AND r.status IN ('failed','blocked','uncertain')
      AND r.context->>'safetyCase' IS NULL AND NOT EXISTS(SELECT 1 FROM seo_runs newer WHERE newer.workspace_id=r.workspace_id AND newer.site_id=r.site_id AND newer.kind=r.kind
        AND newer.created_at>r.created_at AND newer.context->>'safetyCase' IS NULL
        AND (r.kind NOT IN ('publish','verify','measure') OR newer.context->>'changeId'=r.context->>'changeId'))) AS unresolved,
    COALESCE(sum(actual_micros) FILTER(WHERE status='settled'),0)::text AS settled,
    COALESCE(sum(reserved_micros) FILTER(WHERE status IN ('reserved','uncertain')),0)::text AS reserved
    FROM seo_costs WHERE workspace_id=$1 AND site_id=$2 AND period=business_month()`,scope)).rows[0];
  const stale = !manager.last_worker_success_at || Date.now()-manager.last_worker_success_at.getTime()>20*60_000;
  const remaining = Math.max(0,Math.min(Number(manager.monthly_limit_micros),SEO_MONTHLY_MAX)-Number(spent));
  const status = health.uncertain ? "Needs attention" : stale && (manager.enabled || manager.ai_enabled) ? "Needs attention" :
    manager.pilot_enabled ? "Model pilot" : !manager.ai_enabled ? "Paid AI paused" : !seoConfiguration().ai ? "Needs connection" : remaining === 0 ? "Budget reached" : health.unresolved ? "Needs attention" : health.working ? "Working" : "Ready";
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
  autoPublish: z.boolean().default(false),
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
  if (p.autoPublish && (!p.enabled || !p.aiEnabled || !p.profileReviewed))
    throw new SeoInputError("Automatic publishing requires daily checks, weekly AI and reviewed business priorities.");
  await seoTransaction(SEO_SITE_ID, async (db) => {
    const access = await db.query("SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2 AND status='active' AND role IN ('owner','admin') FOR SHARE",[context.workspace.id,context.user.id]);
    if (!access.rowCount) throw new SeoInputError("Your SEO settings access changed. Reload before continuing.");
    if (p.aiEnabled) {
      const reviewed = await db.query("SELECT 1 FROM seo_managers WHERE site_id=$1 AND workspace_id=$2 AND ai_reviewed_at IS NOT NULL",[SEO_SITE_ID,context.workspace.id]);
      if (!reviewed.rowCount || !seoConfiguration().ai) throw new SeoInputError("Finish the model pilot and connect the SEO API key before enabling paid recommendations.");
    }
    await db.query(
      `UPDATE seo_managers SET enabled=$3,monthly_limit_micros=$4,local_markets=$5,keywords=$6,instructions=$7,profile_reviewed_at=CASE WHEN $8 THEN now() ELSE NULL END,ai_enabled=$9,
       auto_publish=$10,
       auto_grant_id=CASE WHEN NOT $10 THEN NULL WHEN auto_publish AND auto_authorized_by=$11 AND keywords=$6 AND instructions=$7 AND local_markets=$5 THEN auto_grant_id ELSE gen_random_uuid() END,
       auto_authorized_at=CASE WHEN NOT $10 THEN NULL WHEN auto_publish AND auto_authorized_by=$11 AND keywords=$6 AND instructions=$7 AND local_markets=$5 THEN auto_authorized_at ELSE now() END,
       auto_authorized_by=CASE WHEN $10 THEN $11 ELSE NULL END,updated_at=now() WHERE workspace_id=$1 AND site_id=$2`,
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
        p.autoPublish,
        context.user.id,
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
        aiEnabled: p.aiEnabled,
        automaticMetadataPublishing: p.autoPublish,
        budgetMicros: Math.round(p.budget * 1_000_000),
      },
    });
  });
}
export async function pauseSeo(context: DashboardContext) {
  await authorize(context, true);
  await seoTransaction(SEO_SITE_ID, db => db.query(
    "UPDATE seo_managers SET ai_enabled=false,pilot_enabled=false,auto_publish=false,auto_grant_id=NULL,auto_authorized_by=NULL,auto_authorized_at=NULL,updated_at=now() WHERE site_id=$1 AND workspace_id=$2",
    [SEO_SITE_ID, context.workspace.id],
  ));
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
  return publishMetadata(change, p, context.user.id);
}

// Worker-only entry point: a model's verdict is never a human approval. The
// current owner grant, originating strategy and worker lease are checked again
// at commit, including after all public-page reads.
async function automaticAuthority(db: Pick<PoolClient, "query">, change: SeoChange, run: SeoRun) {
  const row = await db.query<{ auto_authorized_by: string }>(
    `SELECT m.auto_authorized_by FROM seo_managers m
     JOIN workspace_memberships member ON member.workspace_id=m.workspace_id AND member.user_id=m.auto_authorized_by AND member.status='active' AND member.role IN ('owner','admin')
     JOIN sites s ON s.id=m.site_id AND s.workspace_id=m.workspace_id AND s.status='active'
     JOIN workspaces w ON w.id=m.workspace_id AND w.status='active'
     JOIN seo_runs source ON source.id=$3 AND source.workspace_id=m.workspace_id AND source.site_id=m.site_id
     JOIN seo_runs job ON job.id=$4 AND job.workspace_id=m.workspace_id AND job.site_id=m.site_id
     WHERE m.workspace_id=$1 AND m.site_id=$2 AND m.enabled AND m.ai_enabled AND m.ai_reviewed_at IS NOT NULL AND m.profile_reviewed_at IS NOT NULL
       AND m.auto_publish AND m.auto_grant_id::text=$5
       AND source.kind='strategy' AND source.status='succeeded' AND source.context->>'autoGrantId'=$5
       AND source.context->>'pilot' IS DISTINCT FROM 'true' AND source.context->>'safetyCase' IS NULL
       AND source.finished_at>=m.auto_authorized_at AND source.finished_at>now()-interval '2 days'
       AND job.kind='publish' AND job.status='running' AND job.lease_token=$6 AND job.lease_expires_at>now()
       AND job.context->>'changeId'=$7 AND job.context->>'autoGrantId'=$5
     FOR SHARE OF m,member,s,w,source,job`,
    [change.workspace_id,change.site_id,change.run_id,run.id,run.context.autoGrantId,run.lease_token,change.id],
  );
  if (!row.rowCount) throw new Error("automatic_authority_changed");
  return row.rows[0].auto_authorized_by;
}
export async function publishAutomaticSeoChange(run: SeoRun, change: SeoChange) {
  if (run.site_id !== SEO_SITE_ID || run.workspace_id !== SEO_WORKSPACE_ID || change.site_id !== run.site_id || change.workspace_id !== run.workspace_id)
    throw new Error("automatic_authority_changed");
  // Recover a crash after commit without creating another publication or receipt.
  if (["published","verified"].includes(change.status)) return change.path;
  const actor = await automaticAuthority(getDatabasePool(), change, run);
  const p = publicationSchema.parse({...change, factChecked:false});
  validatePublicCopy(p.title,p.description);
  if (change.baseline.issues.length) throw new Error("automatic_page_check_failed");
  // Recheck every cited source, including facts quoted from a different page.
  for (const path of new Set(change.evidence.map(e => e.path))) {
    if (!managedPath(path)) throw new Error("automatic_evidence_changed");
    const response = await readPublicPage(path), source = parsePage(path,response.body,response.status);
    if (source.status !== 200 || !change.evidence.filter(e => e.path===path).every(e => [source.text,source.title,source.description].some(text => text.includes(e.quote))))
      throw new Error("automatic_evidence_changed");
  }
  return publishMetadata(change,p,actor,run);
}
async function publishMetadata(change: SeoChange, p: z.infer<typeof publicationSchema>, actor: string, automaticRun?: SeoRun) {
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
      [p.id, change.workspace_id, SEO_SITE_ID, p.version],
    );
    throw new SeoStaleError(
      "This page changed after the proposal. Scan and plan again before publishing.",
    );
  }
  const metrics = await seoMetrics(
    change.workspace_id,
    SEO_SITE_ID,
    change.path,
  );
  await seoTransaction(SEO_SITE_ID, async (db) => {
    const access = await db.query(
      "SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2 AND status='active' AND role IN ('owner','admin') FOR SHARE",
      [change.workspace_id, actor],
    );
    if (!access.rowCount)
      throw new SeoInputError(
        "Your publishing access changed. Reload before continuing.",
      );
    if (automaticRun) await automaticAuthority(db,change,automaticRun);
    const locked = (
      await db.query<SeoChange>(
        "SELECT * FROM seo_changes WHERE id=$1 AND workspace_id=$2 AND site_id=$3 FOR UPDATE",
        [p.id, change.workspace_id, SEO_SITE_ID],
      )
    ).rows[0];
    if (!locked || locked.version !== p.version || locked.status !== "ready" || !locked.review?.approved)
      throw new SeoInputError(
        "A teammate already changed this proposal. Reload before continuing.",
      );
    if (automaticRun && (locked.title !== p.title || locked.description !== p.description ||
      (await db.query("SELECT 1 FROM seo_changes WHERE workspace_id=$1 AND site_id=$2 AND path=$3 AND id<>$4 AND (status='published' OR (status='verified' AND evaluation_due_at>now()))",[change.workspace_id,SEO_SITE_ID,change.path,change.id])).rowCount))
      throw new Error("automatic_observation_window");
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
      `UPDATE seo_changes SET title=$2,description=$3,status='published',version=version+1,
       reviewed_by_user_id=CASE WHEN $7 THEN NULL ELSE $4 END,human_reviewed_at=CASE WHEN $7 THEN NULL ELSE now() END,
       publication_mode=CASE WHEN $7 THEN 'automatic' ELSE 'manual' END,auto_authorized_by=CASE WHEN $7 THEN $4 ELSE NULL END,auto_grant_id=$8,
       previous_change_id=$5,baseline_metrics=$6,published_at=now(),evaluation_due_at=now()+interval '28 days' WHERE id=$1`,
      [
        p.id,
        p.title,
        p.description,
        actor,
        prior,
        JSON.stringify(metrics),
        Boolean(automaticRun),
        automaticRun?.context.autoGrantId || null,
      ],
    );
    await db.query(
      "INSERT INTO seo_publications(workspace_id,site_id,path,change_id) VALUES($1,$2,$3,$4) ON CONFLICT(site_id,path) DO UPDATE SET change_id=EXCLUDED.change_id,updated_at=now()",
      [change.workspace_id, SEO_SITE_ID, change.path, p.id],
    );
    await db.query(
      "INSERT INTO seo_runs(id,workspace_id,site_id,kind,schedule_key,stage,context) VALUES($1,$2,$3,'verify',$4,'verify',$5)",
      [
        randomUUID(),
        change.workspace_id,
        SEO_SITE_ID,
        `publication:${p.id}`,
        JSON.stringify({ changeId: p.id }),
      ],
    );
    await insertAuditLog(db, {
      workspaceId: change.workspace_id,
      actorUserId: actor,
      action: "seo.change.published",
      targetType: "seo_change",
      targetId: p.id,
      metadata: { path: change.path, version: p.version + 1, mode: automaticRun ? "automatic" : "manual", autoGrantId: automaticRun?.context.autoGrantId || null },
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
