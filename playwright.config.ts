import { defineConfig, devices } from "@playwright/test";
import { dashboardThemeStorage } from "./tests/dashboard-theme-state";
const port = Number(process.env.REPORTING_TEST_PORT || 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Use a valid local reporting-test port.");
const origin = `http://127.0.0.1:${port}`;
const databaseUrl =
  process.env.REPORTING_TEST_DATABASE_URL ||
  "postgresql://ta_test@127.0.0.1:55432/ta_reporting_browser_test";
const parsedDatabase = new URL(databaseUrl);
if (
  !["127.0.0.1", "localhost"].includes(parsedDatabase.hostname) ||
  parsedDatabase.pathname !== "/ta_reporting_browser_test"
)
  throw new Error(
    "Browser tests require the isolated local ta_reporting_browser_test database.",
  );
export default defineConfig({
  testDir: "./tests/reporting",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: origin, trace: "retain-on-failure", storageState: dashboardThemeStorage() },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "phone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `npm exec next start -- --hostname 127.0.0.1 --port ${port}`,
    url: `${origin}/api/health`,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: databaseUrl,
      DASHBOARD_AUTH_MODE: "password",
      MAIL_AUTH_SECRET: "",
      MAIL_AUTH_URL: "",
      BETTER_AUTH_SECRET: "local-preview-secret-not-for-production-123456",
      BETTER_AUTH_URL: origin,
      NEXT_PUBLIC_SITE_URL: origin,
      DASHBOARD_ALLOWED_EMAILS:
        "owner@example.test,viewer@example.test,provisioned@example.test",
      DASHBOARD_INITIAL_PASSWORD: "local-bootstrap-only",
      GOOGLE_SEARCH_CONSOLE_CLIENT_ID: "fake-preview-client",
      GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET: "fake-preview-secret",
      SEARCH_CONSOLE_SYNC_SECRET:
        "local-preview-worker-not-for-production-123456",
      RESEND_API_KEY: "",
      CONTACT_FROM_EMAIL: "",
      CONTACT_TO_EMAIL: "",
    },
  },
});
