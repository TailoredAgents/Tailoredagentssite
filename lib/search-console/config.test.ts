import { describe, expect, it } from "vitest";
import { resolveSearchConsoleConfiguration } from "./config";

describe("Search Console configuration", () => {
  it("builds the exact production OAuth callback", () => {
    const configuration = resolveSearchConsoleConfiguration({
      GOOGLE_SEARCH_CONSOLE_CLIENT_ID: "client-id",
      GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET: "client-secret",
      BETTER_AUTH_URL: "https://www.tailoredagents.com/",
      NEXT_PUBLIC_SITE_URL: "https://www.tailoredagents.com",
    });
    expect(configuration.configured).toBe(true);
    expect(configuration.redirectUri).toBe(
      "https://www.tailoredagents.com/api/integrations/search-console/callback",
    );
  });

  it("reports missing credentials without exposing values", () => {
    const configuration = resolveSearchConsoleConfiguration({
      NEXT_PUBLIC_SITE_URL: "https://www.tailoredagents.com",
    });
    expect(configuration.configured).toBe(false);
    expect(configuration.missing).toEqual([
      "GOOGLE_SEARCH_CONSOLE_CLIENT_ID",
      "GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET",
    ]);
  });
  it("rejects inconsistent canonical addresses and non-HTTP local callbacks", () => {
    const configured = {
      GOOGLE_SEARCH_CONSOLE_CLIENT_ID: "client-id",
      GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET: "client-secret",
    };
    expect(
      resolveSearchConsoleConfiguration({
        ...configured,
        BETTER_AUTH_URL: "https://tailoredagents.com",
      }).configured,
    ).toBe(false);
    expect(
      resolveSearchConsoleConfiguration({
        ...configured,
        BETTER_AUTH_URL: "https://www.tailoredagents.com",
        NEXT_PUBLIC_SITE_URL: "https://tailoredagents.com",
      }).configured,
    ).toBe(false);
    expect(
      resolveSearchConsoleConfiguration({
        ...configured,
        BETTER_AUTH_URL: "ftp://localhost",
      }).configured,
    ).toBe(false);
    expect(
      resolveSearchConsoleConfiguration({
        ...configured,
        BETTER_AUTH_URL: "http://localhost:3000",
      }).configured,
    ).toBe(true);
  });
});
