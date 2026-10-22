import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',workers:1,fullyParallel:false,timeout:30000,
 use:{baseURL:'http://localhost:8787',headless:true,trace:'retain-on-failure'},
 webServer:{command:'npm run build && wrangler dev --port 8787 --var DASHBOARD_AUTH_SECRET:local-browser-identity-bridge-secret-2026 --var CRM_MAIL_SECRET:local-browser-crm-bridge-secret-2026-distinct',url:'http://localhost:8787/login',reuseExistingServer:false,timeout:90000},
});
