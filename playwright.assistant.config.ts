import {defineConfig} from '@playwright/test';
import reporting from './playwright.config';
// OAuth intentionally refuses plaintext production origins. Use the existing
// synthetic database and a development loopback server for browser consent tests.
export default defineConfig({...reporting,testDir:'./tests/assistant',testMatch:'assistant.spec.ts',webServer:{
 ...reporting.webServer as Exclude<typeof reporting.webServer,unknown[]|undefined>,
 command:`npm exec next dev -- --webpack --hostname 127.0.0.1 --port ${Number(process.env.REPORTING_TEST_PORT||3100)}`,
}});
