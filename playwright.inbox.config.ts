import { defineConfig, devices } from "@playwright/test";
const origin = "http://127.0.0.1:3130";
const databaseUrl = process.env.INBOX_TEST_DATABASE_URL || "postgresql://ta_test@127.0.0.1:55433/ta_inbox_browser_test";
const parsed = new URL(databaseUrl);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.pathname !== "/ta_inbox_browser_test" || parsed.search || parsed.hash)
  throw new Error("Inbox browser tests require the isolated local ta_inbox_browser_test database.");
export default defineConfig({
  testDir: "./tests/inbox", fullyParallel: false, workers: 1,
  timeout: 60000,
  use: { baseURL: origin, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: [
    { command: "node scripts/inbox-test-mail.mjs", url: "http://127.0.0.1:3131/health", reuseExistingServer: false, env: { INBOX_TEST_DATABASE_URL: databaseUrl } },
    { command: "npm exec next dev -- --hostname 127.0.0.1 --port 3130", url: `${origin}/api/health`, reuseExistingServer: false, timeout: 120000,
      env: { DATABASE_URL: databaseUrl, BETTER_AUTH_URL: origin, NEXT_PUBLIC_SITE_URL: origin,
        BETTER_AUTH_SECRET: "inbox-browser-local-session-secret-1234567890", DASHBOARD_AUTH_MODE: "mail",
        MAIL_AUTH_URL: "http://127.0.0.1:3131/api/dashboard-auth", MAIL_AUTH_SECRET: "inbox-browser-local-identity-secret-1234567890",
        CRM_MAIL_SECRET: "inbox-browser-local-crm-service-secret-1234567890", RESEND_API_KEY: "", CONTACT_FROM_EMAIL: "", CONTACT_TO_EMAIL: "" } },
  ],
});
