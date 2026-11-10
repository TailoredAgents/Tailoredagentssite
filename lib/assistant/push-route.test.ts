import {beforeEach,afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({identity:vi.fn(),register:vi.fn(),revoke:vi.fn(),status:vi.fn(),confirm:vi.fn(),open:vi.fn()}));
vi.mock('@/lib/dashboard/data',()=>({getOptionalDashboardContext:mocks.identity}));
vi.mock('@/lib/smart-cards/http',()=>({cardRateLimit:vi.fn()}));
vi.mock('./push-devices',()=>({registerPushDevice:mocks.register,revokePushInstallation:mocks.revoke,pushDeviceStatus:mocks.status,confirmPushDevice:mocks.confirm,openPushNotification:mocks.open}));
import {POST} from '@/app/api/assistant/push/route';
const binding={installationId:'00000000-0000-4000-8000-000000000001',secret:'a'.repeat(43)};
function request(value:unknown,origin:string|null='http://localhost:3162'){return new Request('http://localhost:3162/api/assistant/push',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(value)});}
beforeEach(()=>{vi.stubEnv('BETTER_AUTH_URL','http://localhost:3162');vi.stubEnv('BETTER_AUTH_SECRET','synthetic-push-route-only-secret-at-least32');vi.clearAllMocks();mocks.identity.mockResolvedValue({user:{id:'employee'}});mocks.revoke.mockResolvedValue({ok:true});mocks.status.mockResolvedValue({configured:false});});
afterEach(()=>vi.unstubAllEnvs());
it('requires exact same-origin requests, even for a secret-backed revocation',async()=>{
 for(const origin of [null,'https://other.example'])expect((await POST(request({operation:'revoke',...binding},origin))).status).toBe(403);
 expect(mocks.revoke).not.toHaveBeenCalled();
});
it('requires a real Dashboard session except for narrow installation revocation',async()=>{
 mocks.identity.mockResolvedValue(null);expect((await POST(request({operation:'status',...binding}))).status).toBe(401);expect(mocks.status).not.toHaveBeenCalled();expect((await POST(request({operation:'revoke',...binding}))).status).toBe(200);expect(mocks.revoke).toHaveBeenCalledWith({operation:'revoke',...binding});
});
it('rejects caller-selected identity and oversized bodies before registration',async()=>{
 expect((await POST(request({operation:'register',...binding,token:'a'.repeat(64),environment:'development',permission:'authorized',userId:'victim'}))).status).toBe(400);expect((await POST(request({extra:'x'.repeat(5000)}))).status).toBe(413);expect(mocks.register).not.toHaveBeenCalled();
});
