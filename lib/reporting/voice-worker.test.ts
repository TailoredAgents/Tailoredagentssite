import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ reporting: vi.fn(), voice: vi.fn(), sync: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/reporting/maintenance", () => ({ runReportingMaintenance: mocks.reporting }));
vi.mock("@/lib/voice/maintenance", () => ({ runVoiceMaintenance: mocks.voice }));
vi.mock("@/lib/search-console/sync", () => ({ syncAllSearchConsoleConnections: mocks.sync }));
vi.mock("@/lib/dashboard/db", () => ({ getDatabasePool: () => ({ query: mocks.query }) }));
import { POST } from "@/app/api/cron/search-console/route";
describe("authenticated shared worker voice retention", () => {
  beforeEach(() => {
    vi.stubEnv("SEARCH_CONSOLE_SYNC_SECRET", "synthetic-worker-secret-12345678901234567890");
    mocks.reporting.mockResolvedValue(undefined); mocks.voice.mockResolvedValue({ checked: 1, failed: 0 });
    mocks.sync.mockResolvedValue([]); mocks.query.mockResolvedValue({ rowCount: 0 });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
  it("does not run either subsystem for an unauthenticated request", async () => {
    expect((await POST(new Request("https://example.test/api/cron/search-console", { method: "POST" }))).status).toBe(401);
    expect(mocks.voice).not.toHaveBeenCalled(); expect(mocks.reporting).not.toHaveBeenCalled();
  });
  it("reports bounded voice cleanup independently from search synchronization", async () => {
    const response = await POST(new Request("https://example.test/api/cron/search-console", { method: "POST", headers: { authorization: `Bearer ${process.env.SEARCH_CONSOLE_SYNC_SECRET}` } }));
    expect(await response.json()).toMatchObject({ ok: true, voice: { checked: 1, failed: 0 } });
    expect(mocks.voice).toHaveBeenCalledOnce(); expect(mocks.sync).toHaveBeenCalledOnce();
  });
  it("continues the reporting queue if voice deletion cannot run", async () => {
    mocks.voice.mockRejectedValue(new Error("Synthetic retention outage"));
    const response = await POST(new Request("https://example.test/api/cron/search-console", { method: "POST", headers: { authorization: `Bearer ${process.env.SEARCH_CONSOLE_SYNC_SECRET}` } }));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ ok: true, voice: { checked: 0, failed: 1 } });
    expect(mocks.sync).toHaveBeenCalledOnce();
  });
});
