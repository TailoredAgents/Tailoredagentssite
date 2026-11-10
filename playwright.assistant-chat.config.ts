import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';
import assistant from './playwright.assistant.config';
const server=assistant.webServer as Exclude<typeof assistant.webServer,unknown[]|undefined>;
export default defineConfig({...assistant,testMatch:['native-chat.spec.ts','workspace.spec.ts'],webServer:{...server,env:{...server.env,
 OPENAI_API_KEY:'synthetic-browser-fixture-only',ASSISTANT_CHAT_ENABLED:'true',ASSISTANT_BROWSER_TEST:'true',ASSISTANT_BACKGROUND_ENABLED:'true',
 NODE_OPTIONS:`--require="${resolve('tests/assistant/chat-provider-fixture.cjs').replaceAll('\\','/')}"`,
}}});
