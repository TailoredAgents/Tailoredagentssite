import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
import { dashboardThemeStorage } from "./tests/dashboard-theme-state";
const databaseUrl = "postgresql://ta_test@127.0.0.1:55433/ta_seo_browser_test",
  origin = "http://127.0.0.1:3170";
export default defineConfig({
  testDir: "./tests/seo",
  workers: 1,
  fullyParallel: false,
  timeout: 150000,
  use: {
    baseURL: origin,
    trace: "retain-on-failure",
    storageState: dashboardThemeStorage(),
  },
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
  webServer: [
    {
      command: "node scripts/seo-test-provider.mjs",
      url: "http://127.0.0.1:3171/health",
      reuseExistingServer: false,
      env: { SEO_TEST_DATABASE_URL: databaseUrl },
    },
    {
      command: "npm run build && npm run start -- --port 3170",
      url: `${origin}/api/health`,
      reuseExistingServer: false,
      timeout: 180000,
      env: {
        DATABASE_URL: databaseUrl,
        BETTER_AUTH_URL: origin,
        NEXT_PUBLIC_SITE_URL: "https://www.tailoredagents.com",
        BETTER_AUTH_SECRET: "seo-browser-synthetic-session-secret-1234567890",
        DASHBOARD_AUTH_MODE: "password",
        DASHBOARD_ALLOWED_EMAILS: "owner@example.test,viewer@example.test",
        DASHBOARD_INITIAL_PASSWORD: "seo-browser-bootstrap-only",
        OPENAI_API_KEY: "seo-synthetic-no-live-key",
        DATAFORSEO_LOGIN: "fixture-login",
        DATAFORSEO_PASSWORD: "fixture-password",
        SEO_WORKER_SECRET: "seo-browser-local-worker-secret-1234567890",
        TWILIO_ACCOUNT_SID: "",
        TWILIO_AUTH_TOKEN: "",
        CRM_MAIL_SECRET: "",
        RESEND_API_KEY: "",
        NODE_OPTIONS: `--require ${JSON.stringify(resolve("scripts/seo-test-preload.cjs"))}`,
      },
    },
  ],
});
