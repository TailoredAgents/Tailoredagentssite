import { defineConfig, devices } from "@playwright/test";
import { dashboardThemeStorage } from "./tests/dashboard-theme-state";
import { resolve } from "node:path";
const origin = "http://127.0.0.1:3160";
const databaseUrl = process.env.VOICE_TEST_DATABASE_URL || "postgresql://ta_test@127.0.0.1:55433/ta_voice_browser_test";
const parsed = new URL(databaseUrl);
if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.port !== "55433" || parsed.pathname !== "/ta_voice_browser_test" || parsed.search || parsed.hash)
  throw new Error("Voice browser tests require the exact disposable local database.");
export default defineConfig({
  testDir: "./tests/voice", workers: 1, fullyParallel: false, timeout: 60000,
  use: { baseURL: origin, trace: "retain-on-failure", storageState: dashboardThemeStorage() },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: [
    { command: "node scripts/voice-test-provider.mjs", url: "http://127.0.0.1:3161/health", reuseExistingServer: false, env: { VOICE_TEST_DATABASE_URL: databaseUrl } },
    { command: "npm exec next dev -- --webpack --hostname 127.0.0.1 --port 3160", url: `${origin}/api/health`, reuseExistingServer: false, timeout: 120000,
      env: { DATABASE_URL: databaseUrl, BETTER_AUTH_URL: origin, NEXT_PUBLIC_SITE_URL: origin,
        NODE_OPTIONS: `--require ${JSON.stringify(resolve("scripts/voice-test-preload.cjs"))}`,
        VOICE_BROWSER_TEST_SDK: "true", BETTER_AUTH_SECRET: "voice-browser-local-session-secret-1234567890", DASHBOARD_AUTH_MODE: "password",
        DASHBOARD_ALLOWED_EMAILS: "owner@example.test,austin@example.test,viewer@example.test,readonly@example.test,unapproved@example.test", DASHBOARD_INITIAL_PASSWORD: "voice-browser-bootstrap-only",
        CRM_MAIL_SECRET: "", TWILIO_ACCOUNT_SID: `AC${"1".repeat(32)}`, TWILIO_AUTH_TOKEN: "a".repeat(32),
        TWILIO_API_KEY_SID: `SK${"2".repeat(32)}`, TWILIO_API_KEY_SECRET: "b".repeat(32), TWILIO_VOICE_APP_SID: `AP${"4".repeat(32)}`,
        TWILIO_PHONE_NUMBER: "+16785550100", TWILIO_SMS_ENABLED: "true", TWILIO_VOICE_ENABLED: "true", RESEND_API_KEY: "", CONTACT_FROM_EMAIL: "", CONTACT_TO_EMAIL: "" } },
  ],
});
