import {defineConfig} from '@playwright/test';
import chat from './playwright.assistant-chat.config';
const server=chat.webServer as Exclude<typeof chat.webServer,unknown[]|undefined>;
export default defineConfig({...chat,testMatch:['communications.spec.ts','native-chat.spec.ts','workspace.spec.ts'],use:{...chat.use,permissions:['microphone'],launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}},webServer:{...server,env:{...server.env,ASSISTANT_DICTATION_ENABLED:'true',ASSISTANT_COMMUNICATIONS_ENABLED:'true',TWILIO_SMS_ENABLED:'false',TWILIO_VOICE_ENABLED:'false',ASSISTANT_NOTIFICATIONS_ENABLED:'false',ASSISTANT_PUSH_ENABLED:'false'}}});
