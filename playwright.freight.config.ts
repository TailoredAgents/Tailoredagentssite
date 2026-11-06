import {defineConfig} from '@playwright/test';
import insurance from './playwright.insurance.config';
export default defineConfig({...insurance,testDir:'./tests/freight'});
