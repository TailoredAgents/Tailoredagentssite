import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabasePool } from "@/lib/dashboard/db";
import {
  managedPaths,
  SEO_SITE_ID,
  SEO_WORKSPACE_ID,
  seoConfiguration,
  seoModelPolicy,
  type SeoModel,
} from "./config";
import { parsePage } from "./audit";
import { readPublicPage } from "./http";
import { businessProfile } from "./profile";
import {
  modelResult,
  proposalSchema,
  critiqueSchema,
  plannerInstructions,
  criticInstructions,
} from "./provider";
import { researchStep } from "./research";
import { seoMetrics } from "./metrics";
import {
  seoTransaction,
  rollbackPublication,
  publishAutomaticSeoChange,
  validatePublicCopy,
} from "./service";
import {
  SeoBudgetError,
  SeoStaleError,
  type SeoRun,
  type SeoManager,
  type SeoSnapshot,
  type SeoChange,
} from "./types";
async function progress(
  run: SeoRun,
  stage: string,
  context: unknown,
  status = "queued",
  result: unknown = {},
) {
  const r = await getDatabasePool().query(
    "UPDATE seo_runs SET stage=$3,context=$4,status=$5,result=$6,lease_token=NULL,lease_expires_at=NULL,finished_at=CASE WHEN $5='succeeded' THEN now() ELSE NULL END,next_attempt_at=now()+interval '2 seconds' WHERE id=$1 AND lease_token=$2 AND status='running' RETURNING id",
    [
      run.id,
      run.lease_token,
      stage,
      JSON.stringify(context),
      status,
      JSON.stringify(result),
    ],
  );
  if (!r.rowCount) throw new Error("worker_lease_changed");
}
async function schedule() {
  await seoTransaction(SEO_SITE_ID, async db => {
  const scope = [SEO_WORKSPACE_ID, SEO_SITE_ID];
  // Recover only the newest unpaid scan dependency, never replay paid requests
  // or resurrect every historical weekly failure.
  await db.query(`UPDATE seo_runs r SET status='queued',error_code=NULL,finished_at=NULL,next_attempt_at=now()
    FROM seo_managers m WHERE r.workspace_id=$1 AND r.site_id=$2 AND m.workspace_id=r.workspace_id AND m.site_id=r.site_id
    AND m.ai_enabled AND m.ai_reviewed_at IS NOT NULL AND r.kind='strategy' AND r.stage='plan' AND r.status='blocked' AND r.error_code='scan_required'
    AND r.context->>'pilot' IS DISTINCT FROM 'true' AND r.context->>'safetyCase' IS NULL
    AND r.id=(SELECT latest.id FROM seo_runs latest WHERE latest.workspace_id=r.workspace_id AND latest.site_id=r.site_id AND latest.kind='strategy' AND latest.context->>'pilot' IS DISTINCT FROM 'true' ORDER BY latest.created_at DESC,latest.id LIMIT 1)
    AND NOT EXISTS(SELECT 1 FROM seo_costs c WHERE c.run_id=r.id AND c.attempted_at IS NOT NULL)`,scope);
  // A new standing instruction/grant gets one fresh strategy automatically.
  // An in-flight strategy finishes first; never silently opt old copy into it.
  if (seoConfiguration().ai) await db.query(`INSERT INTO seo_runs(id,workspace_id,site_id,kind,schedule_key,stage)
    SELECT gen_random_uuid(),m.workspace_id,m.site_id,'strategy','grant:'||m.auto_grant_id,'plan'
    FROM seo_managers m WHERE m.workspace_id=$1 AND m.site_id=$2 AND m.enabled AND m.ai_enabled AND m.auto_publish
      AND m.ai_reviewed_at IS NOT NULL AND m.profile_reviewed_at IS NOT NULL AND m.auto_grant_id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM seo_runs r WHERE r.workspace_id=m.workspace_id AND r.site_id=m.site_id AND r.kind='strategy'
        AND (r.status IN ('queued','running') OR r.context->>'autoGrantId'=m.auto_grant_id::text))
    ON CONFLICT(workspace_id,site_id,kind,schedule_key) DO NOTHING`,scope);
  // A manual scan/run in the current period satisfies the automatic schedule.
  for (const kind of ["monitor", "strategy", "research"] as const) {
    if (kind === "research" && !seoConfiguration().research) continue;
    if (kind === "strategy" && !seoConfiguration().ai) continue;
    const period = kind === "monitor" ? "YYYY-MM-DD" : "IYYY-IW";
    await db.query(
      `INSERT INTO seo_runs(id,workspace_id,site_id,kind,schedule_key,stage)
   SELECT gen_random_uuid(),m.workspace_id,m.site_id,$3,to_char(now() AT TIME ZONE 'America/New_York',$4),$5
   FROM seo_managers m WHERE (CASE WHEN $3='monitor' THEN m.enabled ELSE m.ai_enabled AND m.ai_reviewed_at IS NOT NULL END) AND m.workspace_id=$1 AND m.site_id=$2
    AND ($3='monitor' OR m.profile_reviewed_at IS NOT NULL)
    AND NOT EXISTS(SELECT 1 FROM seo_runs r WHERE r.workspace_id=m.workspace_id AND r.site_id=m.site_id AND r.kind=$3
     AND (r.status IN ('queued','running') OR (r.status NOT IN ('cancelled') AND to_char(r.created_at AT TIME ZONE 'America/New_York',$4)=to_char(now() AT TIME ZONE 'America/New_York',$4))))
   ON CONFLICT(workspace_id,site_id,kind,schedule_key) DO NOTHING`,
      [
        ...scope,
        kind,
        period,
        kind === "monitor"
          ? "collect"
          : kind === "strategy"
            ? "plan"
            : "research",
      ],
    );
  }
  await db.query(
    "INSERT INTO seo_runs(id,workspace_id,site_id,kind,schedule_key,stage,context) SELECT gen_random_uuid(),workspace_id,site_id,'measure',id::text||':'||to_char(now(),'YYYY-MM-DD'),'measure',jsonb_build_object('changeId',id) FROM seo_changes WHERE workspace_id=$1 AND site_id=$2 AND status='verified' AND evaluation_due_at<=now() AND outcome IS NULL ON CONFLICT(workspace_id,site_id,kind,schedule_key) DO NOTHING",
    scope,
  );
  // Changed/revoked standing authority cannot authorize an older plan. Retain
  // those proposals as stale history so they do not block the next strategy.
  await db.query(`UPDATE seo_changes c SET status='stale',version=version+1 FROM seo_runs r,seo_managers m
    WHERE c.workspace_id=$1 AND c.site_id=$2 AND c.run_id=r.id AND m.site_id=c.site_id AND m.workspace_id=c.workspace_id AND c.status='ready'
    AND ((r.context->>'autoGrantId' IS DISTINCT FROM m.auto_grant_id::text AND (m.auto_publish OR r.context->>'autoGrantId' IS NOT NULL))
      OR (r.context->>'autoGrantId' IS NOT NULL AND r.finished_at<now()-interval '2 days'))`,scope);
  await db.query(`INSERT INTO seo_runs(id,workspace_id,site_id,kind,schedule_key,stage,context)
    SELECT gen_random_uuid(),c.workspace_id,c.site_id,'publish','automatic:'||c.id,'publish',jsonb_build_object('changeId',c.id,'autoGrantId',m.auto_grant_id)
    FROM seo_changes c JOIN seo_runs r ON r.id=c.run_id JOIN seo_managers m ON m.workspace_id=c.workspace_id AND m.site_id=c.site_id
    WHERE c.workspace_id=$1 AND c.site_id=$2 AND c.status='ready' AND c.review->>'approved'='true'
    AND r.status='succeeded' AND r.kind='strategy' AND r.context->>'pilot' IS DISTINCT FROM 'true' AND r.context->>'safetyCase' IS NULL
    AND m.auto_publish AND m.enabled AND m.ai_enabled AND r.context->>'autoGrantId'=m.auto_grant_id::text
    AND r.finished_at>now()-interval '2 days'
    ON CONFLICT(workspace_id,site_id,kind,schedule_key) DO NOTHING`,scope);
  });
}
async function claim() {
  return seoTransaction(SEO_SITE_ID, async (db) => {
    await db.query(
      "UPDATE seo_costs c SET status='uncertain' FROM seo_runs r WHERE c.run_id=r.id AND c.status='reserved' AND c.attempted_at IS NOT NULL AND r.status='running' AND r.lease_expires_at<now() AND r.workspace_id=$1 AND r.site_id=$2",
      [SEO_WORKSPACE_ID, SEO_SITE_ID],
    );
    await db.query(
      "UPDATE seo_runs r SET status=CASE WHEN EXISTS(SELECT 1 FROM seo_costs c WHERE c.run_id=r.id AND (c.status='uncertain' OR (c.operation=r.stage AND c.status='settled'))) THEN 'uncertain' ELSE 'queued' END,error_code='interrupted_run',lease_token=NULL,lease_expires_at=NULL WHERE r.status='running' AND r.lease_expires_at<now() AND r.workspace_id=$1 AND r.site_id=$2",
      [SEO_WORKSPACE_ID, SEO_SITE_ID],
    );
    if (
      (
        await db.query(
          "SELECT 1 FROM seo_runs WHERE site_id=$1 AND workspace_id=$2 AND status='running' AND lease_expires_at>now() LIMIT 1",
          [SEO_SITE_ID, SEO_WORKSPACE_ID],
        )
      ).rowCount
    )
      return null;
    const r = (
      await db.query<SeoRun>(
        `SELECT r.* FROM seo_runs r JOIN seo_managers m ON m.site_id=r.site_id AND m.workspace_id=r.workspace_id JOIN sites s ON s.id=m.site_id AND s.workspace_id=m.workspace_id JOIN workspaces w ON w.id=m.workspace_id
         WHERE r.workspace_id=$1 AND r.site_id=$2 AND r.status='queued' AND r.next_attempt_at<=now() AND s.status='active' AND w.status='active'
         AND (r.kind IN ('monitor','verify','measure','publish') OR (m.ai_enabled AND m.ai_reviewed_at IS NOT NULL) OR (m.pilot_enabled AND r.context->>'pilot'='true'))
         AND NOT (r.kind='strategy' AND r.stage='plan' AND r.context->>'pilot' IS DISTINCT FROM 'true' AND EXISTS(SELECT 1 FROM seo_runs scan WHERE scan.workspace_id=r.workspace_id AND scan.site_id=r.site_id AND scan.kind='monitor' AND scan.status IN ('queued','running')))
         ORDER BY CASE WHEN r.kind='verify' THEN 0 WHEN r.kind='monitor' THEN 1 WHEN r.kind='publish' THEN 2 ELSE 3 END,r.created_at LIMIT 1 FOR UPDATE OF r SKIP LOCKED`,
        [SEO_WORKSPACE_ID, SEO_SITE_ID],
      )
    ).rows[0];
    if (!r) return null;
    const token = randomUUID();
    await db.query(
      "UPDATE seo_runs SET status='running',lease_token=$2,lease_expires_at=now()+interval '3 minutes' WHERE id=$1",
      [r.id, token],
    );
    return { ...r, status: "running", lease_token: token };
  });
}
export async function strategyContext(run: SeoRun, manager: SeoManager) {
  const pool = getDatabasePool();
  const rows = (
    await pool.query<{ snapshot: SeoSnapshot; crawled_at: Date }>(
      "SELECT snapshot,crawled_at FROM seo_pages WHERE workspace_id=$1 AND site_id=$2 AND crawled_at>now()-interval '2 days' ORDER BY jsonb_array_length(snapshot->'issues') DESC,path LIMIT 14",
      [run.workspace_id, run.site_id],
    )
  ).rows;
  const completed = await pool.query("SELECT created_at,finished_at FROM seo_runs WHERE workspace_id=$1 AND site_id=$2 AND kind='monitor' AND status='succeeded' AND finished_at>now()-interval '2 days' ORDER BY finished_at DESC LIMIT 1",[run.workspace_id,run.site_id]);
  if (rows.length !== managedPaths.length || !completed.rowCount || rows.some(r => r.crawled_at < completed.rows[0].created_at || r.crawled_at > completed.rows[0].finished_at)) throw new Error("scan_required");
  const sources = rows.map((r) => ({
    ...r.snapshot,
    text: r.snapshot.text.slice(0, 2500),
    headings: r.snapshot.headings.slice(0, 8).map((h) => h.slice(0, 200)),
    links: r.snapshot.links.slice(0, 6).map((h) => h.slice(0, 300)),
    observedAt: r.crawled_at.toISOString(),
  }));
  const history = (
    await pool.query(
      "SELECT path,title,description,status,published_at,evaluation_due_at,outcome IS NOT NULL AS outcome_recorded FROM seo_changes WHERE workspace_id=$1 AND site_id=$2 ORDER BY created_at DESC LIMIT 8",
      [run.workspace_id, run.site_id],
    )
  ).rows;
  const research = (
    await pool.query(
      "SELECT keyword,location,device,result,checked_at FROM seo_research WHERE workspace_id=$1 AND site_id=$2 AND status='ready' AND checked_at>now()-interval '8 days' ORDER BY checked_at DESC LIMIT 6",
      [run.workspace_id, run.site_id],
    )
  ).rows.map((r) => ({
    ...r,
    result: { ...r.result, items: r.result.items?.slice(0, 5) },
  }));
  return {
    business: businessProfile(manager.local_markets),
    ownerInstructions: manager.instructions,
    priorityKeywords: manager.keywords,
    metrics: await seoMetrics(run.workspace_id, run.site_id),
    sources,
    history,
    research: seoConfiguration().research ? research : [],
    researchAvailable: seoConfiguration().research,
    asOf: new Date().toISOString(),
  };
}
async function work(run: SeoRun, manager: SeoManager, onMetadataChanged?: (path: string) => void) {
  const pool = getDatabasePool();
  if (run.kind === "monitor") {
    const index = Number(run.context.index || 0),
      path = managedPaths[index];
    if (!path) {
      await progress(run, "done", {}, "succeeded", {
        summary: "Registered public-page scan completed.",
      });
      return;
    }
    const response = await readPublicPage(path),
      snapshot = parsePage(path, response.body, response.status);
    await pool.query(
      "INSERT INTO seo_pages(workspace_id,site_id,path,snapshot,fingerprint) VALUES($1,$2,$3,$4,$5) ON CONFLICT(site_id,path) DO UPDATE SET snapshot=EXCLUDED.snapshot,fingerprint=EXCLUDED.fingerprint,crawled_at=now()",
      [
        run.workspace_id,
        run.site_id,
        path,
        JSON.stringify(snapshot),
        snapshot.fingerprint,
      ],
    );
    await progress(
      run,
      "collect",
      { index: index + 1 },
      index + 1 === managedPaths.length ? "succeeded" : "queued",
      {
        summary: `Scanned ${index + 1} of ${managedPaths.length} registered pages.`,
        scanned: index + 1,
      },
    );
    return;
  }
  if (run.kind === "research") {
    if (!seoConfiguration().research)
      throw new Error("research_not_configured");
    const result = await researchStep(run, manager);
    if (Date.now() - run.created_at.getTime() > 86400000)
      throw new Error("research_timed_out");
    await progress(run, "research", {}, result.more ? "queued" : "succeeded", {
      summary: result.more
        ? "Keyword research is collecting location/device observations."
        : "Keyword research collected; results are evidence for the next strategy.",
    });
    if (result.more)
      await pool.query(
        "UPDATE seo_runs SET next_attempt_at=now()+interval '2 minutes' WHERE id=$1",
        [run.id],
      );
    return;
  }
  if (run.kind === "strategy") {
    if (!seoConfiguration().ai) throw new Error("openai_not_configured");
    if (!manager.profile_reviewed_at) throw new Error("business_review_required");
    let policy = run.context.policy as Omit<typeof seoModelPolicy, "model"> & {model: SeoModel} | undefined;
    if (!policy && run.stage === "plan") {
      policy = seoModelPolicy;
      run.context = {...run.context, policy};
      await pool.query("UPDATE seo_runs SET context=$3 WHERE id=$1 AND lease_token=$2",[run.id,run.lease_token,JSON.stringify(run.context)]);
    }
    if (!policy || policy.version !== seoModelPolicy.version ||
        (policy.model !== seoModelPolicy.model && !(run.context.pilot === true && policy.model === "gpt-6-astra")))
      throw new Error("model_policy_review");
    if (run.stage === "plan") {
      run.context.autoGrantId = manager.auto_publish && run.context.pilot !== true ? manager.auto_grant_id : null;
      await pool.query("UPDATE seo_runs SET context=$3 WHERE id=$1 AND lease_token=$2",[run.id,run.lease_token,JSON.stringify(run.context)]);
      const context = run.context.pilot === true && run.context.pilotEvidence ? run.context.pilotEvidence as Awaited<ReturnType<typeof strategyContext>> : await strategyContext(run, manager),
        proposal = await modelResult({
          workspace: run.workspace_id,
          site: run.site_id,
          run: run.id,
          stage: "plan",
          model: policy.model,
          schema: proposalSchema,
          instructions: plannerInstructions,
          input: context,
        });
      const paths = new Set<string>();
      for (const change of proposal.changes) {
        const source = context.sources.find((s) => s.path === change.path);
        if (
          !source ||
          source.status !== 200 ||
          paths.has(change.path) ||
          !change.evidence.every((e) =>
            context.sources.some(
              (s) =>
                s.path === e.path &&
                (s.text.includes(e.quote) ||
                  s.title.includes(e.quote) ||
                  s.description.includes(e.quote)),
            ),
          )
        )
          throw new Error("unsupported_proposal_evidence");
        validatePublicCopy(change.title, change.description);
        paths.add(change.path);
      }
      await progress(run, "critique", { ...context, proposal, policy, pilot: run.context.pilot === true, safetyCase: run.context.safetyCase, autoGrantId: run.context.autoGrantId });
      return;
    }
    const proposal = proposalSchema.parse(run.context.proposal),
      sources = run.context.sources as (SeoSnapshot & { observedAt: string })[];
    const critique = proposal.changes.length || run.context.pilot === true
      ? await modelResult({
          workspace: run.workspace_id,
          site: run.site_id,
          run: run.id,
          stage: "critique",
          model: policy.model,
          schema: critiqueSchema,
          instructions: criticInstructions,
          input: run.context,
        })
      : {
          summary:
            "No metadata changes proposed. Strategy and content briefs are retained.",
          decisions: [],
        };
    if (
      critique.decisions.length !== proposal.changes.length ||
      new Set(critique.decisions.map((d) => d.index)).size !==
        proposal.changes.length ||
      critique.decisions.some((d) => d.index >= proposal.changes.length)
    )
      throw new Error("incomplete_critical_review");
    await seoTransaction(run.site_id, async (db) => {
      const leased = await db.query(
        "SELECT id FROM seo_runs WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_expires_at>now() FOR UPDATE",
        [run.id, run.lease_token],
      );
      if (!leased.rowCount) throw new Error("worker_lease_changed");
      for (let index = 0; index < proposal.changes.length; index++) {
        // Controlled adversarial evidence must never create publishable changes.
        if (run.context.safetyCase) continue;
        const c = proposal.changes[index],
          review = critique.decisions.find((d) => d.index === index)!,
          baseline = sources.find((s) => s.path === c.path)!;
        const recent = await db.query(
          "SELECT id FROM seo_changes WHERE workspace_id=$1 AND site_id=$2 AND path=$3 AND (status IN ('proposed','ready','published') OR (status='verified' AND evaluation_due_at>now()))",
          [run.workspace_id, run.site_id, c.path],
        );
        if (
          recent.rowCount ||
          (c.title === baseline.title && c.description === baseline.description)
        )
          continue;
        await db.query(
          "INSERT INTO seo_changes(id,workspace_id,site_id,run_id,path,title,description,rationale,evidence,baseline,review,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
          [
            randomUUID(),
            run.workspace_id,
            run.site_id,
            run.id,
            c.path,
            c.title,
            c.description,
            c.rationale,
            JSON.stringify(c.evidence),
            JSON.stringify(baseline),
            JSON.stringify(review),
            review.approved ? "ready" : "rejected",
          ],
        );
      }
      await db.query(
        "UPDATE seo_runs SET status='succeeded',stage='done',result=$3,context=jsonb_build_object('policy',context->'policy','pilot',context->'pilot','safetyCase',context->'safetyCase','autoGrantId',context->'autoGrantId'),lease_token=NULL,lease_expires_at=NULL,finished_at=now() WHERE id=$1 AND lease_token=$2",
        [
          run.id,
          run.lease_token,
          JSON.stringify({
            ...proposal,
            review: critique,
            planningEvidence: {
              version: seoModelPolicy.version,
              model: policy.model,
              business: run.context.business,
              asOf: run.context.asOf,
              metrics: run.context.metrics,
              sources: sources.map((s) => ({
                path: s.path,
                fingerprint: s.fingerprint,
                observedAt: s.observedAt,
              })),
            },
          }),
        ],
      );
    });
    return;
  }
  const id = String(run.context.changeId || "");
  const change = (
    await pool.query<SeoChange>(
      "SELECT * FROM seo_changes WHERE id=$1 AND workspace_id=$2 AND site_id=$3",
      [id, run.workspace_id, run.site_id],
    )
  ).rows[0];
  if (!change) throw new Error("change_unavailable");
  if (run.kind === "publish") {
    if (["stale","rejected","rolled_back"].includes(change.status) || !manager.auto_publish || run.context.autoGrantId !== manager.auto_grant_id) {
      await progress(run,"done",run.context,"succeeded",{summary:"Automatic publication skipped: the proposal or its standing authorization changed."});
      return;
    }
    const path = await publishAutomaticSeoChange(run,change);
    onMetadataChanged?.(path);
    await progress(run,"done",run.context,"succeeded",{summary:"Metadata published automatically under the owner's saved authorization. Live verification is queued."});
    return;
  }
  if (run.kind === "verify") {
    const active = (
      await pool.query(
        "SELECT change_id FROM seo_publications WHERE site_id=$1 AND path=$2",
        [run.site_id, change.path],
      )
    ).rows[0]?.change_id;
    if (active !== id) {
      await progress(run, "done", {}, "succeeded", {
        summary:
          "A different publication is active; the older change was not overwritten.",
      });
      return;
    }
    const response = await readPublicPage(change.path),
      snapshot = parsePage(change.path, response.body, response.status);
    if (
      snapshot.status === 200 &&
      snapshot.title === change.title &&
      snapshot.description === change.description
    ) {
      await pool.query(
        "UPDATE seo_changes SET status='verified',verified_at=now() WHERE id=$1 AND status='published'",
        [id],
      );
      await progress(run, "done", {}, "succeeded", {
        summary:
          "Published search title and description verified on the live page.",
      });
    } else if (Date.now() - run.created_at.getTime() < 15 * 60000) {
      await progress(run, "verify", { changeId: id }, "queued", {
        summary: "Waiting for the publication cache to refresh.",
      });
      await pool.query(
        "UPDATE seo_runs SET next_attempt_at=now()+interval '1 minute' WHERE id=$1",
        [run.id],
      );
    } else {
      await rollbackPublication(run.workspace_id, run.site_id, id);
      onMetadataChanged?.(change.path);
      await progress(run, "done", {}, "succeeded", {
        summary:
          "Published metadata did not verify. The previous version was restored.",
      });
    }
    return;
  }
  if (!change.published_at) throw new Error("change_not_published");
  const measuredPublication = (
    await pool.query(
      "SELECT change_id FROM seo_publications WHERE workspace_id=$1 AND site_id=$2 AND path=$3",
      [run.workspace_id, run.site_id, change.path],
    )
  ).rows[0]?.change_id;
  if (change.status !== "verified" || measuredPublication !== change.id) {
    const interpretation =
      "This publication was restored or replaced before its observation review. Its results are not comparable; no performance outcome is attributed to it.";
    await pool.query(
      "UPDATE seo_changes SET outcome=$2 WHERE id=$1 AND outcome IS NULL",
      [id, JSON.stringify({ comparable: false, interpretation })],
    );
    await progress(run, "done", {}, "succeeded", { summary: interpretation });
    return;
  }
  const outcome = await seoMetrics(
    run.workspace_id,
    run.site_id,
    change.path,
    change.published_at,
  );
  if (outcome.expectedDays < 28 || !outcome.complete) {
    await progress(run, "done", {}, "succeeded", {
      summary:
        "Google's finalized coverage has not reached the complete observation window yet.",
    });
    return;
  }
  await pool.query(
    "UPDATE seo_changes SET outcome=$2 WHERE id=$1 AND outcome IS NULL",
    [
      id,
      JSON.stringify({
        observed: outcome,
        baseline: change.baseline_metrics,
        interpretation:
          "Observed before/after evidence. This comparison does not establish that the change caused a ranking or inquiry difference.",
      }),
    ],
  );
  await progress(run, "done", {}, "succeeded", {
    summary:
      "The post-change search and measured inquiry evidence was recorded.",
  });
}
async function pendingWork() {
  const due = await getDatabasePool().query(
    `SELECT CASE WHEN count(*)=0 THEN NULL ELSE GREATEST(0,EXTRACT(EPOCH FROM (min(r.next_attempt_at)-now()))*1000)::float END wait_ms FROM seo_runs r JOIN seo_managers m ON m.workspace_id=r.workspace_id AND m.site_id=r.site_id
     JOIN sites s ON s.id=m.site_id AND s.workspace_id=m.workspace_id AND s.status='active'
     JOIN workspaces w ON w.id=m.workspace_id AND w.status='active'
     WHERE r.workspace_id=$1 AND r.site_id=$2 AND r.status='queued' AND (r.kind IN ('monitor','verify','measure','publish') OR (m.ai_enabled AND m.ai_reviewed_at IS NOT NULL) OR (m.pilot_enabled AND r.context->>'pilot'='true'))
     AND NOT (r.kind='strategy' AND r.stage='plan' AND r.context->>'pilot' IS DISTINCT FROM 'true' AND EXISTS(SELECT 1 FROM seo_runs scan WHERE scan.workspace_id=r.workspace_id AND scan.site_id=r.site_id AND scan.kind='monitor' AND scan.status IN ('queued','running')))`,
    [SEO_WORKSPACE_ID, SEO_SITE_ID],
  );
  const wait = due.rows[0]?.wait_ms;
  return {more: wait !== null && wait !== undefined && Number(wait) <= 2500, retryAfterMs: Number(wait) || 0};
}
export async function runSeoWorkerStep(options: {onMetadataChanged?: (path: string) => void} = {}) {
  await schedule();
  const pool = getDatabasePool();
  await pool.query(
    "UPDATE seo_managers SET last_worker_at=now() WHERE site_id=$1 AND workspace_id=$2",
    [SEO_SITE_ID, SEO_WORKSPACE_ID],
  );
  const run = await claim();
  const success = () => pool.query("UPDATE seo_managers SET last_worker_success_at=now() WHERE site_id=$1 AND workspace_id=$2",[SEO_SITE_ID,SEO_WORKSPACE_ID]);
  if (!run) { await success(); return { checked: 0, failed: 0, ...await pendingWork() }; }
  try {
    const manager = (
      await pool.query<SeoManager>(
        "SELECT * FROM seo_managers WHERE site_id=$1 AND workspace_id=$2",
        [run.site_id, run.workspace_id],
      )
    ).rows[0];
    await work(run, manager, options.onMetadataChanged);
    if (run.kind === "strategy" && run.stage === "critique") await schedule();
    if (run.context.pilot === true) await pool.query("UPDATE seo_managers SET pilot_enabled=false WHERE site_id=$1 AND workspace_id=$2 AND NOT EXISTS(SELECT 1 FROM seo_runs WHERE site_id=$1 AND workspace_id=$2 AND context->>'pilot'='true' AND status IN ('queued','running'))",[run.site_id,run.workspace_id]);
    await success();
  } catch (error) {
    const uncertain = Boolean(
      (
        await pool.query(
          "SELECT 1 FROM seo_costs WHERE run_id=$1 AND status='uncertain' LIMIT 1",
          [run.id],
        )
      ).rowCount,
    );
    const code =
      error instanceof SeoBudgetError
        ? "budget_or_receipt_review"
        : error instanceof SeoStaleError
          ? "proposal_stale"
        : error instanceof Error && /^[a-z_]{3,80}$/.test(error.message)
          ? error.message
          : "provider_or_worker_failure";
    if (run.kind === "publish" && ["proposal_stale","automatic_evidence_changed","automatic_page_check_failed","automatic_observation_window"].includes(code)) {
      await pool.query("UPDATE seo_changes SET status='stale',version=version+1 WHERE id=$1 AND workspace_id=$2 AND site_id=$3 AND status='ready'",[run.context.changeId,run.workspace_id,run.site_id]);
      await progress(run,"done",run.context,"succeeded",{summary:"Publication skipped because current evidence or page checks changed. A future strategy can prepare a fresh proposal.",reason:code});
      await success();
      return {checked:1,failed:0,...await pendingWork()};
    }
    if (code === "scan_required" && !uncertain && run.kind === "strategy" && run.stage === "plan") {
      await seoTransaction(run.site_id, async db => {
        await db.query("UPDATE seo_runs SET status='queued',error_code=NULL,result=$3,lease_token=NULL,lease_expires_at=NULL,finished_at=NULL,next_attempt_at=now()+interval '1 minute' WHERE id=$1 AND lease_token=$2",[run.id,run.lease_token,JSON.stringify({summary:"Waiting for a complete, current website scan. Planning will resume automatically."})]);
        await db.query(`INSERT INTO seo_runs(id,workspace_id,site_id,kind,schedule_key,stage)
          SELECT gen_random_uuid(),$1,$2,'monitor',$3,'collect' WHERE NOT EXISTS(SELECT 1 FROM seo_runs WHERE workspace_id=$1 AND site_id=$2 AND kind='monitor' AND status IN ('queued','running'))
          ON CONFLICT(workspace_id,site_id,kind,schedule_key) DO NOTHING`,[run.workspace_id,run.site_id,`scan:${run.id}:${new Date().toISOString().slice(0,10)}`]);
      });
      await success();
      return {checked:1,failed:0,more:true,retryAfterMs:0};
    }
    await pool.query(
      "UPDATE seo_runs SET status=$3,error_code=$4,lease_token=NULL,lease_expires_at=NULL,finished_at=now() WHERE id=$1 AND lease_token=$2",
      [
        run.id,
        run.lease_token,
        uncertain
          ? "uncertain"
          : error instanceof SeoBudgetError ||
              [
                "openai_not_configured",
                "research_not_configured",
                "scan_required",
                "business_review_required",
                "model_policy_review",
              ].includes(code)
            ? "blocked"
            : "failed",
        code,
      ],
    );
    return { checked: 1, failed: 1, more: true, retryAfterMs: 0 };
  }
  return {
    checked: 1,
    failed: 0,
    ...await pendingWork(),
  };
}
