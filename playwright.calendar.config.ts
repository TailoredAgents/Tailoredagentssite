import {defineConfig} from '@playwright/test';
import reporting from './playwright.config';
export default defineConfig({...reporting,testDir:'./tests/calendar'});
