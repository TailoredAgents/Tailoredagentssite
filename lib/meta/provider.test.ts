import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { fetchMetaLead } from "./provider";
describe("Meta Graph transport", () => {
  beforeEach(() => {
    vi.stubEnv("META_PAGE_ID", "111111111");
    vi.stubEnv("META_APP_SECRET", "synthetic-not-live-app-secret");
    vi.stubEnv("META_PAGE_ACCESS_TOKEN", "synthetic-not-live-page-token");
    vi.stubEnv(
      "META_WEBHOOK_VERIFY_TOKEN",
      "synthetic-verification-token-".repeat(2),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("uses a fixed HTTPS Graph host, refuses redirects, and keeps tokens out of URLs", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "333333333" })));
    vi.stubGlobal("fetch", fetcher);
    await fetchMetaLead("333333333");
    const [url, options] = fetcher.mock.calls[0];
    expect(url.origin).toBe("https://graph.facebook.com");
    expect(url.search).not.toContain("synthetic-not-live");
    expect(options.redirect).toBe("error");
    expect(options.headers.Authorization).toBe(
      "Bearer synthetic-not-live-page-token",
    );
    await expect(fetchMetaLead("https://attacker.test")).rejects.toThrow(
      "configuration_required",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("keeps intake working when optional ad fields are not authorized", async () => {
    const fields: string[] = [];
    const fetcher = vi.fn().mockImplementation(async (url: URL) => {
      fields.push(url.searchParams.get("fields")!);
      return fields.length === 1
        ? new Response("Denied", { status: 403 })
        : new Response(JSON.stringify({ id: "333333333" }));
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchMetaLead("333333333")).toEqual({ id: "333333333" });
    expect(fields[0]).toContain("campaign_name");
    expect(fields[1]).toBe("id,created_time,form_id,field_data");
  });
  it("redacts provider errors and does not retry authentication errors immediately", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response("private provider error", { status: 401 }),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchMetaLead("333333333")).rejects.toThrow(
      "provider_http_401",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
