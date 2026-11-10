import {beforeEach,describe,it,expect,vi} from 'vitest';
import type {Principal} from './oauth';
vi.mock('server-only',()=>({}));
const gateway=vi.hoisted(()=>({intent:vi.fn(),start:vi.fn(),send:vi.fn(),refresh:vi.fn()}));
vi.mock('@/lib/voice/service',()=>({createVoiceIntent:gateway.intent,startPhoneCall:gateway.start}));
vi.mock('@/lib/inbox/service',()=>({sendInboxMessage:gateway.send,InboxInputError:class extends Error{}}));
vi.mock('./oauth',()=>({refreshPrincipal:gateway.refresh}));
import {executeCall,executeEmail} from './outbound';
const p={grantId:'grant',sessionId:'session',scopes:['conversations:read','voice:send'],directActions:true,writesPaused:false,context:{user:{id:'employee'},workspace:{id:'workspace'},role:'owner'}} as Principal;
describe('Native chat outbound operations',()=>{
 beforeEach(()=>{vi.clearAllMocks();gateway.refresh.mockResolvedValue(p);gateway.intent.mockResolvedValue({callId:'call-123',intentToken:'secret-device-token'});});
 it('uses the employee phone flow, rechecks authority and never returns the device token',async()=>{
  gateway.start.mockResolvedValue('Answer your phone and press 1 to call the customer.');
  const result=await executeCall(p,{lineId:'00000000-0000-4000-8000-000000000001',to:'+16785550123',requestId:'00000000-0000-4000-8000-000000000002'});
  expect(gateway.intent.mock.calls[0][1].mode).toBe('phone');expect(gateway.refresh).toHaveBeenCalled();expect(gateway.start).toHaveBeenCalledWith(p.context,{callId:'call-123'});
  expect(result).toMatchObject({callId:'call-123'});expect(JSON.stringify(result)).not.toContain('secret-device-token');
 });
 it('does not redial an uncertain call or start after revoked permission',async()=>{
  const input={lineId:'00000000-0000-4000-8000-000000000001',to:'+16785550123',requestId:'00000000-0000-4000-8000-000000000002'};
  gateway.start.mockResolvedValue('The phone request is awaiting confirmation.');
  await expect(executeCall(p,input)).rejects.toMatchObject({outcome:'outcome_unknown'});expect(gateway.start).toHaveBeenCalledTimes(1);
  gateway.refresh.mockRejectedValue(Error('revoked'));
  await expect(executeCall(p,input)).rejects.toThrow('revoked');expect(gateway.start).toHaveBeenCalledTimes(1);
 });
 it('keeps uncertain email sends uncertain without retrying',async()=>{
  gateway.send.mockResolvedValue({sendState:'unknown',message:'Check status'});
  await expect(executeEmail(p,{mailboxId:'box',to:'customer@example.test',subject:'Appointment',text:'Reviewed content',requestId:'00000000-0000-4000-8000-000000000002'})).rejects.toMatchObject({outcome:'outcome_unknown'});
  expect(gateway.send).toHaveBeenCalledTimes(1);
 });
});
