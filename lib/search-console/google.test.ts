import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let buildAuthorizationUrl: typeof import("./google").buildAuthorizationUrl;
let querySearchAnalytics: typeof import("./google").querySearchAnalytics;
let selectMatchingProperty: typeof import("./google").selectMatchingProperty;

beforeAll(async () => {
  ({ buildAuthorizationUrl, querySearchAnalytics, selectMatchingProperty } = await import("./google"));
});

afterEach(() => vi.unstubAllGlobals());

describe("Google Search Console OAuth helpers", () => {
  it("requests offline, read-only access with a state value", () => {
    const url = new URL(buildAuthorizationUrl({
      clientId: "client-id",
      redirectUri: "https://tailoredagents.com/api/integrations/search-console/callback",
      state: "secure-state",
    }));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/webmasters.readonly");
    expect(url.searchParams.get("state")).toBe("secure-state");
  });

  it("prefers the verified domain property for the production hostname", () => {
    const selected = selectMatchingProperty([
      { siteUrl: "https://www.tailoredagents.com/", permissionLevel: "siteFullUser" },
      { siteUrl: "sc-domain:tailoredagents.com", permissionLevel: "siteOwner" },
    ], "https://tailoredagents.com");
    expect(selected?.siteUrl).toBe("sc-domain:tailoredagents.com");
  });

  it("rejects unverified matches", () => {
    expect(selectMatchingProperty([
      { siteUrl: "sc-domain:tailoredagents.com", permissionLevel: "siteUnverifiedUser" },
    ], "https://tailoredagents.com")).toBeNull();
  });

  it("requests finalized daily query rows with a bounded result set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      rows: [{ keys: ["2026-10-15", "ai automation"], clicks: 2, impressions: 20, ctr: 0.1, position: 4.2 }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const rows = await querySearchAnalytics({
      accessToken: "access-token",
      propertyUri: "sc-domain:tailoredagents.com",
      startDate: "2026-10-01",
      endDate: "2026-10-15",
      dimension: "query",
    });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(request.body as string);
    expect(rows[0]?.keys[1]).toBe("ai automation");
    expect(body).toMatchObject({ dimensions: ["date", "query"], dataState: "final", rowLimit: 25_000 });
    expect(request.headers).toMatchObject({ Authorization: "Bearer access-token" });
  });
});
