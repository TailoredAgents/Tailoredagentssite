import { describe, expect, it } from "vitest";
import { resolveSearchConsoleConfiguration } from "./config";

describe("Search Console configuration", () => {
  it("builds the exact production OAuth callback", () => {
    const configuration = resolveSearchConsoleConfiguration({
      GOOGLE_SEARCH_CONSOLE_CLIENT_ID: "client-id",
      GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET: "client-secret",
      BETTER_AUTH_URL: "https://tailoredagents.com/",
    });
    expect(configuration.configured).toBe(true);
    expect(configuration.redirectUri).toBe("https://tailoredagents.com/api/integrations/search-console/callback");
  });

  it("reports missing credentials without exposing values", () => {
    const configuration = resolveSearchConsoleConfiguration({ NEXT_PUBLIC_SITE_URL: "https://tailoredagents.com" });
    expect(configuration.configured).toBe(false);
    expect(configuration.missing).toEqual([
      "GOOGLE_SEARCH_CONSOLE_CLIENT_ID",
      "GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET",
    ]);
  });
});
