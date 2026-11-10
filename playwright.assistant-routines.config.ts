import {defineConfig} from '@playwright/test';
import chat from './playwright.assistant-chat.config';
const server=chat.webServer as Exclude<typeof chat.webServer,unknown[]|undefined>;
export default defineConfig({...chat,testMatch:'routines.spec.ts',webServer:{...server,env:{...server.env,ASSISTANT_PROACTIVE_ENABLED:'true',TWILIO_SMS_ENABLED:'false',TWILIO_VOICE_ENABLED:'false',MEETINGS_ENABLED:'false',ASSISTANT_NOTIFICATIONS_ENABLED:'false',ASSISTANT_PUSH_ENABLED:'false'}}});
