import {
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({
  context: null as import("@/lib/dashboard/data").DashboardContext | null,
}));
vi.mock("@/lib/dashboard/data", () => ({
  getOptionalDashboardContext: async () => session.context,
}));
import { getDatabasePool } from "@/lib/dashboard/db";
import {
  plannedDates,
  syncSearchConsoleConnection,
  processSearchConsoleDay,
  classifySyncError,
  syncAllSearchConsoleConnections,
} from "@/lib/search-console/sync";
import {
  saveSearchConsoleConnection,
  disconnectSearchConsole,
  createSearchConsoleOAuthState,
  consumeSearchConsoleOAuthState,
} from "@/lib/search-console/connection";
import {
  GoogleApiError,
  queryCompleteDay,
  selectMatchingProperty,
} from "@/lib/search-console/google";
import { SEARCH_CONSOLE_SCOPE } from "@/lib/search-console/config";
import { getReportingOverview, getReportTable } from "./data";
import { getReportingStatus } from "./status";
import { requireReportingSite } from "@/lib/dashboard/site-access";
import { storePublicInquiry } from "@/lib/operations/public-inquiries";
import { recordPendingInquiryMeasurements } from "@/lib/analytics/verified-inquiries";
import { runReportingMaintenance } from "./maintenance";
import { reportToday, shiftDate } from "./dates";
import { POST as contact } from "@/app/api/contact/route";
import { POST as analytics } from "@/app/api/analytics/events/route";
import { POST as manual } from "@/app/api/integrations/search-console/sync/route";
import { GET as statusRoute } from "@/app/api/integrations/search-console/status/route";
import { GET as tableRoute } from "@/app/api/dashboard/reports/table/route";
import { GET as exportRoute } from "@/app/api/dashboard/reports/export/route";
import { GET as callback } from "@/app/api/integrations/search-console/callback/route";
import { POST as worker } from "@/app/api/cron/search-console/route";
const databaseUrl = process.env.TEST_DATABASE_URL;
const workspace = "00000000-0000-4000-8000-000000000001",
  site = "00000000-0000-4000-8000-000000000002";
const context = {
  user: { id: "test-owner", name: "Test owner", email: "owner@example.test" },
  workspace: {
    id: workspace,
    name: "Tailored Agents",
    slug: "tailored-agents",
  },
  role: "owner" as const,
};
const end = shiftDate(reportToday(), -3),
  start = shiftDate(end, -89),
  secret = "local-test-secret-for-reporting-only-1234567890";
let pool: pg.Pool;
function fakeGoogle(
  handler?: (body: Record<string, unknown>) => Response | Promise<Response>,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body));
      if (handler) return handler(body);
      return Response.json({ rows: [] });
    }),
  );
}
async function connection() {
  return saveSearchConsoleConnection({
    context,
    targetSite: { id: site, url: "https://www.tailoredagents.com" },
    tokens: {
      accessToken: "fake-access",
      refreshToken: "fake-refresh",
      expiresIn: 3600,
      scope: [SEARCH_CONSOLE_SCOPE],
    },
    selectedProperty: {
      siteUrl: "sc-domain:tailoredagents.com",
      permissionLevel: "siteOwner",
    },
  });
}
async function onlyDates(id: string, dates: string[]) {
  const run = await syncSearchConsoleConnection(id, "manual");
  await pool.query(
    `UPDATE integration_sync_runs SET pending_dates=$2::date[],total_days=$3 WHERE id=$1`,
    [run.id, dates, dates.length],
  );
  return run.id!;
}
const inquiry = () => ({
  submissionId: "inquiry_" + randomUUID().replaceAll("-", ""),
  fingerprint: createHash("sha256").update(randomUUID()).digest("hex"),
  inquiryType: "project",
  name: "Test Person",
  organization: "Fixture Business",
  email: "person@example.test",
  interest: "Website design and development",
  description:
    "A test inquiry that must be saved independently of measurement and notifications.",
});
const request = (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      ...headers,
    },
    body: JSON.stringify(body),
  });

describe.skipIf(!databaseUrl)(
  "Reporting with an isolated PostgreSQL database",
  () => {
    beforeAll(async () => {
      const url = new URL(databaseUrl!);
      if (
        !["127.0.0.1", "localhost"].includes(url.hostname) ||
        !/^\/ta_.*test/.test(url.pathname)
      )
        throw new Error("Only a local ta_*test database is permitted.");
      vi.stubEnv("DATABASE_URL", databaseUrl!);
      vi.stubEnv("BETTER_AUTH_SECRET", secret);
      vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
      vi.stubEnv("DASHBOARD_ALLOWED_EMAILS", "owner@example.test");
      vi.stubEnv("DASHBOARD_INITIAL_PASSWORD", "local-password-only");
      vi.stubEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_ID", "fake-client");
      vi.stubEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET", "fake-client-secret");
      vi.stubEnv("SEARCH_CONSOLE_SYNC_SECRET", secret);
      vi.stubEnv("RESEND_API_KEY", "");
      vi.stubEnv("CONTACT_FROM_EMAIL", "");
      vi.stubEnv("CONTACT_TO_EMAIL", "");
      pool = getDatabasePool();
      await pool.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())",
      );
      for (const filename of (await readdir("db/migrations"))
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        const found = await pool.query(
          "SELECT 1 FROM schema_migrations WHERE filename=$1",
          [filename],
        );
        if (!found.rowCount) {
          await pool.query(await readFile("db/migrations/" + filename, "utf8"));
          await pool.query(
            "INSERT INTO schema_migrations(filename) VALUES ($1)",
            [filename],
          );
        }
      }
    });
    beforeEach(async () => {
      await pool.query(
        'TRUNCATE integration_connections,analytics_events,leads,request_rate_limits,"user" CASCADE',
      );
      await pool.query(
        `INSERT INTO "user"(id,name,email) VALUES('test-owner','Test Owner','owner@example.test')`,
      );
      await pool.query(
        `INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,'test-owner','owner','active')`,
        [randomUUID(), workspace],
      );
      await pool.query(
        `UPDATE reporting_maintenance SET last_started_at=NULL,last_succeeded_at=NULL,lease_expires_at=NULL`,
      );
      await pool.query(
        `UPDATE schema_migrations SET applied_at='2025-01-01T00:00:00Z'`,
      );
      await pool.query(
        `INSERT INTO sites(id,workspace_id,name,url,environment,status) VALUES($1,$2,'Tailored Agents','https://www.tailoredagents.com','production','active') ON CONFLICT (id) DO NOTHING`,
        [site, workspace],
      );
      session.context = context;
      fakeGoogle();
    });
    afterEach(() => vi.unstubAllGlobals());
    afterAll(async () => {
      await pool?.end();
      delete (globalThis as { tailoredAgentsDatabasePool?: pg.Pool })
        .tailoredAgentsDatabasePool;
      vi.unstubAllEnvs();
    });

    it("overview shows only open work in the current workspace and due within seven days", async () => {
      const { getDashboardOverview } = await vi.importActual<typeof import("@/lib/dashboard/data")>("@/lib/dashboard/data");
      const other = randomUUID(), client = randomUUID();
      await pool.query("INSERT INTO workspaces(id,name,slug,kind,status) VALUES($1,'Other team',$2,'client','active')", [other, other]);
      try {
        for (const [owner, status, days] of [[workspace, "new", -1], [workspace, "qualified", 3], [workspace, "proposal", 15], [workspace, "won", -1], [workspace, "lost", -1], [workspace, "archived", -1], [other, "new", -1]] as const) {
          await pool.query("INSERT INTO leads(id,workspace_id,name,organization,email,status,next_action_at) VALUES(gen_random_uuid(),$1,'Contact',$2,'contact@example.test',$3,now()+make_interval(days=>$4))", [owner, owner === other ? "Other team's private lead" : status, status, days]);
        }
        await pool.query("INSERT INTO clients(id,workspace_id,name) VALUES($1,$2,'Client')", [client, workspace]);
        for (const [status, days] of [["active", -1], ["planned", 3], ["active", 15], ["completed", -1]] as const) {
          await pool.query("INSERT INTO projects(id,workspace_id,client_id,name,status,due_at) VALUES(gen_random_uuid(),$1,$2,$3,$4,now()+make_interval(days=>$5))", [workspace, client, `${status} ${days}`, status, days]);
        }
        const result = await getDashboardOverview(context);
        expect(result.counts.leads).toBe(3);
        expect(result.recentLeads.map(row => row.organization).sort()).toEqual(["new", "proposal", "qualified"]);
        expect(result.followUps.map(row => row.organization)).toEqual(["new", "qualified"]);
        expect(result.upcomingProjects.map(row => row.name)).toEqual(["active -1", "planned 3"]);
        expect(result.counts.projects).toBe(3);
      } finally { await pool.query("DELETE FROM workspaces WHERE id=$1", [other]); }
    });

    it("queues one initial 90-day job, recent first, even with simultaneous clicks", async () => {
      const saved = await connection();
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          syncSearchConsoleConnection(saved.id, "manual"),
        ),
      );
      expect(new Set(results.map((row) => row.id)).size).toBe(1);
      const run = (
        await pool.query(
          "SELECT total_days,pending_dates::text[] AS dates FROM integration_sync_runs",
        )
      ).rows[0];
      expect(run.total_days).toBe(90);
      expect(run.dates[0]).toBe(end);
      expect(run.dates.at(-1)).toBe(start);
      for (let i = 0; i < 90; i++)
        expect((await processSearchConsoleDay()).status).toBe(
          i === 89 ? "succeeded" : "queued",
        );
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM search_console_coverage",
          )
        ).rows[0].n,
      ).toBe(90);
      const report = await getReportingOverview(context, { range: "90d" });
      expect(report.google.complete).toBe(true);
      expect(report.google.clicks).toBe(0);
      expect(report.google.available).toBe(true);
    }, 30000);
    it("recovers a thirty-day outage and refreshes the latest ten covered days", () => {
      const today = new Date("2026-10-20T15:00:00Z");
      const dates = new Set<string>();
      for (let i = 0; i < 100; i++) dates.add(shiftDate("2026-09-17", -i));
      const plan = plannedDates("2026-07-20", dates, today);
      expect(plan.dates).toHaveLength(30);
      expect(plan.dates.at(-1)).toBe("2026-09-18");
      const full = new Set(plan.dates);
      for (const date of dates) full.add(date);
      expect(plannedDates("2026-07-20", full, today).dates).toHaveLength(10);
      expect(plannedDates("2020-01-01", new Set(), today).historyLimited).toBe(
        true,
      );
    });
    it("paginates detailed Google results beyond 25,000 and identifies its upper limit", async () => {
      fakeGoogle((body) =>
        Response.json({
          rows: Array.from(
            { length: body.startRow === 0 ? 25000 : 2 },
            (_, i) => ({
              keys: [end, String(Number(body.startRow) + i)],
              clicks: 0,
              impressions: 1,
              ctr: 0,
              position: 1,
            }),
          ),
        }),
      );
      const result = await queryCompleteDay({
        accessToken: "fake",
        propertyUri: "sc-domain:tailoredagents.com",
        startDate: end,
        endDate: end,
        dimension: "query",
      });
      expect(result.rows.length).toBe(25002);
      expect(result.limited).toBe(false);
      fakeGoogle(() =>
        Response.json({
          rows: Array.from({ length: 25000 }, (_, i) => ({
            keys: [end, String(i)],
            clicks: 0,
            impressions: 1,
            ctr: 0,
            position: 1,
          })),
        }),
      );
      expect(
        (
          await queryCompleteDay({
            accessToken: "fake",
            propertyUri: "sc-domain:tailoredagents.com",
            startDate: end,
            endDate: end,
            dimension: "query",
          })
        ).limited,
      ).toBe(true);
    });
    it("saves full long URLs, atomically preserves old reports on request failure, and resumes", async () => {
      const saved = await connection();
      await onlyDates(saved.id, [end]);
      const long = "https://www.tailoredagents.com/" + "a".repeat(6000);
      fakeGoogle((body) =>
        Response.json({
          rows: [
            {
              keys:
                (body.dimensions as string[]).length === 1
                  ? [end]
                  : [
                      end,
                      (body.dimensions as string[])[1] === "page"
                        ? long
                        : "search term",
                    ],
              clicks: 2,
              impressions: 10,
              ctr: 0.2,
              position: 3,
            },
          ],
        }),
      );
      expect((await processSearchConsoleDay()).status).toBe("succeeded");
      expect(
        (
          await pool.query(
            "SELECT dimension_value FROM search_console_metrics WHERE dimension_type='page'",
          )
        ).rows[0].dimension_value,
      ).toBe(long);
      const run = await onlyDates(saved.id, [end]);
      fakeGoogle((body) =>
        (body.dimensions as string[]).includes("query")
          ? Response.json({ error: { status: "UNAVAILABLE" } }, { status: 503 })
          : Response.json({ rows: [] }),
      );
      expect((await processSearchConsoleDay()).status).toBe("retry_wait");
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM search_console_metrics",
          )
        ).rows[0].n,
      ).toBe(3);
      fakeGoogle();
      await pool.query(
        "UPDATE integration_sync_runs SET next_attempt_at=now() WHERE id=$1",
        [run],
      );
      expect((await processSearchConsoleDay()).status).toBe("succeeded");
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM search_console_metrics",
          )
        ).rows[0].n,
      ).toBe(0);
    });
    it("recovers an expired lease without duplicate date writes", async () => {
      const saved = await connection(),
        run = await onlyDates(saved.id, [end]);
      await pool.query(
        `UPDATE integration_sync_runs SET status='running',lease_token=$2,lease_expires_at=now()-interval '1 minute' WHERE id=$1`,
        [run, randomUUID()],
      );
      const results = await Promise.all([
        processSearchConsoleDay(),
        processSearchConsoleDay(),
      ]);
      expect(results.map((row) => row.status).sort()).toEqual([
        "skipped",
        "succeeded",
      ]);
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM search_console_coverage",
          )
        ).rows[0].n,
      ).toBe(1);
    });
    it("does not commit an older import after disconnect or replacement connection", async () => {
      const saved = await connection();
      await onlyDates(saved.id, [end]);
      let release!: () => void;
      let entered!: () => void;
      const barrier = new Promise<void>((resolve) => (release = resolve)),
        started = new Promise<void>((resolve) => (entered = resolve));
      fakeGoogle(async () => {
        entered();
        await barrier;
        return Response.json({ rows: [] });
      });
      const running = processSearchConsoleDay();
      await started;
      await disconnectSearchConsole(context);
      await connection();
      release();
      expect((await running).status).toBe("cancelled");
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM search_console_coverage",
          )
        ).rows[0].n,
      ).toBe(0);
      expect(
        (
          await pool.query(
            "SELECT connection_version::int AS version,status FROM integration_connections",
          )
        ).rows[0],
      ).toEqual({ version: 3, status: "active" });
    });
    it("does not replace a working login with a wrong property or absent new refresh token", async () => {
      await connection();
      const before = (
        await pool.query(
          "SELECT refresh_token_encrypted,connection_version FROM integration_connections",
        )
      ).rows[0];
      const input = {
        context,
        targetSite: { id: site, url: "https://www.tailoredagents.com" },
        tokens: {
          accessToken: "other-account",
          expiresIn: 3600,
          scope: [SEARCH_CONSOLE_SCOPE],
        },
        selectedProperty: {
          siteUrl: "sc-domain:tailoredagents.com",
          permissionLevel: "siteOwner",
        },
      };
      expect((await saveSearchConsoleConnection(input)).error).toBe(
        "missing_refresh_token",
      );
      expect(
        (
          await saveSearchConsoleConnection({
            ...input,
            selectedProperty: {
              siteUrl: "https://www.tailoredagents.com/",
              permissionLevel: "siteOwner",
            },
          })
        ).error,
      ).toBe("matching_property_not_found");
      expect(
        (
          await pool.query(
            "SELECT refresh_token_encrypted,connection_version FROM integration_connections",
          )
        ).rows[0],
      ).toEqual(before);
      expect(
        selectMatchingProperty(
          [
            {
              siteUrl: "https://www.tailoredagents.com/",
              permissionLevel: "siteOwner",
            },
          ],
          "https://www.tailoredagents.com",
        ),
      ).toBeNull();
    });
    it("consumes OAuth state once, rejects expired state, and handles declined permission", async () => {
      const state = await createSearchConsoleOAuthState(context);
      expect(await consumeSearchConsoleOAuthState(state, context)).toBe(true);
      expect(await consumeSearchConsoleOAuthState(state, context)).toBe(false);
      const expired = await createSearchConsoleOAuthState(context);
      await pool.query(
        "UPDATE integration_oauth_states SET expires_at=now()-interval '1 second'",
      );
      expect(await consumeSearchConsoleOAuthState(expired, context)).toBe(
        false,
      );
      const declined = await createSearchConsoleOAuthState(context);
      const response = await callback(
        new NextRequest(
          `http://localhost:3000/api/integrations/search-console/callback?state=${declined}&error=access_denied`,
        ),
      );
      expect(response.headers.get("location")).toContain("integration=denied");
    });
    it("honors rate-limit delays and stops retrying revoked authorization", async () => {
      const saved = await connection();
      const run = await onlyDates(saved.id, [end]);
      fakeGoogle(() =>
        Response.json(
          { error: { status: "RESOURCE_EXHAUSTED" } },
          { status: 429, headers: { "Retry-After": "1800" } },
        ),
      );
      expect((await processSearchConsoleDay()).status).toBe("retry_wait");
      expect(
        (
          await pool.query(
            "SELECT extract(epoch from(next_attempt_at-now()))::int AS seconds FROM integration_sync_runs WHERE id=$1",
            [run],
          )
        ).rows[0].seconds,
      ).toBeGreaterThan(1700);
      await pool.query(
        "UPDATE integration_sync_runs SET next_attempt_at=now() WHERE id=$1",
        [run],
      );
      fakeGoogle(() =>
        Response.json({ error: "invalid_grant" }, { status: 401 }),
      );
      expect((await processSearchConsoleDay()).status).toBe("failed");
      expect(
        (await syncSearchConsoleConnection(saved.id, "manual")).status,
      ).toBe("skipped");
      expect((await getReportingStatus(context)).connection?.lastError).toBe(
        "reconnect_required",
      );
      expect(
        classifySyncError(new DOMException("timeout", "TimeoutError")).retry,
      ).toBe(true);
      expect(
        classifySyncError(new GoogleApiError("permission", "DENIED", 403))
          .retry,
      ).toBe(false);
    });
    it("does not treat malformed successful HTTP replies as zero activity", async () => {
      const saved = await connection();
      await onlyDates(saved.id, [end]);
      fakeGoogle(() => new Response("broken json", { status: 200 }));
      expect((await processSearchConsoleDay()).status).toBe("retry_wait");
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM search_console_coverage",
          )
        ).rows[0].n,
      ).toBe(0);
    });
    it("fails closed for other workspaces, removed membership, viewers managing, and anonymous exports", async () => {
      await expect(
        requireReportingSite({
          ...context,
          workspace: { ...context.workspace, id: randomUUID() },
        }),
      ).rejects.toThrow();
      await pool.query(
        "UPDATE workspace_memberships SET role='viewer' WHERE user_id='test-owner'",
      );
      expect(
        (await manual(request("/api/integrations/search-console/sync", {})))
          .status,
      ).toBe(403);
      expect(
        (
          await statusRoute(
            new Request(
              "http://localhost:3000/api/integrations/search-console/status",
            ),
          )
        ).status,
      ).toBe(200);
      await pool.query(
        "UPDATE workspace_memberships SET status='removed' WHERE user_id='test-owner'",
      );
      expect(
        (
          await exportRoute(
            new Request("http://localhost:3000/api/dashboard/reports/export"),
          )
        ).status,
      ).toBe(403);
      session.context = null;
      expect(
        (
          await tableRoute(
            new Request(
              "http://localhost:3000/api/dashboard/reports/table?table=queries",
            ),
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await exportRoute(
            new Request("http://localhost:3000/api/dashboard/reports/export"),
          )
        ).status,
      ).toBe(401);
    });
    it("distinguishes missing days from zero and uses property totals instead of search-term sums", async () => {
      const saved = await connection();
      await onlyDates(saved.id, [end]);
      fakeGoogle((body) =>
        Response.json({
          rows: [
            {
              keys:
                (body.dimensions as string[]).length === 1
                  ? [end]
                  : [end, "test"],
              clicks: (body.dimensions as string[]).length === 1 ? 7 : 2,
              impressions: 20,
              ctr: 0.1,
              position: 3,
            },
          ],
        }),
      );
      await processSearchConsoleDay();
      const report = await getReportingOverview(context, { range: "7d" });
      expect(report.google.clicks).toBe(7);
      expect(report.google.missing).toHaveLength(6);
      expect(report.google.trend[0].clicks).toBeNull();
      expect(report.google.comparison).toBeNull();
      const table = await getReportTable(
        context,
        { range: "7d" },
        { table: "queries" },
      );
      expect(table.rows[0].primary).toBe(2);
    });
    it("saves deduplicated inquiries, recovers measurement, and bounds conversion rates", async () => {
      const data = inquiry(),
        visitor = randomUUID(),
        measurement = {
          sessionId: visitor,
          path: "/contact",
          landingPath: "/",
        };
      const results = await Promise.all([
        storePublicInquiry(data, measurement),
        storePublicInquiry(data, measurement),
      ]);
      expect(results[0].leadId).toBe(results[1].leadId);
      expect(results.filter((row) => !row.duplicate)).toHaveLength(1);
      await recordPendingInquiryMeasurements();
      await recordPendingInquiryMeasurements();
      await storePublicInquiry(inquiry(), measurement);
      await recordPendingInquiryMeasurements();
      await storePublicInquiry(inquiry());
      await pool.query(
        `UPDATE leads SET created_at=($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')+interval '12 hours'`,
        [end],
      );
      await pool.query(
        `UPDATE analytics_events SET occurred_at=($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')+interval '12 hours'`,
        [end],
      );
      await pool.query(
        `INSERT INTO analytics_events(id,workspace_id,site_id,session_id,event_name,path,landing_path,occurred_at)
      VALUES ($1,$2,$3,$4,'page_view','/','/',($5::date::timestamp AT TIME ZONE 'America/Los_Angeles')+interval '10 hours')`,
        [randomUUID(), workspace, site, visitor, end],
      );
      const report = await getReportingOverview(context, {
        range: "custom",
        start: end,
        end,
      });
      expect(report.website.inquiries).toBe(3);
      expect(report.website.attributed).toBe(2);
      expect(report.website.conversionRate).toBe(100);
      expect(report.website.convertingVisits).toBe(1);
    });
    it("stores privacy-disabled inquiries while refusing forged browser conversions", async () => {
      const visitor = randomUUID();
      const body = {
        ...inquiry(),
        startedAt: Date.now() - 5000,
        measurement: { sessionId: visitor, path: "/contact", landingPath: "/" },
      };
      expect(
        (await contact(request("/api/contact", body, { "sec-gpc": "1" })))
          .status,
      ).toBe(201);
      expect(
        (await pool.query("SELECT measurement_status FROM leads")).rows[0]
          .measurement_status,
      ).toBeNull();
      const event = {
        id: randomUUID(),
        sessionId: visitor,
        path: "/contact",
        landingPath: "/",
        eventName: "form_success",
      };
      expect(
        (await analytics(request("/api/analytics/events", event))).status,
      ).toBe(400);
      expect(
        (
          await analytics(
            request(
              "/api/analytics/events",
              { ...event, eventName: "page_view" },
              { dnt: "1" },
            ),
          )
        ).status,
      ).toBe(204);
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM analytics_events"))
          .rows[0].n,
      ).toBe(0);
    });
    it("keeps inquiry success when notification delivery fails and retries do not count twice", async () => {
      vi.stubEnv("RESEND_API_KEY", "fake-key");
      vi.stubEnv("CONTACT_FROM_EMAIL", "test@example.test");
      vi.stubEnv("CONTACT_TO_EMAIL", "test@example.test");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("unavailable")),
      );
      const body = {
        ...inquiry(),
        startedAt: Date.now() - 5000,
        measurement: {
          sessionId: randomUUID(),
          path: "/contact",
          landingPath: "/",
        },
      };
      expect((await contact(request("/api/contact", body))).status).toBe(201);
      expect((await contact(request("/api/contact", body))).status).toBe(200);
      expect(
        (await pool.query("SELECT delivery_status FROM leads")).rows[0]
          .delivery_status,
      ).toBe("failed");
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM analytics_events"))
          .rows[0].n,
      ).toBe(1);
      vi.stubEnv("RESEND_API_KEY", "");
    });
    it("accepts management requests from www and rejects the redirecting apex", async () => {
      await connection();
      vi.stubEnv("BETTER_AUTH_URL", "https://www.tailoredagents.com");
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.tailoredagents.com");
      try {
        const send = (origin: string) => manual(new NextRequest(
          "https://www.tailoredagents.com/api/integrations/search-console/sync",
          { method: "POST", headers: { origin, accept: "application/json" } },
        ));
        expect((await send("https://tailoredagents.com")).status).toBe(403);
        expect((await send("https://www.tailoredagents.com")).status).toBe(202);
        const status = await getReportingStatus(context);
        expect(status.configured).toBe(true);
        expect(status.redirectUri).toBe("https://www.tailoredagents.com/api/integrations/search-console/callback");
      } finally {
        vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
      }
    });
    it("reports worker health, protects scheduled requests, and runs daily maintenance", async () => {
      expect(
        (
          await worker(
            new Request("http://localhost:3000/api/cron/search-console", {
              method: "POST",
            }),
          )
        ).status,
      ).toBe(401);
      expect((await getReportingStatus(context)).worker.stale).toBe(true);
      await syncAllSearchConsoleConnections();
      await runReportingMaintenance();
      const status = await getReportingStatus(context);
      expect(status.worker.stale).toBe(false);
      expect(status.retention.stale).toBe(false);
      expect(JSON.stringify(status)).not.toContain(secret);
      expect(JSON.stringify(status)).not.toContain("fake-refresh");
      const first = status.retention.lastCheck;
      await runReportingMaintenance();
      expect((await getReportingStatus(context)).retention.lastCheck).toBe(
        first,
      );
    });
    it("exports authenticated selected dates with completeness and formula escaping", async () => {
      const saved = await connection();
      await onlyDates(saved.id, [end]);
      fakeGoogle((body) =>
        Response.json({
          rows: [
            {
              keys:
                (body.dimensions as string[]).length === 1
                  ? [end]
                  : [end, "=SUM(A1)"],
              clicks: 1,
              impressions: 10,
              ctr: 0.1,
              position: 2,
            },
          ],
        }),
      );
      await processSearchConsoleDay();
      const response = await exportRoute(
        new Request(
          `http://localhost:3000/api/dashboard/reports/export?range=custom&start=${end}&end=${end}`,
        ),
      );
      const text = await response.text();
      expect(text).toContain('"\'=SUM(A1)"');
      expect(text).toContain("Export complete");
      expect(text).toContain(end);
      expect(response.headers.get("cache-control")).toContain("no-store");
    });
    it("keeps an inquiry when attribution storage fails and recovers it later", async () => {
      await pool.query(`CREATE FUNCTION test_reject_measurement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated measurement outage'; END $$;
      CREATE TRIGGER test_reject_measurement BEFORE INSERT ON analytics_events FOR EACH ROW EXECUTE FUNCTION test_reject_measurement()`);
      try {
        const body = {
          ...inquiry(),
          startedAt: Date.now() - 5000,
          measurement: {
            sessionId: randomUUID(),
            path: "/contact",
            landingPath: "/",
          },
        };
        expect((await contact(request("/api/contact", body))).status).toBe(201);
        expect(
          (await pool.query("SELECT measurement_status FROM leads")).rows[0]
            .measurement_status,
        ).toBe("pending");
      } finally {
        await pool.query(
          "DROP TRIGGER test_reject_measurement ON analytics_events; DROP FUNCTION test_reject_measurement()",
        );
      }
      await runReportingMaintenance();
      expect(
        (await pool.query("SELECT measurement_status FROM leads")).rows[0]
          .measurement_status,
      ).toBe("recorded");
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM analytics_events"))
          .rows[0].n,
      ).toBe(1);
    });
    it("uses Pacific midnight around DST and excludes current-day activity from presets", async () => {
      const visitor = randomUUID();
      for (const timestamp of [
        "2026-03-08T07:59:59Z",
        "2026-03-08T08:00:00Z",
        "2026-03-09T06:59:59Z",
        "2026-03-09T07:00:00Z",
      ])
        await pool.query(
          `INSERT INTO analytics_events(id,workspace_id,site_id,session_id,event_name,path,landing_path,occurred_at) VALUES($1,$2,$3,$4,'page_view','/','/',$5)`,
          [randomUUID(), workspace, site, visitor, timestamp],
        );
      const report = await getReportTable(
        context,
        { range: "custom", start: "2026-03-08", end: "2026-03-08" },
        { table: "website-pages" },
      );
      expect(report.rows[0].primary).toBe(2);
      expect(report.rows[0].secondary).toBe(1);
      await pool.query(
        `INSERT INTO analytics_events(id,workspace_id,site_id,session_id,event_name,path,landing_path) VALUES($1,$2,$3,$4,'page_view','/today','/')`,
        [randomUUID(), workspace, site, randomUUID()],
      );
      const current = await getReportingOverview(context, { range: "7d" });
      expect(current.website.visits).toBe(0);
      expect(current.latestActivity).not.toBeNull();
    });
    it("refreshes expired access credentials without crossing connection generations", async () => {
      const saved = await connection();
      await onlyDates(saved.id, [end]);
      await pool.query(
        "UPDATE integration_connections SET token_expires_at=now()-interval '1 hour'",
      );
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) =>
          url.includes("oauth2.googleapis.com")
            ? Response.json({
                access_token: "replacement-access",
                expires_in: 3600,
                scope: SEARCH_CONSOLE_SCOPE,
              })
            : Response.json({ rows: [] }),
        ),
      );
      expect((await processSearchConsoleDay()).status).toBe("succeeded");
      expect(
        (
          await pool.query(
            "SELECT token_expires_at > now() AS valid FROM integration_connections",
          )
        ).rows[0].valid,
      ).toBe(true);
    });
    it("distinguishes unavailable storage from denied access without revealing database errors", async () => {
      const query = vi
        .spyOn(pool, "query")
        .mockImplementationOnce(() =>
          Promise.reject(new Error("private database failure")),
        );
      try {
        const response = await statusRoute(
          new Request(
            "http://localhost:3000/api/integrations/search-console/status",
          ),
        );
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ error: "report_unavailable" });
      } finally {
        query.mockRestore();
      }
    });
  },
);
