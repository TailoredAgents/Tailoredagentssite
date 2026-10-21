import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";

afterEach(() => vi.unstubAllEnvs());

describe("canonical hostname deployment", () => {
  it("uses Render's existing apex-to-www direction without a rollout flag", async () => {
    vi.stubEnv("ENABLE_APEX_REDIRECT", undefined);
    const redirects = await nextConfig.redirects!();
    expect(redirects).toEqual([
      {
        source: "/:path*",
        has: [{ type: "host", value: "tailoredagents.com" }],
        destination: "https://www.tailoredagents.com/:path*",
        permanent: true,
      },
    ]);
    vi.stubEnv("ENABLE_APEX_REDIRECT", "false");
    expect(await nextConfig.redirects!()).toEqual(redirects);
  });

  it("ignores the obsolete rollout flag so it cannot reintroduce a www-to-apex loop", async () => {
    vi.stubEnv("ENABLE_APEX_REDIRECT", "true");
    expect(await nextConfig.redirects!()).toEqual([
      {
        source: "/:path*",
        has: [{ type: "host", value: "tailoredagents.com" }],
        destination: "https://www.tailoredagents.com/:path*",
        permanent: true,
      },
    ]);
  });
});
