import {defineConfig} from '@playwright/test';
import reporting from './playwright.config';
export default defineConfig({...reporting,testDir:'./tests/insurance',webServer:{
 ...reporting.webServer as Exclude<typeof reporting.webServer,unknown[]|undefined>,
 env:{...(reporting.webServer as {env:Record<string,string>}).env,OPENAI_API_KEY:'',SMART_CARDS_AI_ENABLED:'false'},
}});
