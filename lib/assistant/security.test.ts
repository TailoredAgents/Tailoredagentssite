import {describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {safeReturnTo} from './return-to';
import {validRedirect,parseScopes} from './config';
import {body,checkOrigin} from './http';
import {canonical} from './actions';
describe('Assistant request boundaries',()=>{
 it('permits only same-site sign-in return paths',()=>{
  for(const v of ['https://evil.example/dashboard','//evil.example/dashboard','/dashboard/../../evil','/dashboard/..//evil','/dashboard\\evil','javascript:alert(1)','\n/dashboard'])expect(safeReturnTo(v)).toBeUndefined();
  expect(safeReturnTo('/oauth/operations/authorize?state=123')).toBe('/oauth/operations/authorize?state=123');
  expect(safeReturnTo('/dashboard/assistant')).toBe('/dashboard/assistant');
 });
 it('rejects unsafe callbacks and unknown scopes',()=>{
  for(const v of ['javascript:alert(1)','https://user:pass@example.test/cb','https://example.test/cb#','http://example.test/cb','https://example.test/cb\n'])expect(validRedirect(v)).toBe(false);
  expect(validRedirect('https://chatgpt.com/connector_platform/oauth/callback')).toBe(true);
  expect(validRedirect('http://127.0.0.1:3000/callback')).toBe(true);
  expect(()=>parseScopes('admin:everything')).toThrow();expect(()=>parseScopes('')).toThrow();
 });
 it('requires same-origin human posts and rejects oversized or duplicate input',async()=>{
  const req=(content:string,type='application/json')=>new Request('https://www.tailoredagents.com',{method:'POST',headers:{'content-type':type},body:content});
  expect(()=>checkOrigin(req('{}'),true)).toThrow();
  await expect(body(req('a=1&a=2','application/x-www-form-urlencoded'))).rejects.toThrow();
  await expect(body(req('[]'))).rejects.toThrow();await expect(body(req('{"text":"too long"}'),8)).rejects.toThrow('large');
 });
 it('hashes the same parsed intent regardless of key order',()=>{expect(canonical({b:2,a:{z:1,y:'2'}})).toBe(canonical({a:{y:'2',z:1},b:2}));expect(canonical({a:1})).not.toBe(canonical({a:'1'}));});
});
