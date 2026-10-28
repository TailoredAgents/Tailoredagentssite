import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import type { Pool } from "pg";
vi.mock("server-only", () => ({}));
const remote = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("./conversion-provider", async original => ({ ...(await original<typeof import("./conversion-provider")>()), sendMetaConversion: remote.send }));
import { MetaConversionError } from "./conversion-provider";
import { getDatabasePool } from "@/lib/dashboard/db";
import type { DashboardContext } from "@/lib/dashboard/data";
import { META_WORKSPACE_ID as ws } from "./config";
import { getMetaConversionStatus, retryMetaConversions, runMetaConversionWorker } from "./conversions";
const url = process.env.TEST_META_CONVERSION_DATABASE_URL;
const pageId = "111111111", datasetId = "222222222";
let pool: Pool;
const context = (user = "owner"): DashboardContext => ({ user: { id: user, email: `${user}@example.test`, name: user }, workspace: { id: ws, name: "Fixture", slug: "fixture" }, role: "owner" });
async function lead(source = "facebook", workspace = ws, page = pageId) {
  const id = randomUUID(), providerId = String(Date.now()) + Math.floor(Math.random()*1000).toString().padStart(3,"0");
  await pool.query("INSERT INTO meta_lead_events(id,workspace_id,page_id,provider_lead_id,form_id) VALUES($1,$2,$3,$4,'333333333')", [randomUUID(), workspace, page, providerId]);
  await pool.query(`INSERT INTO leads(id,workspace_id,source,name,organization,email,submission_id,meta_context)
    VALUES($1,$2,$3,'Synthetic','Fixture','fixture@example.test',$4,$5::jsonb)`, [id, workspace, source, `meta:${page}:${providerId}`, JSON.stringify({ leadId: providerId })]);
  return id;
}
const rows = async () => (await pool.query("SELECT * FROM meta_conversion_events ORDER BY occurred_at,id")).rows;
describe.skipIf(!url)("Durable Meta CRM conversions", () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.port !== "55435" || parsed.pathname !== "/ta_meta_conversion_test" || parsed.search || parsed.hash) throw new Error("Use disposable ta_meta_conversion_test on loopback:55435.");
    vi.stubEnv("DATABASE_URL", url!); vi.stubEnv("BETTER_AUTH_SECRET", "local-conversion-test-secret-".repeat(3));
    pool = getDatabasePool();
    await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY)");
    for (const file of (await readdir("db/migrations")).filter(f => f.endsWith(".sql")).sort()) {
      if ((await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1", [file])).rowCount) continue;
      await pool.query(await readFile(`db/migrations/${file}`, "utf8"));
      await pool.query("INSERT INTO schema_migrations(filename) VALUES($1)", [file]);
    }
  }, 30000);
  beforeEach(async () => {
    await pool.query('TRUNCATE leads,meta_lead_events,"user" CASCADE');
    await pool.query("UPDATE workspaces SET status='active' WHERE id=$1", [ws]);
    for (const role of ["owner", "viewer"]) {
      await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$1,$2)', [role, `${role}@example.test`]);
      await pool.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$3,'active')", [randomUUID(), ws, role]);
    }
    vi.stubEnv("META_PAGE_ID", pageId); vi.stubEnv("META_CAPI_DATASET_ID", datasetId);
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "synthetic-conversion-test-token");
    vi.stubEnv("META_CAPI_MODE", "live"); vi.stubEnv("META_CAPI_TEST_EVENT_CODE", "TEST42");
    remote.send.mockReset().mockResolvedValue(undefined);
  });
  afterAll(async () => { await pool?.end(); vi.unstubAllEnvs(); });
  it("captures actual transitions atomically, including skipped stages, but not duplicate saves or unrelated leads", async () => {
    const id = await lead(); await lead("website");
    await pool.query("UPDATE leads SET status='proposal' WHERE id=$1", [id]);
    await pool.query("UPDATE leads SET status='proposal' WHERE id=$1", [id]);
    const tx = await pool.connect();
    try { await tx.query("BEGIN"); await tx.query("UPDATE leads SET status='won' WHERE id=$1", [id]); await tx.query("ROLLBACK"); } finally { tx.release(); }
    expect((await rows()).map(e => e.stage)).toEqual(["new","proposal"]);
    await pool.query("UPDATE leads SET status='won' WHERE id=$1", [id]);
    expect((await rows()).map(e => e.stage)).toEqual(["new","proposal","won"]);
    await pool.query("UPDATE leads SET meta_context='{}',status='qualified' WHERE id=$1", [id]);
    expect(await rows()).toHaveLength(3);
  });
  it("queues while paused, leases against overlapping workers, and never resends accepted events", async () => {
    await lead(); vi.stubEnv("META_CAPI_MODE", "paused");
    await runMetaConversionWorker(); expect(remote.send).not.toHaveBeenCalled();
    vi.stubEnv("META_CAPI_MODE", "live");
    await Promise.all([runMetaConversionWorker(), runMetaConversionWorker()]);
    await runMetaConversionWorker();
    expect(remote.send).toHaveBeenCalledTimes(1); expect((await rows())[0].state).toBe("accepted");
    expect(await getMetaConversionStatus(context())).toMatchObject({ mode: "live", counts: [{ state: "accepted", count: 1 }] });
    expect(JSON.stringify(await getMetaConversionStatus(context()))).not.toContain("synthetic-conversion-test-token");
  });
  it("promotes test deliveries to live with the original event/time", async () => {
    await lead(); vi.stubEnv("META_CAPI_MODE", "test");
    await runMetaConversionWorker(); await runMetaConversionWorker();
    expect(remote.send).toHaveBeenCalledTimes(1); expect((await rows())[0].state).toBe("tested");
    vi.stubEnv("META_CAPI_MODE", "live"); await runMetaConversionWorker();
    expect(remote.send.mock.calls[1][0]).toEqual(remote.send.mock.calls[0][0]);
    expect((await rows())[0].state).toBe("accepted");
  });
  it("pins ambiguous retries to their destination and preserves deduplication identity", async () => {
    await lead(); remote.send.mockRejectedValueOnce(new MetaConversionError("response_unconfirmed", true));
    await runMetaConversionWorker(); expect((await rows())[0].state).toBe("pending");
    await pool.query("UPDATE meta_conversion_events SET next_attempt_at=now()");
    vi.stubEnv("META_CAPI_DATASET_ID", "999999999"); await runMetaConversionWorker();
    expect(remote.send).toHaveBeenCalledTimes(1);
    vi.stubEnv("META_CAPI_DATASET_ID", datasetId); await runMetaConversionWorker();
    expect(remote.send.mock.calls[1][0]).toEqual(remote.send.mock.calls[0][0]);
  });
  it("bounds crash recovery, event age and retention", async () => {
    await lead();
    await pool.query("UPDATE meta_conversion_events SET state='working',attempts=12,lease_expires_at=now()-interval '1 second'");
    await runMetaConversionWorker(); expect((await rows())[0].state).toBe("failed"); expect(remote.send).not.toHaveBeenCalled();
    await pool.query("UPDATE meta_conversion_events SET occurred_at=now()-interval '8 days'");
    await runMetaConversionWorker(); expect((await rows())[0].state).toBe("expired");
    await pool.query("UPDATE meta_conversion_events SET occurred_at=now()-interval '91 days'");
    vi.stubEnv("META_CAPI_MODE", "paused"); await runMetaConversionWorker(); expect(await rows()).toHaveLength(0);
  });
  it("limits delivery to the configured page and active workspace and purges anonymized/deleted leads", async () => {
    const id = await lead(); await lead("facebook", ws, "999999999");
    await pool.query("UPDATE workspaces SET status='archived' WHERE id=$1", [ws]);
    await runMetaConversionWorker(); expect(remote.send).not.toHaveBeenCalled();
    await pool.query("UPDATE workspaces SET status='active' WHERE id=$1", [ws]);
    await pool.query("UPDATE leads SET anonymized_at=now() WHERE id=$1", [id]);
    await runMetaConversionWorker(); expect(remote.send).not.toHaveBeenCalled(); expect(await rows()).toHaveLength(1);
    await pool.query("DELETE FROM leads"); expect(await rows()).toHaveLength(0);
  });
  it("checks current admin membership for retries and never renews the 24-hour window", async () => {
    await lead(); remote.send.mockRejectedValueOnce(new MetaConversionError("meta_190")); await runMetaConversionWorker();
    await expect(retryMetaConversions(context("viewer"))).rejects.toThrow("Only an owner");
    const original = (await rows())[0]; expect(await retryMetaConversions(context())).toBe(1);
    expect((await rows())[0]).toMatchObject({ id: original.id, first_attempt_at: original.first_attempt_at });
    await pool.query("UPDATE meta_conversion_events SET state='failed',first_attempt_at=now()-interval '25 hours'");
    expect(await retryMetaConversions(context())).toBe(0);
    await pool.query("UPDATE workspace_memberships SET status='removed' WHERE user_id='owner'");
    await expect(retryMetaConversions(context())).rejects.toThrow("Only an owner");
  });
});
