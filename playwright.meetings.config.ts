import {defineConfig} from '@playwright/test';
import base from './playwright.config';
import {resolve} from 'node:path';
const server=base.webServer as {env:Record<string,string>;command:string;url:string};
export default defineConfig({...base,testDir:'./tests/meetings',webServer:{...server,command:`npm exec next dev -- --webpack --hostname 127.0.0.1 --port ${Number(process.env.REPORTING_TEST_PORT||3100)}`,reuseExistingServer:false,env:{...server.env,NODE_OPTIONS:`--require "${resolve('scripts/meetings-test-preload.cjs').replaceAll('\\','/')}"`,OPENAI_API_KEY:'meeting-synthetic-no-live-key',MEETING_PROCESSING_ENABLED:'true',FACTORY_STORAGE_URL:'https://meeting-storage.example.test',FACTORY_STORAGE_SECRET:'meeting-synthetic-storage-not-for-production',TWILIO_SMS_ENABLED:'false',RESEND_API_KEY:''}}});
