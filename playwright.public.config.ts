import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/public",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3126", trace: "retain-on-failure" },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3126",
    url: "http://127.0.0.1:3126",
    reuseExistingServer: true,
    env: { DATABASE_URL: "", RESEND_API_KEY: "", OPENAI_API_KEY: "", TWILIO_SMS_ENABLED: "false", NEXT_PUBLIC_META_PIXEL_ENABLED: "false", NEXT_PUBLIC_SITE_URL: "https://www.tailoredagents.com" },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
});
