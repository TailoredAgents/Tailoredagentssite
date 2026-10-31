import { describe,it,expect } from 'vitest';
import { nextIntroTime,introWindowOpen,composeIntroduction,introAnswerSchema,introSettingsSchema } from './policy';
const daily={start_minute:540,end_minute:1080,weekdays:[0,1,2,3,4,5,6]};
describe('Introduction policy',()=>{
 it('uses Eastern hours and waits overnight',()=>{
  expect(nextIntroTime(new Date('2026-10-30T12:30:00Z'),daily).toISOString()).toBe('2026-10-30T13:00:00.000Z');
  expect(nextIntroTime(new Date('2026-10-30T22:00:00Z'),daily).toISOString()).toBe('2026-10-31T13:00:00.000Z');
  expect(introWindowOpen(new Date('2026-10-30T16:00:20Z'),daily)).toBe(true);
 });
 it('handles DST and weekends',()=>{
  expect(nextIntroTime(new Date('2026-10-31T23:00:00Z'),daily).toISOString()).toBe('2026-11-01T14:00:00.000Z');
  expect(nextIntroTime(new Date('2026-03-07T23:00:00Z'),daily).toISOString()).toBe('2026-03-08T13:00:00.000Z');
  expect(nextIntroTime(new Date('2026-10-30T23:00:00Z'),{...daily,weekdays:[1,2,3,4,5]}).toISOString()).toBe('2026-11-02T14:00:00.000Z');
 });
 it('supports sparse leads and mixed interests without requiring a company',()=>{
  const text=composeIntroduction('Jamie',{topic:'website_seo',question:'What is your biggest priority for this project?'});
  expect(text).toContain('website and SEO');expect(text).toContain('team will also give you a call');
  expect(composeIntroduction('None',{topic:'general',question:'What would you like help with?'})).toMatch(/^Hi!/);
 });
 it('rejects multi-question, priced and linked output',()=>{
  for(const question of ['What do you need? When do you need it?','Ready for the $100 plan?','Can you visit https://bad.test?'])expect(introAnswerSchema.safeParse({topic:'general',question}).success).toBe(false);
 });
 it('requires explicit source, owner, number and review for activation',()=>{
  const config={enabled:true,numberId:null,ownerId:null,formIds:[],startMinute:540,endMinute:1080,weekdays:[1],instructions:'',dailyLimit:20,reviewed:false};
  expect(introSettingsSchema.safeParse(config).success).toBe(false);
  expect(introSettingsSchema.safeParse({...config,enabled:false}).success).toBe(true);
 });
});
