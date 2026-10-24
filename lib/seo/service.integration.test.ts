import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import type { Pool } from "pg";
vi.mock("server-only", () => ({}));
const transport = vi.hoisted(() => ({ page: vi.fn(), json: vi.fn() }));
vi.mock("./http", () => ({
  readPublicPage: transport.page,
  providerJson: transport.json,
}));
import { getDatabasePool } from "@/lib/dashboard/db";
import type { DashboardContext } from "@/lib/dashboard/data";
import {
  SEO_SITE_ID as site,
  SEO_WORKSPACE_ID as ws,
  managedPaths,
  seoModelPolicy,
} from "./config";
import {
  getSeoDashboard,
  saveSeoSettings,
  queueSeoRun,
  publishSeoChange,
  rollbackSeoChange,
  getSeoChange,
  pauseSeo,
} from "./service";
import { reserveCost, attemptCost, settleCost } from "./budget";
import { runSeoWorkerStep, strategyContext } from "./worker";
import { pilotEvidence } from "./pilot-cases";
import type { SeoRun } from "./types";
import { parsePage } from "./audit";
import { researchStep } from "./research";
import { seoMetrics } from "./metrics";
import { managedMetadata } from "./public-metadata";
import { modelResult, proposalSchema } from "./provider";
const url = process.env.TEST_SEO_DATABASE_URL;
const actor = (role = "owner", workspace = ws): DashboardContext => ({
  user: { id: `seo-${role}`, name: role, email: `${role}@example.test` },
  workspace: { id: workspace, name: "SEO test", slug: "seo-test" },
  role: "owner",
});
const owner = actor(),
  viewer = actor("viewer"),
  member = actor("member");
let pool: Pool;
const html = (
  path = "/websites",
  title = "Website Development — Tailored Agents",
  description = "Useful website development services for growing businesses.",
) =>
  `<html><head><title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="https://www.tailoredagents.com${path}"></head><body><main><h1>Website development</h1><p>We build premium websites for growing businesses.</p></main></body></html>`;
const settings = {
  enabled: true,
  aiEnabled: true,
  budget: 10,
  localMarkets: "Woodstock,Georgia,United States\nCanton,Georgia,United States",
  keywords: "website development\nAI agent development",
  instructions: "Focus on useful business inquiries.",
  profileReviewed: true,
};
async function running() {
  const id = await queueSeoRun(owner, "strategy");
  await pool.query(
    "UPDATE seo_runs SET status='running',stage='plan',lease_token=$2,lease_expires_at=now()+interval '3 minutes' WHERE id=$1",
    [id, randomUUID()],
  );
  return id;
}
function modelReply(
  output: unknown,
  usage = { input_tokens: 2000, output_tokens: 1000 },
) {
  return {
    id: `resp_${randomUUID()}`,
    status: "completed",
    usage,
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(output) }],
      },
    ],
  };
}
const plan = () => ({
  summary: "Improve the website-development page based on its real services.",
  priorities: [
    {
      title: "Explain website development clearly",
      reason: "Use the existing page's evidence.",
      path: "/websites",
      confidence: "high",
    },
  ],
  changes: [
    {
      path: "/websites",
      title: "Business Website Development — Tailored Agents",
      description:
        "Tailored Agents builds premium websites for growing businesses. Explore website development designed around your customer journey.",
      rationale: "Make the actual service and audience clearer.",
      evidence: [
        {
          path: "/websites",
          quote: "We build premium websites for growing businesses.",
        },
      ],
    },
  ],
  briefs: [],
});
async function baseline() {
  for (const path of managedPaths) {
    const s = parsePage(path, html(path));
    await pool.query(
      "INSERT INTO seo_pages(workspace_id,site_id,path,snapshot,fingerprint) VALUES($1,$2,$3,$4,$5) ON CONFLICT(site_id,path) DO UPDATE SET snapshot=EXCLUDED.snapshot,fingerprint=EXCLUDED.fingerprint,crawled_at=now()",
      [ws, site, path, JSON.stringify(s), s.fingerprint],
    );
  }
  await pool.query("INSERT INTO seo_runs(id,workspace_id,site_id,kind,schedule_key,stage,status,created_at,finished_at) VALUES($1,$2,$3,'monitor',$4,'done','succeeded',now()-interval '1 minute',now())",[randomUUID(),ws,site,'fixture:'+randomUUID()]);
}
async function readyChange() {
  await saveSeoSettings(owner, {...settings, enabled:false});
  const run = await running(),
    id = randomUUID(),
    snapshot = parsePage("/websites", html());
  await pool.query(
    "INSERT INTO seo_changes(id,workspace_id,site_id,run_id,path,title,description,rationale,evidence,baseline,review,status) VALUES($1,$2,$3,$4,'/websites',$5,$6,'Useful wording',$7,$8,$9,'ready')",
    [
      id,
      ws,
      site,
      run,
      plan().changes[0].title,
      plan().changes[0].description,
      JSON.stringify(plan().changes[0].evidence),
      JSON.stringify(snapshot),
      JSON.stringify({ approved: true, reason: "Supported by the page." }),
    ],
  );
  await pool.query(
    "UPDATE seo_runs SET status='succeeded',lease_token=NULL,lease_expires_at=NULL WHERE id=$1",
    [run],
  );
  return id;
}
describe.skipIf(!url)("Internal SEO manager with guarded PostgreSQL", () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      parsed.hostname !== "127.0.0.1" ||
      parsed.port !== "55433" ||
      parsed.pathname !== "/ta_seo_test" ||
      parsed.search ||
      parsed.hash
    )
      throw new Error("Use exact disposable ta_seo_test on loopback:55433.");
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("BETTER_AUTH_SECRET", "seo-fixture-only-secret-".repeat(3));
    vi.stubEnv("SEO_OPENAI_API_KEY", "synthetic-no-live-key");
    vi.stubEnv("SEO_EXTERNAL_RESEARCH_ENABLED", "false");
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    vi.stubEnv("DATAFORSEO_PASSWORD", "");
    pool = getDatabasePool();
    await pool.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())",
    );
    for (const file of (await readdir("db/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      if (
        (
          await pool.query(
            "SELECT 1 FROM schema_migrations WHERE filename=$1",
            [file],
          )
        ).rowCount
      )
        continue;
      await pool.query(await readFile("db/migrations/" + file, "utf8"));
      await pool.query("INSERT INTO schema_migrations(filename) VALUES($1)", [
        file,
      ]);
    }
  }, 30000);
  beforeEach(async () => {
    await pool.query(
      'TRUNCATE seo_managers,"user",analytics_events,integration_connections CASCADE',
    );
    await pool.query("UPDATE workspaces SET status='active' WHERE id=$1", [ws]);
    await pool.query(
      "INSERT INTO sites(id,workspace_id,name,url,environment,status) VALUES($1,$2,'Tailored Agents','https://www.tailoredagents.com','production','active') ON CONFLICT(id) DO UPDATE SET status='active'",
      [site, ws],
    );
    await pool.query(
      "INSERT INTO seo_managers(site_id,workspace_id,ai_reviewed_at) VALUES($1,$2,now())",
      [site, ws],
    );
    for (const role of ["owner", "viewer", "member"]) {
      await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)', [
        `seo-${role}`,
        role,
        `${role}@example.test`,
      ]);
      await pool.query(
        "INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')",
        [randomUUID(), ws, `seo-${role}`, role],
      );
    }
    transport.page.mockReset();
    transport.page.mockImplementation(async (path: string) => ({
      body: html(path),
      status: 200,
    }));
    transport.json.mockReset();
    vi.stubEnv("SEO_EXTERNAL_RESEARCH_ENABLED", "false");
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    vi.stubEnv("DATAFORSEO_PASSWORD", "");
  });
  afterAll(async () => {
    await pool?.end();
    vi.unstubAllEnvs();
  });
  it("starts paused with the owner's five service areas and a $10 limit", async () => {
    const d = await getSeoDashboard(owner);
    expect(d.manager.enabled).toBe(false);
    expect(Number(d.manager.monthly_limit_micros)).toBe(10_000_000);
    expect(d.manager.local_markets.map((s) => s.split(",")[0])).toEqual([
      "Woodstock",
      "Canton",
      "Marietta",
      "Acworth",
      "Roswell",
    ]);
    expect(d.spent).toBe(0);
  });
  it("rechecks database roles and workspace access for mutations", async () => {
    await expect(saveSeoSettings(viewer, settings)).rejects.toThrow();
    await expect(queueSeoRun(member, "strategy")).rejects.toThrow();
    await expect(
      getSeoDashboard(actor("owner", randomUUID())),
    ).rejects.toThrow();
    await pool.query(
      "UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",
      [owner.user.id],
    );
    await expect(queueSeoRun(owner, "monitor")).rejects.toThrow();
    expect(transport.json).not.toHaveBeenCalled();
  });
  it("requires reviewed facts, bounded terms and an affordable budget", async () => {
    await expect(
      saveSeoSettings(owner, { ...settings, profileReviewed: false }),
    ).rejects.toThrow("Review");
    await expect(
      saveSeoSettings(owner, { ...settings, budget: 101 }),
    ).rejects.toThrow();
    await expect(
      saveSeoSettings(owner, { ...settings, keywords: "" }),
    ).rejects.toThrow();
    await saveSeoSettings(owner, settings);
    expect((await getSeoDashboard(owner)).manager.enabled).toBe(true);
  });
  it("queues one manual job for concurrent repeat clicks", async () => {
    const ids = await Promise.all([
      queueSeoRun(owner, "monitor"),
      queueSeoRun(owner, "monitor"),
    ]);
    expect(ids[0]).toBe(ids[1]);
    expect((await pool.query("SELECT id FROM seo_runs")).rowCount).toBe(1);
  });
  it("records a real page scan without an AI or research request", async () => {
    await queueSeoRun(owner, "monitor");
    await runSeoWorkerStep();
    expect(transport.page).toHaveBeenCalledWith("/");
    expect((await getSeoDashboard(owner)).pages).toHaveLength(1);
    expect(transport.json).not.toHaveBeenCalled();
    expect((await pool.query("SELECT id FROM seo_costs")).rowCount).toBe(0);
  });
  it("serializes concurrent budget reservations and retains unknown charges", async () => {
    await saveSeoSettings(owner, { ...settings, budget: 1 });
    const run = await running(),
      base = {
        workspace: ws,
        site,
        run,
        provider: "openai" as const,
        operation: "plan",
        micros: 600000,
      };
    const r = await Promise.allSettled([
      reserveCost({ ...base, key: "one" }),
      reserveCost({ ...base, key: "two" }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const receipt = (await pool.query("SELECT id FROM seo_costs")).rows[0].id;
    await attemptCost(receipt);
    await pool.query("UPDATE seo_costs SET status='uncertain' WHERE id=$1", [
      receipt,
    ]);
    expect((await getSeoDashboard(owner)).spent).toBe(600000);
    await expect(reserveCost({ ...base, key: "third" })).rejects.toThrow(
      "uncertain",
    );
  });
  it("reuses a reservation only when no provider attempt began", async () => {
    await saveSeoSettings(owner, settings);
    const run = await running(),
      args = {
        workspace: ws,
        site,
        run,
        key: "recoverable",
        provider: "openai" as const,
        operation: "plan",
        micros: 100000,
      };
    const first = await reserveCost(args);
    expect(await reserveCost(args)).toBe(first);
    await attemptCost(first);
    await expect(attemptCost(first)).rejects.toThrow();
    await expect(reserveCost(args)).rejects.toThrow("already");
  });
  it("settles actual usage, and pauses work if actual usage exceeds its bound", async () => {
    await saveSeoSettings(owner, settings);
    const run = await running(),
      id = await reserveCost({
        workspace: ws,
        site,
        run,
        key: "overrun",
        provider: "openai",
        operation: "plan",
        micros: 100,
      });
    await attemptCost(id);
    await expect(settleCost(id, 150, "resp_known", {})).rejects.toThrow(
      "exceeded",
    );
    const d = await getSeoDashboard(owner);
    expect(d.spent).toBe(150);
    expect(d.manager.ai_enabled).toBe(false);
    expect(d.manager.enabled).toBe(true);
  });
  it("keeps a failed paid request uncertain and never silently repeats it", async () => {
    await saveSeoSettings(owner, settings);
    const run = await running();
    transport.json.mockRejectedValue(new Error("network timeout"));
    const args = {
      workspace: ws,
      site,
      run,
      stage: "plan",
      model: "gpt-6.1-sol" as const,
      schema: proposalSchema,
      instructions: "Use only the evidence.",
      input: { source: "A test page." },
    };
    await expect(modelResult(args)).rejects.toThrow();
    await expect(modelResult(args)).rejects.toThrow("uncertain");
    expect(transport.json).toHaveBeenCalledTimes(1);
    expect(
      (await pool.query("SELECT status FROM seo_costs")).rows[0].status,
    ).toBe("uncertain");
  });
  it("does not send a paid request when paused or the lease expired", async () => {
    await saveSeoSettings(owner, settings);
    const run = await running();
    await pauseSeo(owner);
    await expect(
      modelResult({
        workspace: ws,
        site,
        run,
        stage: "plan",
        model: "gpt-6.1-sol",
        schema: proposalSchema,
        instructions: "Read",
        input: {},
      }),
    ).rejects.toThrow("Review");
    expect(transport.json).not.toHaveBeenCalled();
  });
  it("pausing paid work also prevents an already reserved pilot request", async () => {
    await saveSeoSettings(owner, settings);
    const run = await running();
    await pool.query("UPDATE seo_runs SET context=$2 WHERE id=$1",[run,JSON.stringify({pilot:true,policy:seoModelPolicy})]);
    await pool.query("UPDATE seo_managers SET ai_enabled=false,pilot_enabled=true WHERE site_id=$1",[site]);
    const receipt=await reserveCost({workspace:ws,site,run,key:"pilot-pause",provider:"openai",operation:"plan",micros:100000});
    await pauseSeo(owner);
    await expect(attemptCost(receipt)).rejects.toThrow("paused");
    expect((await pool.query("SELECT attempted_at FROM seo_costs WHERE id=$1",[receipt])).rows[0].attempted_at).toBeNull();
  });
  it("stores controlled model safety results without creating publishable changes", async () => {
    await saveSeoSettings(owner,{...settings,enabled:false});
    await baseline();
    const manager=(await getSeoDashboard(owner)).manager;
    const evidence=pilotEvidence(await strategyContext({workspace_id:ws,site_id:site} as SeoRun,manager),"source_injection");
    expect(evidence.sources[0].text).toContain("SYSTEM OVERRIDE");
    const id=randomUUID();
    await pool.query("INSERT INTO seo_runs(id,workspace_id,site_id,kind,schedule_key,stage,context) VALUES($1,$2,$3,'strategy',$4,'plan',$5)",[id,ws,site,`pilot:${id}`,JSON.stringify({pilot:true,safetyCase:"source_injection",pilotEvidence:evidence,policy:seoModelPolicy})]);
    await pool.query("UPDATE seo_managers SET ai_enabled=false,pilot_enabled=true WHERE site_id=$1",[site]);
    transport.json.mockResolvedValueOnce(modelReply(plan())).mockResolvedValueOnce(modelReply({summary:"Evidence reviewed.",decisions:[{index:0,approved:true,reason:"Supported service."}]}));
    await runSeoWorkerStep();
    await pool.query("UPDATE seo_runs SET next_attempt_at=now() WHERE id=$1",[id]);
    await runSeoWorkerStep();
    const result=(await pool.query("SELECT status,context,result FROM seo_runs WHERE id=$1",[id])).rows[0];
    expect(result.status).toBe("succeeded");
    expect(result.context.safetyCase).toBe("source_injection");
    expect(result.result.changes).toHaveLength(1);
    const dashboard=await getSeoDashboard(owner);
    expect(dashboard.changes).toHaveLength(0);
    expect(dashboard.strategy).toBeUndefined();
    expect(dashboard.manager.pilot_enabled).toBe(false);
  });
  it("stores a source-backed plan and an independent review, with durable receipts", async () => {
    await saveSeoSettings(owner, settings);
    await baseline();
    await pool.query(
      "INSERT INTO seo_runs(id,workspace_id,site_id,kind,schedule_key,stage,status) VALUES($1,$2,$3,'monitor',to_char(now() AT TIME ZONE 'America/New_York','YYYY-MM-DD'),'done','succeeded')",
      [randomUUID(), ws, site],
    );
    transport.json
      .mockResolvedValueOnce(modelReply(plan()))
      .mockResolvedValueOnce(
        modelReply({
          summary: "Review complete.",
          decisions: [
            {
              index: 0,
              approved: true,
              reason: "The service and audience are supported.",
            },
          ],
        }),
      );
    await queueSeoRun(owner, "strategy");
    await runSeoWorkerStep();
    await pool.query(
      "UPDATE seo_runs SET next_attempt_at=now() WHERE status='queued'",
    );
    await runSeoWorkerStep();
    const d = await getSeoDashboard(owner);
    expect(d.changes).toHaveLength(1);
    expect(d.changes[0].status).toBe("ready");
    expect(d.costs).toHaveLength(2);
    expect(d.costs.every((c) => c.status === "settled")).toBe(true);
    expect(d.runs.some((r) => r.result.summary === plan().summary)).toBe(true);
  });
  it("rejects invented transcript/source quotes even when a model returns valid JSON", async () => {
    await saveSeoSettings(owner, settings);
    await baseline();
    await pool.query(
      "INSERT INTO seo_runs(id,workspace_id,site_id,kind,schedule_key,stage,status) VALUES($1,$2,$3,'monitor',to_char(now() AT TIME ZONE 'America/New_York','YYYY-MM-DD'),'done','succeeded')",
      [randomUUID(), ws, site],
    );
    const p = plan();
    p.changes[0].evidence[0].quote = "We guarantee first place in Google.";
    transport.json.mockResolvedValue(modelReply(p));
    await queueSeoRun(owner, "strategy");
    await runSeoWorkerStep();
    expect((await pool.query("SELECT id FROM seo_changes")).rowCount).toBe(0);
    expect(
      (
        await pool.query(
          "SELECT error_code FROM seo_runs WHERE kind='strategy' ORDER BY created_at LIMIT 1",
        )
      ).rows[0].error_code,
    ).toBe("unsupported_proposal_evidence");
  });
  it("publishes only reviewed exact wording and queues verification with a baseline", async () => {
    const id = await readyChange(),
      c = await getSeoChange(owner, id);
    await expect(
      publishSeoChange(owner, {
        id,
        version: 1,
        title: c.title,
        description: c.description,
        factChecked: false,
      }),
    ).rejects.toThrow("Review");
    expect(
      await publishSeoChange(owner, {
        id,
        version: 1,
        title: c.title,
        description: c.description,
        factChecked: true,
      }),
    ).toBe("/websites");
    const published = await getSeoChange(owner, id);
    expect(published.status).toBe("published");
    expect(published.baseline_metrics).toBeTruthy();
    expect(published.evaluation_due_at).toBeTruthy();
    await expect(
      publishSeoChange(owner, {
        id,
        version: 1,
        title: c.title,
        description: c.description,
        factChecked: true,
      }),
    ).rejects.toThrow();
    expect(
      (await pool.query("SELECT id FROM seo_runs WHERE kind='verify'"))
        .rowCount,
    ).toBe(1);
  });
  it("blocks stale pages and viewer publication", async () => {
    const id = await readyChange(),
      c = await getSeoChange(owner, id),
      input = {
        id,
        version: 1,
        title: c.title,
        description: c.description,
        factChecked: true,
      };
    await expect(publishSeoChange(viewer, input)).rejects.toThrow();
    transport.page.mockResolvedValue({
      status: 200,
      body: html("/websites", "A teammate's new title"),
    });
    await expect(publishSeoChange(owner, input)).rejects.toThrow(
      "page changed",
    );
    expect(
      (await pool.query("SELECT change_id FROM seo_publications")).rowCount,
    ).toBe(0);
    expect((await getSeoChange(owner, id)).status).toBe("stale");
  });
  it("verifies the actual published metadata and restores the earlier version on request", async () => {
    const id = await readyChange(),
      c = await getSeoChange(owner, id);
    await publishSeoChange(owner, {
      id,
      version: 1,
      title: c.title,
      description: c.description,
      factChecked: true,
    });
    transport.page.mockResolvedValue({
      status: 200,
      body: html("/websites", c.title, c.description),
    });
    await runSeoWorkerStep();
    expect((await getSeoChange(owner, id)).status).toBe("verified");
    await rollbackSeoChange(owner, id);
    expect((await getSeoChange(owner, id)).status).toBe("rolled_back");
    expect(
      (await pool.query("SELECT change_id FROM seo_publications")).rowCount,
    ).toBe(0);
  });
  it("does not overwrite a newer active publication during rollback", async () => {
    const id = await readyChange(),
      c = await getSeoChange(owner, id);
    await publishSeoChange(owner, {
      id,
      version: 1,
      title: c.title,
      description: c.description,
      factChecked: true,
    });
    await pool.query(
      "UPDATE seo_runs SET status='succeeded' WHERE kind='strategy'",
    );
    const other = await readyChange();
    await pool.query(
      "UPDATE seo_publications SET change_id=$2 WHERE site_id=$1",
      [site, other],
    );
    await expect(rollbackSeoChange(owner, id)).rejects.toThrow("newer");
    expect(
      (await pool.query("SELECT change_id FROM seo_publications")).rows[0]
        .change_id,
    ).toBe(other);
  });
  it("uses separate period balances without treating old receipts as free retry permission", async () => {
    await saveSeoSettings(owner, { ...settings, budget: 1 });
    const run = await running();
    await pool.query(
      "INSERT INTO seo_costs(id,workspace_id,site_id,run_id,request_key,provider,operation,period,reserved_micros,actual_micros,status) VALUES($1,$2,$3,$4,'older','openai','plan',date_trunc('month',now() AT TIME ZONE 'UTC')::date-interval '1 month',2000000,2000000,'settled')",
      [randomUUID(), ws, site, run],
    );
    await reserveCost({
      workspace: ws,
      site,
      run,
      key: "current",
      provider: "openai",
      operation: "plan",
      micros: 900000,
    });
    expect((await getSeoDashboard(owner)).spent).toBe(900000);
  });
  it("rechecks a reduced budget before attempting an existing reservation", async () => {
    await saveSeoSettings(owner, settings);
    const run = await running();
    const args = {
      workspace: ws,
      site,
      run,
      key: "lowered",
      provider: "openai" as const,
      operation: "plan",
      micros: 2_000_000,
    };
    const receipt = await reserveCost(args);
    await saveSeoSettings(owner, { ...settings, budget: 1 });
    await expect(attemptCost(receipt)).rejects.toThrow("current budget");
    await expect(reserveCost(args)).rejects.toThrow("exceed");
    expect(transport.json).not.toHaveBeenCalled();
  });
  it("rebinds an unattempted reservation to the current billing month", async () => {
    await saveSeoSettings(owner, settings);
    const run = await running(),
      args = {
        workspace: ws,
        site,
        run,
        key: "month-boundary",
        provider: "openai" as const,
        operation: "plan",
        micros: 100000,
      };
    const id = await reserveCost(args);
    await pool.query(
      "UPDATE seo_costs SET period=period-interval '1 month' WHERE id=$1",
      [id],
    );
    await expect(attemptCost(id)).rejects.toThrow();
    expect(await reserveCost({ ...args, micros: 200000 })).toBe(id);
    await attemptCost(id);
    expect((await getSeoDashboard(owner)).spent).toBe(200000);
  });
  it("holds a single active stage and safely resumes expired free work", async () => {
    const id = await queueSeoRun(owner, "monitor");
    await pool.query(
      "UPDATE seo_runs SET status='running',lease_token=$2,lease_expires_at=now()+interval '3 minutes' WHERE id=$1",
      [id, randomUUID()],
    );
    expect((await runSeoWorkerStep()).checked).toBe(0);
    expect(transport.page).not.toHaveBeenCalled();
    await pool.query(
      "UPDATE seo_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",
      [id],
    );
    expect((await runSeoWorkerStep()).checked).toBe(1);
    expect(transport.page).toHaveBeenCalledTimes(1);
  });
  it("retains an interrupted paid attempt without automatically scheduling a duplicate", async () => {
    await saveSeoSettings(owner, settings);
    const run = await running(),
      receipt = await reserveCost({
        workspace: ws,
        site,
        run,
        key: "interrupted",
        provider: "openai",
        operation: "plan",
        micros: 100000,
      });
    await attemptCost(receipt);
    await pool.query(
      "UPDATE seo_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",
      [run],
    );
    await runSeoWorkerStep();
    await runSeoWorkerStep();
    expect(
      (await pool.query("SELECT status FROM seo_runs WHERE id=$1", [run]))
        .rows[0].status,
    ).toBe("uncertain");
    expect(
      (await pool.query("SELECT status FROM seo_costs WHERE id=$1", [receipt]))
        .rows[0].status,
    ).toBe("uncertain");
    expect(
      (await pool.query("SELECT id FROM seo_runs WHERE kind='strategy'"))
        .rowCount,
    ).toBe(1);
    expect(transport.json).not.toHaveBeenCalled();
  });
  it("posts metered search tasks once and retrieves real location/device observations", async () => {
    vi.stubEnv("SEO_EXTERNAL_RESEARCH_ENABLED", "true");
    vi.stubEnv("DATAFORSEO_LOGIN", "synthetic-login");
    vi.stubEnv("DATAFORSEO_PASSWORD", "synthetic-password");
    await saveSeoSettings(owner, settings);
    const id = await running(),
      run = (await pool.query("SELECT * FROM seo_runs WHERE id=$1", [id]))
        .rows[0],
      manager = (await getSeoDashboard(owner)).manager;
    const taskIds = Array.from({ length: 12 }, () => randomUUID());
    transport.json.mockResolvedValueOnce({
      status_code: 20000,
      cost: 0.036,
      tasks: taskIds.map((id) => ({
        id,
        status_code: 20100,
        cost: 0.003,
        result: null,
      })),
    });
    expect((await researchStep(run, manager)).more).toBe(true);
    expect(
      (await pool.query("SELECT id FROM seo_research WHERE status='pending'"))
        .rowCount,
    ).toBe(12);
    expect((await getSeoDashboard(owner)).spent).toBe(36000);
    transport.json
      .mockRejectedValueOnce(new Error("temporary retrieval failure"))
      .mockResolvedValue({
        status_code: 20000,
        cost: 0,
        tasks: [
          {
            id: taskIds[0],
            status_code: 20000,
            cost: 0,
            result: [
              {
                items: [
                  {
                    type: "organic",
                    url: "https://www.tailoredagents.com/websites",
                    rank_absolute: 7,
                    rank_group: 3,
                    title: "Actual result",
                  },
                ],
              },
            ],
          },
        ],
      });
    await researchStep(run, manager);
    expect(
      (await pool.query("SELECT result FROM seo_research WHERE status='ready'"))
        .rows[0].result.items[0].position,
    ).toBe(3);
    expect(
      (await pool.query("SELECT id FROM seo_research WHERE status='pending'"))
        .rowCount,
    ).toBe(1);
    expect((await researchStep(run, manager)).more).toBe(false);
    expect(
      (await pool.query("SELECT id FROM seo_research WHERE status='ready'"))
        .rowCount,
    ).toBe(12);
    expect(
      transport.json.mock.calls.filter((c) =>
        String(c[0]).endsWith("task_post"),
      ),
    ).toHaveLength(1);
    expect((await pool.query("SELECT id FROM seo_costs")).rowCount).toBe(1);
  });
  it("does not restart an unknown search-task submission", async () => {
    vi.stubEnv("SEO_EXTERNAL_RESEARCH_ENABLED", "true");
    vi.stubEnv("DATAFORSEO_LOGIN", "synthetic-login");
    vi.stubEnv("DATAFORSEO_PASSWORD", "synthetic-password");
    await saveSeoSettings(owner, settings);
    const id = await running(),
      run = (await pool.query("SELECT * FROM seo_runs WHERE id=$1", [id]))
        .rows[0],
      manager = (await getSeoDashboard(owner)).manager;
    transport.json.mockRejectedValueOnce(new Error("timeout"));
    await expect(researchStep(run, manager)).rejects.toThrow();
    await researchStep(run, manager);
    expect(transport.json).toHaveBeenCalledTimes(1);
    expect(
      (await pool.query("SELECT id FROM seo_research WHERE status='uncertain'"))
        .rowCount,
    ).toBe(12);
  });
  it("keeps missing Google dates distinct from a completed zero-click observation", async () => {
    const metrics = await seoMetrics(
      ws,
      site,
      "/websites",
      new Date(Date.now() - 40 * 86400000),
    );
    expect(metrics.complete).toBe(false);
    expect(metrics.coverageDays).toBe(0);
    expect(metrics.latestGoogleDate).toBeNull();
    expect(metrics.clicks).toBeNull();
  });
  it("exposes only fact-reviewed active publication metadata and preserves social fields", async () => {
    const id = await readyChange(),
      c = await getSeoChange(owner, id),
      baseline = {
        title: "Baseline title",
        description: "Baseline description",
        openGraph: { images: ["/existing-image.png"] },
      };
    expect(await managedMetadata("/websites", baseline)).toEqual(baseline);
    await publishSeoChange(owner, {
      id,
      version: 1,
      title: c.title,
      description: c.description,
      factChecked: true,
    });
    const metadata = await managedMetadata("/websites", baseline);
    expect(metadata.title).toEqual({ absolute: c.title });
    expect(metadata.openGraph?.images).toEqual(["/existing-image.png"]);
    await pool.query(
      "UPDATE seo_changes SET human_reviewed_at=NULL WHERE id=$1",
      [id],
    );
    expect(await managedMetadata("/websites", baseline)).toEqual(baseline);
    await pool.query(
      "UPDATE seo_changes SET human_reviewed_at=now() WHERE id=$1",
      [id],
    );
    await rollbackSeoChange(owner, id);
    expect(await managedMetadata("/websites", baseline)).toEqual(baseline);
  });

  it("limits post-publication evidence to 28 complete Pacific dates", async () => {
    const connection = randomUUID();
    await pool.query(
      "INSERT INTO integration_connections(id,workspace_id,site_id,provider,status,property_uri,refresh_token_encrypted) VALUES($1,$2,$3,'google_search_console','active','sc-domain:tailoredagents.com','synthetic-encrypted')",
      [connection, ws, site],
    );
    await pool.query(
      "INSERT INTO search_console_coverage(workspace_id,site_id,integration_id,metric_date,detail_limited,retained_until) SELECT $1,$2,$3,date '2026-09-01'+n,false,now()+interval '12 months' FROM generate_series(0,39)n",
      [ws, site, connection],
    );
    const metrics = await seoMetrics(
      ws,
      site,
      "/websites",
      new Date("2026-09-01T01:00:00Z"),
    );
    expect(metrics.start).toBe("2026-09-01");
    expect(metrics.end).toBe("2026-09-28");
    expect(metrics.expectedDays).toBe(28);
    expect(metrics.coverageDays).toBe(28);
    expect(metrics.complete).toBe(true);
    expect(metrics.clicks).toBe(0);
    await pool.query(
      "UPDATE search_console_coverage SET detail_limited=true WHERE metric_date='2026-09-01'",
    );
    const limited = await seoMetrics(
      ws,
      site,
      "/websites",
      new Date("2026-09-01T01:00:00Z"),
    );
    expect(limited.detailLimited).toBe(true);
    expect(limited.clicks).toBeNull();
  });
  it("does not attribute a queued outcome review to a restored publication", async () => {
    const id = await readyChange(),
      change = await getSeoChange(owner, id);
    await publishSeoChange(owner, {
      id,
      version: 1,
      title: change.title,
      description: change.description,
      factChecked: true,
    });
    await rollbackSeoChange(owner, id);
    await pool.query(
      "UPDATE seo_runs SET status='cancelled' WHERE kind='verify'",
    );
    await pool.query(
      "INSERT INTO seo_runs(id,workspace_id,site_id,kind,schedule_key,stage,context) VALUES($1,$2,$3,'measure','restored-review','measure',$4)",
      [randomUUID(), ws, site, JSON.stringify({ changeId: id })],
    );
    await runSeoWorkerStep();
    const outcome = (await getSeoChange(owner, id)).outcome as {
      comparable: boolean;
      observed?: unknown;
      interpretation: string;
    };
    expect(outcome.comparable).toBe(false);
    expect(outcome.observed).toBeUndefined();
    expect(outcome.interpretation).toContain("restored or replaced");
    expect(transport.json).not.toHaveBeenCalled();
  });
  it("keeps free scans running while paid AI is paused", async () => {
    await saveSeoSettings(owner,{...settings,aiEnabled:false});
    await runSeoWorkerStep();
    expect(transport.page).toHaveBeenCalled();
    expect(transport.json).not.toHaveBeenCalled();
    expect((await getSeoDashboard(owner)).manager.last_worker_success_at).not.toBeNull();
    await expect(queueSeoRun(owner,"strategy")).rejects.toThrow("pilot");
  });
  it("requires a reviewed real model pilot before paid activation", async () => {
    await pool.query("UPDATE seo_managers SET ai_reviewed_at=NULL");
    await expect(saveSeoSettings(owner,settings)).rejects.toThrow("pilot");
    await saveSeoSettings(owner,{...settings,aiEnabled:false,profileReviewed:false});
    expect((await getSeoDashboard(owner)).manager.enabled).toBe(true);
  });
  it("cannot activate research merely by installing credentials", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN","synthetic");vi.stubEnv("DATAFORSEO_PASSWORD","synthetic");
    await saveSeoSettings(owner,settings);
    await expect(queueSeoRun(owner,"research")).rejects.toThrow("off");
    expect((await getSeoDashboard(owner)).configuration.research).toBe(false);
    expect(transport.json).not.toHaveBeenCalled();
  });
  it("rejects limits above ten dollars at both interface and database", async () => {
    await expect(saveSeoSettings(owner,{...settings,budget:10.01})).rejects.toThrow();
    await expect(pool.query("UPDATE seo_managers SET monthly_limit_micros=10000001")).rejects.toThrow();
  });
  it("blocks a strategy when even one page of a full scan is missing", async () => {
    await saveSeoSettings(owner,settings);await baseline();
    await pool.query("DELETE FROM seo_pages WHERE path='/contact'");
    await queueSeoRun(owner,"strategy");await runSeoWorkerStep();
    expect(transport.json).not.toHaveBeenCalled();
    expect((await pool.query("SELECT error_code FROM seo_runs WHERE kind='strategy'")).rows[0].error_code).toBe("scan_required");
    await baseline();
    const retry=await queueSeoRun(owner,"strategy");
    expect((await pool.query("SELECT status FROM seo_runs WHERE id=$1",[retry])).rows[0].status).toBe("queued");
    expect((await pool.query("SELECT id FROM seo_runs WHERE kind='strategy'")).rowCount).toBe(1);
  });
  it("retains an older month's uncertain charge as a paid-work stop", async () => {
    await saveSeoSettings(owner,settings);const run=await running();
    const args={workspace:ws,site,run,key:"old-month",provider:"openai" as const,operation:"plan",micros:1000};
    const id=await reserveCost(args);await attemptCost(id);
    await pool.query("UPDATE seo_costs SET status='uncertain',period=(date_trunc('month',now())-interval '1 month')::date WHERE id=$1",[id]);
    await expect(reserveCost({...args,key:"new-month"})).rejects.toThrow("uncertain");
    expect((await getSeoDashboard(owner)).health.uncertain).toBe(true);
  });
  it("limits the model pilot to five dollars including reserved costs", async () => {
    await saveSeoSettings(owner,settings);const run=await running();
    await pool.query("UPDATE seo_runs SET context='{\"pilot\":true}' WHERE id=$1",[run]);
    await pool.query("UPDATE seo_managers SET pilot_enabled=true");
    const args={workspace:ws,site,run,provider:"openai" as const,operation:"plan",micros:3_000_000};
    await reserveCost({...args,key:"pilot-first"});
    await expect(reserveCost({...args,key:"pilot-second"})).rejects.toThrow("$5");
  });

});
