import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',workers:1,fullyParallel:false,timeout:30000,
 use:{baseURL:'http://localhost:8787',headless:true,trace:'retain-on-failure'},
 webServer:{command:'npm run build && wrangler dev --port 8787',url:'http://localhost:8787/login',reuseExistingServer:!process.env.CI,timeout:90000},
});
