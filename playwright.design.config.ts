import { defineConfig, devices } from "@playwright/test";
import { dashboardThemeStorage } from "./tests/dashboard-theme-state";
const origin = "http://127.0.0.1:3170";
const databaseUrl = "postgresql://ta_test@127.0.0.1:55433/ta_reporting_browser_test";
export default defineConfig({
  testDir: "./tests/design", workers: 1, fullyParallel: false, timeout: 180000,
  use: { baseURL: origin, trace: "retain-on-failure", storageState: dashboardThemeStorage() },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", viewport: { width: 390, height: 844 } } },
  ],
  webServer: { command: "npm exec next start -- --hostname 127.0.0.1 --port 3170", url: `${origin}/api/health`, reuseExistingServer: false, timeout: 120000,
    env: { DATABASE_URL: databaseUrl, DASHBOARD_AUTH_MODE: "password", BETTER_AUTH_SECRET: "local-preview-secret-not-for-production-123456", BETTER_AUTH_URL: origin, NEXT_PUBLIC_SITE_URL: origin,
      DASHBOARD_ALLOWED_EMAILS: "owner@example.test,viewer@example.test", DASHBOARD_INITIAL_PASSWORD: "local-bootstrap-only", MAIL_AUTH_SECRET: "", CRM_MAIL_SECRET: "", TWILIO_ACCOUNT_SID: "", TWILIO_AUTH_TOKEN: "", TWILIO_API_KEY_SID: "", TWILIO_API_KEY_SECRET: "", TWILIO_PHONE_NUMBER: "", TWILIO_SMS_ENABLED: "false", TWILIO_VOICE_ENABLED: "false", TWILIO_VOICE_APP_SID: "", GOOGLE_SEARCH_CONSOLE_CLIENT_ID: "fake-preview-client", GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET: "fake-preview-secret", RESEND_API_KEY: "", CONTACT_FROM_EMAIL: "", CONTACT_TO_EMAIL: "" },
  },
});
