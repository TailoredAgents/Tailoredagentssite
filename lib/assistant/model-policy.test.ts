import {describe,it,expect} from 'vitest';
import {DEFAULT_PROFILE,resolveProfile,modelCost,modelReservation,outputLimit,transferableInput,routingSchema} from './model-policy';
describe('Assistant model policy',()=>{
 it('starts with Sol and supports task-dependent reasoning without changing models',()=>{
  expect(DEFAULT_PROFILE).toEqual({model:'gpt-6.1-sol',effort:'low'});
  for(const effort of ['low','medium','high'] as const)expect(resolveProfile({model:'gpt-6.1-sol',effort},[]).effort).toBe(effort);
 });
 it('requires a completed Sol high request before Astra and bounds all Astra attempts',()=>{
  const request={model:'gpt-6-astra',effort:'high'} as const;
  expect(resolveProfile(request,[]).model).toBe('gpt-6.1-sol');
  expect(resolveProfile(request,[{model:'gpt-6.1-sol',effort:'high',status:'reserved'}]).model).toBe('gpt-6.1-sol');
  const history=[{model:'gpt-6.1-sol',effort:'high',status:'completed'}];
  expect(resolveProfile(request,history).model).toBe('gpt-6-astra');
  history.push({model:'gpt-6-astra',effort:'high',status:'completed'},{model:'gpt-6-astra',effort:'high',status:'reserved'});
  expect(resolveProfile(request,history).model).toBe('gpt-6.1-sol');
 });
 it('reserves enough output for reasoning and uses model-specific conservative rates',()=>{
  const astra={model:'gpt-6-astra',effort:'high'} as const;
  expect(modelCost(astra,10000,2000)).toBe(225000);
  expect(modelCost(DEFAULT_PROFILE,10000,2000)).toBe(45000);
  expect(modelCost(DEFAULT_PROFILE,300000,1000)).toBe(1515000);
  expect(outputLimit(astra)).toBeGreaterThan(outputLimit(DEFAULT_PROFILE));
  expect(modelReservation(astra,1000)).toBeGreaterThan(modelReservation(DEFAULT_PROFILE,1000));
  expect(()=>modelReservation(DEFAULT_PROFILE,100001)).toThrow('too large');
 });
 it('drops encrypted reasoning on a model change but keeps messages and tool receipts',()=>{
  const input=[{type:'reasoning',encrypted_content:'opaque'},{type:'function_call_output',call_id:'receipt',output:'saved'},{role:'user',content:'Continue'}];
  expect(transferableInput(input,false)).toBe(input);
  expect(transferableInput(input,true)).toEqual(input.slice(1));
  expect(transferableInput('question',true)).toBe('question');
 });
 it('rejects unsupported models, pro mode, and empty escalation reasons',()=>{
  expect(routingSchema.safeParse({model:'other',effort:'high',reason:'A difficult question requires analysis'}).success).toBe(false);
  expect(routingSchema.safeParse({...DEFAULT_PROFILE,reason:'x'}).success).toBe(false);
  expect(routingSchema.safeParse({...DEFAULT_PROFILE,reason:'A difficult question requires analysis',mode:'pro'}).success).toBe(false);
 });
});
