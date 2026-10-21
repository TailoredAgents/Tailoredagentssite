import { describe, expect, it } from "vitest";
import { parseAllowedEmails, resolveDashboardConfiguration } from "./config";

describe("dashboard configuration", () => {
  it("trusts the chosen www origin without trusting the redirecting apex", () => {
    expect(resolveDashboardConfiguration({
      BETTER_AUTH_URL: "https://www.tailoredagents.com",
    }).trustedOrigins).toEqual([
      "https://www.tailoredagents.com",
    ]);
  });

  it("does not add production origins to local or unrelated deployments", () => {
    for (const baseUrl of ["http://localhost:3000", "https://preview.example.test"]) {
      expect(resolveDashboardConfiguration({ BETTER_AUTH_URL: baseUrl }).trustedOrigins)
        .toEqual([baseUrl]);
    }
  });
  it("normalizes and filters the internal email allowlist", () => {
    expect([...parseAllowedEmails(" OWNER@example.com,invalid,team@example.com ")]).toEqual([
      "owner@example.com",
      "team@example.com",
    ]);
  });

  it("is ready only when every security dependency is configured", () => {
    const configuration = resolveDashboardConfiguration({
      DATABASE_URL: "postgresql://example.test/app",
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_URL: "https://www.tailoredagents.com/",
      DASHBOARD_ALLOWED_EMAILS: "owner@tailoredagents.com",
      DASHBOARD_INITIAL_PASSWORD: "a-secure-starting-password",
    });

    expect(configuration.ready).toBe(true);
    expect(configuration.baseUrl).toBe("https://www.tailoredagents.com");
    expect(configuration.missing).toEqual([]);
  });

  it("reports incomplete setup without exposing any values", () => {
    const configuration = resolveDashboardConfiguration({
      BETTER_AUTH_SECRET: "too-short",
      NEXT_PUBLIC_SITE_URL: "https://www.tailoredagents.com",
    });

    expect(configuration.ready).toBe(false);
    expect(configuration.missing).toEqual([
      "DATABASE_URL",
      "BETTER_AUTH_SECRET",
      "DASHBOARD_ALLOWED_EMAILS",
      "DASHBOARD_INITIAL_PASSWORD",
    ]);
  });

  it("does not require email delivery for dashboard access", () => {
    const configuration = resolveDashboardConfiguration({
      DATABASE_URL: "postgresql://example.test/app",
      BETTER_AUTH_SECRET: "x".repeat(32),
      DASHBOARD_ALLOWED_EMAILS: "owner@tailoredagents.com",
      DASHBOARD_INITIAL_PASSWORD: "a-secure-starting-password",
    });

    expect(configuration.ready).toBe(true);
  });
});
