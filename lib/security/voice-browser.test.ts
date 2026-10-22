import { describe, expect, it } from "vitest";
import { browserScriptSources, voiceBrowserFixture, voiceDashboardHeaders } from "./voice-browser";
describe("private browser phone policy", () => {
  it("supports React development debugging while retaining the production script policy", () => {
    expect(browserScriptSources(true)).toContain("'unsafe-eval'");
    expect(browserScriptSources(false)).toBe("'self' 'unsafe-inline'");
  });
  it("allows same-origin microphone and the documented default Twilio hosts without broad network access", () => {
    const headers = Object.fromEntries(voiceDashboardHeaders().map(h => [h.key, h.value]));
    expect(headers["Permissions-Policy"]).toContain("microphone=(self)");
    expect(headers["Content-Security-Policy"]).toContain("wss://voice-js.roaming.twilio.com");
    expect(headers["Content-Security-Policy"]).toContain("media-src 'self' blob: mediastream:");
    expect(headers["Content-Security-Policy"]).not.toMatch(/\*|127\.0\.0\.1|localhost/);
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });
  it("refuses synthetic phone selection outside the exact disposable development database", () => {
    const base = { VOICE_BROWSER_TEST_SDK: "true", NODE_ENV: "development", DATABASE_URL: "postgresql://ta_test@127.0.0.1:55433/ta_voice_browser_test" };
    expect(voiceBrowserFixture(base)).toBe(true);
    for (const patch of [{ NODE_ENV: "production" }, { NODE_ENV: "test" }, { DATABASE_URL: "postgresql://user@remote.example/ta_voice_browser_test" }, { DATABASE_URL: "postgresql://user@127.0.0.1:55433/production" }, { DATABASE_URL: base.DATABASE_URL + "?sslmode=require" }])
      expect(() => voiceBrowserFixture({ ...base, ...patch })).toThrow();
    expect(voiceBrowserFixture({ NODE_ENV: "production" })).toBe(false);
  });
});
