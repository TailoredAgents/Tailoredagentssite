import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";

afterEach(() => vi.unstubAllEnvs());

describe("canonical hostname deployment", () => {
  it("does not create a redirect loop with Render's existing apex-to-www routing", async () => {
    vi.stubEnv("ENABLE_APEX_REDIRECT", undefined);
    expect(await nextConfig.redirects!()).toEqual([]);
    vi.stubEnv("ENABLE_APEX_REDIRECT", "false");
    expect(await nextConfig.redirects!()).toEqual([]);
  });

  it("enables the path-preserving www redirect only after the hosting cutover", async () => {
    vi.stubEnv("ENABLE_APEX_REDIRECT", "true");
    expect(await nextConfig.redirects!()).toEqual([
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.tailoredagents.com" }],
        destination: "https://tailoredagents.com/:path*",
        permanent: true,
      },
    ]);
  });
});
