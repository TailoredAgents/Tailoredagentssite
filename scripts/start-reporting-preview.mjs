import { spawn, spawnSync } from "node:child_process";
const databaseUrl =
  "postgresql://ta_test@127.0.0.1:55432/ta_reporting_browser_test";
const seed = spawnSync(
  process.execPath,
  ["scripts/seed-reporting-preview.mjs"],
  { env: { ...process.env, TEST_DATABASE_URL: databaseUrl }, stdio: "inherit" },
);
if (seed.status) process.exit(seed.status);
console.log(
  "Demo-only report preview: http://127.0.0.1:3100/dashboard/analytics. The fixture account is documented in the release runbook.",
);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
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
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
