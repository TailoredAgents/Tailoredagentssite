import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
import { dashboardThemeStorage } from "./tests/dashboard-theme-state";

const databaseUrl = "postgresql://ta_test@127.0.0.1:55433/ta_factory_browser_test";
const origin = "http://127.0.0.1:3180";
export default defineConfig({
  testDir: "./tests/factory", workers: 1, fullyParallel: false, timeout: 90000,
  use: { baseURL: origin, trace: "retain-on-failure", storageState: dashboardThemeStorage() },
  projects: [
    {name:"desktop",use:{...devices["Desktop Chrome"],viewport:{width:1440,height:1000}}},
    {name:"phone",use:{...devices["iPhone 13"],defaultBrowserType:"chromium"}},
  ],
  webServer: [
    {command:"node scripts/factory-test-provider.mjs",url:"http://127.0.0.1:3181/health",reuseExistingServer:false,env:{FACTORY_TEST_DATABASE_URL:databaseUrl}},
    {command:"npm exec next dev -- --webpack --hostname 127.0.0.1 --port 3180",url:`${origin}/api/health`,reuseExistingServer:false,timeout:120000,
      env:{DATABASE_URL:databaseUrl,BETTER_AUTH_URL:origin,NEXT_PUBLIC_SITE_URL:origin,
        NODE_OPTIONS:`--require ${JSON.stringify(resolve("scripts/factory-test-preload.cjs"))}`,
        BETTER_AUTH_SECRET:"factory-browser-local-session-secret-1234567890",DASHBOARD_AUTH_MODE:"password",
        DASHBOARD_ALLOWED_EMAILS:"owner@example.test,member@example.test,viewer@example.test",DASHBOARD_INITIAL_PASSWORD:"factory-browser-bootstrap-only",
        FACTORY_OPENAI_API_KEY:"factory-synthetic-no-live-key",FACTORY_WORKER_SECRET:"factory-browser-local-worker-secret-1234567890",
        OPENAI_API_KEY:"",SEO_OPENAI_API_KEY:"",CRM_MAIL_SECRET:"",TWILIO_ACCOUNT_SID:"",TWILIO_AUTH_TOKEN:"",TWILIO_VOICE_ENABLED:"false",TWILIO_SMS_ENABLED:"false",RESEND_API_KEY:"",CONTACT_FROM_EMAIL:"",CONTACT_TO_EMAIL:""}},
  ],
});
