import { defineConfig, devices } from "@playwright/test";
import { dashboardThemeStorage } from "./tests/dashboard-theme-state";
import { resolve } from "node:path";
const origin="http://127.0.0.1:3150";
const databaseUrl=process.env.CONVERSATIONS_TEST_DATABASE_URL || "postgresql://ta_test@127.0.0.1:55433/ta_conversations_browser_test";
const parsed=new URL(databaseUrl);
if (!["postgres:","postgresql:"].includes(parsed.protocol) || !["127.0.0.1","localhost"].includes(parsed.hostname) || parsed.pathname !== "/ta_conversations_browser_test" || parsed.search || parsed.hash)
  throw new Error("Conversation browser tests require the exact disposable local database.");
export default defineConfig({
  testDir:"./tests/conversations",fullyParallel:false,workers:1,timeout:90000,
  use:{baseURL:origin,trace: "retain-on-failure", storageState: dashboardThemeStorage()},
  projects:[{name:"desktop",use:{...devices["Desktop Chrome"],viewport:{width:1440,height:1000}}},{name:"phone",use:{...devices["iPhone 13"],defaultBrowserType:"chromium"}}],
  webServer:[
    {command:"node scripts/conversations-test-provider.mjs",url:"http://127.0.0.1:3151/health",reuseExistingServer:false,env:{CONVERSATIONS_TEST_DATABASE_URL:databaseUrl}},
    {command:"npm exec next dev -- --hostname 127.0.0.1 --port 3150",url:`${origin}/api/health`,reuseExistingServer:false,timeout:120000,
      env:{DATABASE_URL:databaseUrl,BETTER_AUTH_URL:origin,NEXT_PUBLIC_SITE_URL:origin,NODE_OPTIONS:`--require ${JSON.stringify(resolve("scripts/conversations-test-preload.cjs"))}`,
        OPENAI_API_KEY:"conversations-synthetic-openai-key",CRM_AI_DRAFTS_ENABLED:"true",BETTER_AUTH_SECRET:"conversations-browser-local-session-secret-1234567890",DASHBOARD_AUTH_MODE:"mail",MAIL_AUTH_URL:"http://127.0.0.1:3151/api/dashboard-auth",MAIL_AUTH_SECRET:"conversations-browser-local-identity-secret-1234567890",CRM_MAIL_SECRET:"conversations-browser-local-crm-service-secret-1234567890",
        TWILIO_ACCOUNT_SID:`AC${"1".repeat(32)}`,TWILIO_AUTH_TOKEN:"a".repeat(32),TWILIO_API_KEY_SID:`SK${"2".repeat(32)}`,TWILIO_API_KEY_SECRET:"b".repeat(32),TWILIO_PHONE_NUMBER:"+16785550100",TWILIO_SMS_ENABLED:"true",RESEND_API_KEY:"",CONTACT_FROM_EMAIL:"",CONTACT_TO_EMAIL:""}},
  ],
});
