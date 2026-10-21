import { describe, expect, it } from "vitest";
import { resolveDashboardConfiguration } from "./config";

const environment = {
  DATABASE_URL: "postgresql://localhost/test",
  BETTER_AUTH_SECRET: "a".repeat(40),
  BETTER_AUTH_URL: "https://www.tailoredagents.com",
  DASHBOARD_AUTH_MODE: "mail",
  MAIL_AUTH_SECRET: "b".repeat(40),
};
describe("Mail identity trust configuration", () => {
  it("uses mail approvals without requiring a separate password or website allowlist", () => {
    expect(resolveDashboardConfiguration(environment).ready).toBe(true);
  });
  it("refuses untrusted destinations and test identities on the live website", () => {
    for (const url of [
      "https://attacker.example/api/dashboard-auth",
      "http://mail.tailoredagents.com/api/dashboard-auth",
      "https://mail.tailoredagents.com/api/dashboard-auth?redirect=bad",
      "https://user:pass@mail.tailoredagents.com/api/dashboard-auth",
      "https://tailored-mail-staging.jeffrey-78e.workers.dev/api/dashboard-auth",
    ]) expect(resolveDashboardConfiguration({ ...environment, MAIL_AUTH_URL: url }).missing).toContain("MAIL_AUTH_URL");
  });
  it("fails closed for missing service secrets and misspelled authentication modes", () => {
    expect(resolveDashboardConfiguration({ ...environment, MAIL_AUTH_SECRET: "" }).ready).toBe(false);
    expect(resolveDashboardConfiguration({ ...environment, DASHBOARD_AUTH_MODE: "mali" }).missing).toContain("DASHBOARD_AUTH_MODE");
  });
});
