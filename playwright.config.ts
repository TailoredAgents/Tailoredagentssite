import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/reporting",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
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
    command: "npm exec next start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL:
        "postgresql://ta_test@127.0.0.1:55432/ta_reporting_browser_test",
      BETTER_AUTH_SECRET: "local-preview-secret-not-for-production-123456",
      BETTER_AUTH_URL: "http://127.0.0.1:3100",
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
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
