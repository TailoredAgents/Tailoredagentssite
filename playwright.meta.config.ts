import { defineConfig } from "@playwright/test";
import base from "./playwright.design.config";

export default defineConfig({
  ...base,
  testDir: "./tests/meta",
  webServer: {
    ...base.webServer,
    command:
      "node scripts/seed-reporting-preview.mjs && npm run build && npm run start -- --port 3170",
    url: "http://127.0.0.1:3170/api/health",
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      ...(base.webServer && !Array.isArray(base.webServer)
        ? base.webServer.env
        : {}),
      TEST_DATABASE_URL:
        "postgresql://ta_test@127.0.0.1:55433/ta_reporting_browser_test",
      NEXT_PUBLIC_META_PIXEL_ID: "123456789",
      NEXT_PUBLIC_META_PIXEL_ENABLED: "true",
      META_LEADS_ENABLED: "false",
      META_PAGE_ACCESS_TOKEN: "",
      META_APP_SECRET: "",
      META_PAGE_ID: "",
    },
  },
});
