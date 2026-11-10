import {defineConfig} from '@playwright/test';
import assistant from './playwright.assistant.config';
const server=assistant.webServer as Exclude<typeof assistant.webServer,unknown[]|undefined>;
export default defineConfig({...assistant,testMatch:'knowledge.spec.ts',webServer:{...server,env:{...server.env,OPENAI_API_KEY:'',ASSISTANT_CHAT_ENABLED:'false',ASSISTANT_KNOWLEDGE_ENABLED:'true',TWILIO_SMS_ENABLED:'false',TWILIO_VOICE_ENABLED:'false',MEETINGS_ENABLED:'false',ASSISTANT_NOTIFICATIONS_ENABLED:'false',ASSISTANT_PUSH_ENABLED:'false'}}});
