import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import type { Pool } from "pg";
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
const remote = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("./provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./provider")>()),
  fetchMetaLead: remote.fetch,
}));
import { getDatabasePool } from "@/lib/dashboard/db";
import { META_WORKSPACE_ID as ws } from "./config";
import {
  enqueueMetaLeads,
  getMetaStatus,
  retryMetaImports,
  runMetaLeadWorker,
} from "./service";
import { MetaProviderError } from "./provider";
import { GET, POST } from "@/app/api/integrations/meta/leads/route";
import { listLeads, getLead } from "@/lib/operations/data";
import type { DashboardContext } from "@/lib/dashboard/data";
const url = process.env.TEST_META_DATABASE_URL;
const pageId = "111111111",
  formId = "222222222",
  leadId = "333333333";
let pool: Pool;
const context = (role: string): DashboardContext => ({
  user: { id: `meta-${role}`, email: `${role}@example.test`, name: role },
  workspace: { id: ws, name: "Fixture", slug: "fixture" },
  role: "owner",
});
const payload = (page = pageId, id = leadId) => ({
  object: "page",
  entry: [
    {
      id: page,
      changes: [
        {
          field: "leadgen",
          value: { leadgen_id: id, page_id: page, form_id: formId },
        },
      ],
    },
  ],
});
const providerLead = () => ({
  id: leadId,
  form_id: formId,
  created_time: "2026-10-23T16:00:00Z",
  campaign_name: "Website leads",
  platform: "instagram",
  field_data: [
    { name: "full_name", values: ["Meta Fixture"] },
    { name: "email", values: ["fixture@example.test"] },
    { name: "phone_number", values: ["6785550101"] },
  ],
});

describe.skipIf(!url)("Meta durable lead intake", () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      parsed.hostname !== "127.0.0.1" ||
      parsed.port !== "55433" ||
      parsed.pathname !== "/ta_meta_test" ||
      parsed.search ||
      parsed.hash
    )
      throw new Error("Use exact disposable ta_meta_test on loopback:55433.");
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("BETTER_AUTH_SECRET", "meta-fixture-only-secret-".repeat(3));
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
    vi.stubEnv("META_LEADS_ENABLED", "true");
    vi.stubEnv("META_PAGE_ID", pageId);
    vi.stubEnv(
      "META_PAGE_ACCESS_TOKEN",
      "synthetic-page-token-not-live-123456",
    );
    vi.stubEnv("META_APP_SECRET", "synthetic-app-secret-not-live");
    vi.stubEnv(
      "META_WEBHOOK_VERIFY_TOKEN",
      "synthetic-verification-token-".repeat(2),
    );
    remote.fetch.mockReset().mockResolvedValue(providerLead());
    await pool.query('TRUNCATE leads,"user" CASCADE');
    for (const role of ["owner", "viewer"]) {
      await pool.query(
        'INSERT INTO "user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
        [`meta-${role}`, role, `${role}@example.test`],
      );
      await pool.query(
        "INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')",
        [randomUUID(), ws, `meta-${role}`, role],
      );
    }
  });
  afterAll(async () => {
    await pool?.end();
    delete (globalThis as { tailoredAgentsDatabasePool?: Pool })
      .tailoredAgentsDatabasePool;
    vi.unstubAllEnvs();
  });
  it("answers only the configured verification challenge", async () => {
    expect(
      (
        await GET(
          new Request(
            "https://example.test?hub.mode=subscribe&hub.challenge=hello&hub.verify_token=wrong",
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      await (
        await GET(
          new Request(
            `https://example.test?hub.mode=subscribe&hub.challenge=hello&hub.verify_token=${process.env.META_WEBHOOK_VERIFY_TOKEN}`,
          ),
        )
      ).text(),
    ).toBe("hello");
  });
  it("rejects unsigned delivery and durably accepts the signed raw bytes", async () => {
    const body = JSON.stringify(payload());
    expect(
      (
        await POST(
          new Request("https://example.test", { method: "POST", body }),
        )
      ).status,
    ).toBe(401);
    const signature = `sha256=${createHmac("sha256", process.env.META_APP_SECRET!).update(body).digest("hex")}`;
    expect(
      (
        await POST(
          new Request("https://example.test", {
            method: "POST",
            body,
            headers: { "x-hub-signature-256": signature },
          }),
        )
      ).status,
    ).toBe(200);
    expect((await pool.query("SELECT * FROM meta_lead_events")).rowCount).toBe(
      1,
    );
  });
  it("ignores another Page, and concurrent duplicate deliveries create one lead", async () => {
    expect(await enqueueMetaLeads(payload("999999999"))).toBe(0);
    await Promise.all([
      enqueueMetaLeads(payload()),
      enqueueMetaLeads(payload()),
    ]);
    await Promise.all([runMetaLeadWorker(), runMetaLeadWorker()]);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(1);
    expect(remote.fetch).toHaveBeenCalledTimes(1);
    expect(await enqueueMetaLeads(payload())).toBe(0);
    const listing = await listLeads(context("owner"), { source: "facebook" });
    expect(listing.total).toBe(1);
    const lead = await getLead(context("owner"), listing.items[0].id);
    expect(lead).toMatchObject({
      source: "facebook",
      phone: "+16785550101",
      metaContext: { platform: "instagram", campaignName: "Website leads" },
    });
    expect(
      (await listLeads(context("owner"), { source: "website" })).total,
    ).toBe(0);
  });
  it("queues while paused and resumes without losing the receipt", async () => {
    vi.stubEnv("META_LEADS_ENABLED", "false");
    await enqueueMetaLeads(payload());
    expect((await runMetaLeadWorker()).checked).toBe(0);
    expect(remote.fetch).not.toHaveBeenCalled();
    vi.stubEnv("META_LEADS_ENABLED", "true");
    await runMetaLeadWorker();
    expect((await getMetaStatus(context("owner")))?.counts[0]).toMatchObject({
      status: "imported",
      count: 1,
    });
  });
  it("backs off outages and allows an owner to retry exhausted imports", async () => {
    await enqueueMetaLeads(payload());
    await pool.query("UPDATE meta_lead_events SET attempts=11");
    remote.fetch.mockRejectedValue(new MetaProviderError("provider_http_401"));
    expect((await runMetaLeadWorker()).failed).toBe(1);
    expect(
      (await pool.query("SELECT status,error_code FROM meta_lead_events"))
        .rows[0],
    ).toEqual({ status: "failed", error_code: "provider_http_401" });
    await expect(retryMetaImports(context("viewer"))).rejects.toThrow();
    await retryMetaImports(context("owner"));
    remote.fetch.mockResolvedValue(providerLead());
    await runMetaLeadWorker();
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(1);
  });
  it("recovers expired leases and refuses a provider identity mismatch", async () => {
    await enqueueMetaLeads(payload());
    await pool.query(
      "UPDATE meta_lead_events SET status='working',lease_token=$1,lease_expires_at=now()-interval '1 minute'",
      [randomUUID()],
    );
    remote.fetch.mockResolvedValue({ ...providerLead(), form_id: "777777777" });
    expect((await runMetaLeadWorker()).failed).toBe(1);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
    expect(
      (await pool.query("SELECT error_code FROM meta_lead_events")).rows[0]
        .error_code,
    ).toBe("identity_mismatch");
  });
  it("anonymizes original answers and source details while retaining replay protection", async () => {
    await enqueueMetaLeads(payload());
    await runMetaLeadWorker();
    await pool.query("UPDATE leads SET retained_until=now()-interval '1 day'");
    await pool.query("SELECT perform_reporting_retention()");
    const lead = (await pool.query("SELECT * FROM leads")).rows[0];
    expect(lead.anonymized_at).not.toBeNull();
    expect(lead.meta_context).toBeNull();
    expect(lead.email).not.toBe("fixture@example.test");
    expect(await enqueueMetaLeads(payload())).toBe(0);
  });
});
