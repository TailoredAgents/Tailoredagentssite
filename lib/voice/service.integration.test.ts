import { savePhoneNumber } from "@/lib/conversations/phone-numbers";
import { deleteLead } from "@/lib/operations/delete-lead";
import { captureCallMemory, loadClientMemory } from "@/lib/conversations/memory";
import { randomUUID, createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import type { Pool } from "pg";
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import {
  startPhoneCall, receivePhoneAnswer,
  connectVoiceLine,
  saveVoiceGrant,
  saveVoiceRouting,
  saveVoiceForwarding,
  receiveVoiceForwardAnswer,
  updateVoicePresence,
  createVoiceIntent,
  receiveVoiceOutbound,
  receiveVoiceIncoming,
  receiveVoiceStaffAnswer,
  receiveVoiceStatus,
  receiveVoiceDialAction,
  receiveVoicemailStatus,
  receiveVoicemailAction,
  getVoicemailDownload,
  deleteVoicemail,
  acceptVoiceCall,
  issueVoiceToken,
  endCall,
} from "./service";
import { getVoiceWorkspace, getVoiceCall } from "./data";
import { runVoiceMaintenance } from "./maintenance";
import { receiveCallRecording, saveRecordingPreferences, getCallRecordingDownload, requestCallAnalysis, deleteCallRecording } from "./recordings";
import { runCallRecordingWorker } from "./recording-worker";
import { createCallFollowUpTask, getCallFollowUpOptions, getCallFollowUpTask, updateCallFollowUpTask, completeCallFollowUpTask } from "./follow-up-tasks";
import { getSalesToday } from "@/lib/sales/data";
import {
  listConversationWorkspace,
  loadConversationSourceHistory,
} from "@/lib/conversations/data";
import {
  mergeConversations,
  addConversationNote,
} from "@/lib/conversations/service";
vi.mock("server-only", () => ({}));
const provider = vi.hoisted(() => ({
  create: vi.fn(),
  lookup: vi.fn(),
  fetch: vi.fn(),
  remove: vi.fn(),
  token: vi.fn(),
  end: vi.fn(),
  recording: vi.fn(), media: vi.fn(), deleteRecording: vi.fn(), findRecording: vi.fn(), transcribe: vi.fn(), summarize: vi.fn(),
}));
vi.mock("@/lib/voice-provider/provider", () => ({
  createPhoneCall: provider.create,
  VoiceProviderError: class extends Error { constructor(readonly outcome: string, message: string) { super(message); } },
  lookupOwnedVoiceNumber: provider.lookup,
  fetchVoiceCall: provider.fetch,
  deleteVoicemailMedia: provider.remove,
  endVoiceCall: provider.end,
  fetchCallRecording: provider.recording,
  fetchCallRecordingMedia: provider.media,
  deleteCallRecordingMedia: provider.deleteRecording,
  findCallRecording: provider.findRecording,
}));
vi.mock("./analysis-provider",async(importOriginal)=>({...(await importOriginal<typeof import("./analysis-provider")>()),transcribeCallAudio:provider.transcribe,summarizeCallTranscript:provider.summarize}));
vi.mock("@/lib/voice-provider/token", () => ({
  createVoiceAccessToken: provider.token,
  voiceIdentity: (ws: string, user: string) =>
    "ta_" +
    createHash("sha256")
      .update(JSON.stringify([ws, user]))
      .digest("hex")
      .slice(0, 48),
}));
vi.mock("@/lib/inbox/mail-provider", () => ({
  listMailboxes: vi.fn().mockResolvedValue([]),
  MailProviderError: class extends Error {},
}));
const url = process.env.TEST_VOICE_DATABASE_URL,
  ws = "00000000-0000-4000-8000-000000000001",
  otherWs = "00000000-0000-4000-8000-000000006666",
  account = "AC" + "1".repeat(32),
  phone = "+16785417725",
  remote = "+14045550101";
const sid = (n: number) => "CA" + n.toString(16).padStart(32, "0"),
  rec = (n: number) => "RE" + n.toString(16).padStart(32, "0");
const actor = (
  id = "voice-owner",
  workspace = ws,
  role: DashboardContext["role"] = "owner",
): DashboardContext => ({
  user: { id, name: id, email: id + "@example.test" },
  workspace: { id: workspace, name: "Voice fixture", slug: "fixture" },
  role,
});
let pool: Pool, lineId: string;
const owner = actor(),
  member = actor("voice-member", ws, "member"),
  reader = actor("voice-reader", ws, "member"),
  viewer = actor("voice-viewer", ws, "owner");
function identity(user = "voice-owner") {
  return (
    "ta_" +
    createHash("sha256")
      .update(JSON.stringify([ws, user]))
      .digest("hex")
      .slice(0, 48)
  );
}
async function reserve(
  to = remote,
  context = owner,
  requestId = randomUUID(),
  conversationId?: string,
) {
  return createVoiceIntent(context, { lineId, to, requestId, conversationId });
}
async function incoming(n = 10, from = remote) {
  return receiveVoiceIncoming({
    AccountSid: account,
    CallSid: sid(n),
    From: from,
    To: phone,
  });
}
async function allHours() {
  await saveVoiceRouting(owner, {
    lineId,
    status: "active",
    timezone: "UTC",
    start: "00:00",
    end: "23:59",
    days: [0, 1, 2, 3, 4, 5, 6],
    ringSeconds: 20,
    greeting: "Please leave a message. This voicemail will be recorded.",
  });
}
async function grant(
  userId: string,
  canCall = false,
  canReceive = false,
  canManageVoicemail = false,
) {
  return saveVoiceGrant(owner, {
    lineId,
    userId,
    canRead: true,
    canCall,
    canReceive,
    canManageVoicemail,
  });
}
describe.skipIf(!url)(
  "Browser voice and voicemail with guarded PostgreSQL",
  () => {
    beforeAll(async () => {
      const parsed = new URL(url!);
      if (
        !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
        parsed.port !== "55433" ||
        parsed.pathname !== "/ta_voice_test" ||
        parsed.search ||
        parsed.hash
      )
        throw Error("Use exact ta_voice_test on55433.");
      vi.stubEnv("DATABASE_URL", url!);
      vi.stubEnv("BETTER_AUTH_SECRET", "voice-test-secret-".repeat(4));
      vi.stubEnv("TWILIO_ACCOUNT_SID", account);
      vi.stubEnv("TWILIO_AUTH_TOKEN", "synthetic-auth-token-".repeat(2));
      vi.stubEnv("TWILIO_API_KEY_SID", "SK" + "2".repeat(32));
      vi.stubEnv("TWILIO_API_KEY_SECRET", "synthetic-api-secret-".repeat(2));
      vi.stubEnv("TWILIO_PHONE_NUMBER", phone);
      vi.stubEnv("TWILIO_VOICE_APP_SID", "AP" + "3".repeat(32));
      vi.stubEnv("TWILIO_VOICE_ENABLED", "true");
      vi.stubEnv("BETTER_AUTH_URL", "http://127.0.0.1:3150");
      pool = getDatabasePool();
      expect(
        (await pool.query("SELECT current_database() name")).rows[0].name,
      ).toBe("ta_voice_test");
      await pool.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())",
      );
      for (const filename of (await readdir("db/migrations"))
        .filter((f) => f.endsWith(".sql"))
        .sort()) {
        if (
          (
            await pool.query(
              "SELECT 1 FROM schema_migrations WHERE filename=$1",
              [filename],
            )
          ).rowCount
        )
          continue;
        const db = await pool.connect();
        try {
          await db.query("BEGIN");
          await db.query(await readFile("db/migrations/" + filename, "utf8"));
          await db.query("INSERT INTO schema_migrations(filename) VALUES($1)", [
            filename,
          ]);
          await db.query("COMMIT");
        } catch (e) {
          await db.query("ROLLBACK");
          throw e;
        } finally {
          db.release();
        }
      }
    }, 30000);
    beforeEach(async () => {
      await pool.query(
        'TRUNCATE voice_lines,crm_conversations,sms_numbers,inbox_conversations,crm_channel_preferences,contacts,crm_businesses,leads,audit_logs,"user" CASCADE',
      );
      await pool.query("DELETE FROM workspaces WHERE id=$1", [otherWs]);
      await pool.query("UPDATE workspaces SET status='active' WHERE id=$1", [
        ws,
      ]);
      await pool.query(
        "INSERT INTO workspaces(id,slug,name,kind,status) VALUES($1,'voice-other','Other','internal','active')",
        [otherWs],
      );
      for (const [id, role, workspace] of [
        ["voice-owner", "owner", ws],
        ["voice-member", "member", ws],
        ["voice-reader", "member", ws],
        ["voice-viewer", "viewer", ws],
        ["voice-other", "owner", otherWs],
      ]) {
        await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$1,$2)', [
          id,
          id + "@example.test",
        ]);
        await pool.query(
          "INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')",
          [randomUUID(), workspace, id, role],
        );
      }
      provider.lookup.mockResolvedValue({
        accountSid: account,
        phone,
        providerSid: "PN" + "4".repeat(32),
        voiceEnabled: true,
      });
      provider.remove.mockResolvedValue({ deleted: true });
      provider.fetch.mockReset(); provider.create.mockReset(); provider.end.mockReset();
      provider.token.mockReturnValue({
        token: "synthetic-token",
        identity: identity(),
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      });
      lineId = await connectVoiceLine(owner, { phone });
      provider.recording.mockReset();provider.media.mockReset();provider.deleteRecording.mockReset();provider.findRecording.mockReset();provider.transcribe.mockReset();provider.summarize.mockReset();
      provider.deleteRecording.mockResolvedValue({deleted:true});
      provider.findRecording.mockResolvedValue(null);
      vi.stubEnv("CALL_ANALYSIS_ENABLED","false");vi.stubEnv("OPENAI_API_KEY","");
      await allHours();
    });
    afterAll(async () => {
      if (pool) await pool.end();
      (
        globalThis as typeof globalThis & {
          tailoredAgentsDatabasePool?: unknown;
        }
      ).tailoredAgentsDatabasePool = undefined;
      vi.unstubAllEnvs();
    });
    async function recordedCall(n=77) {
      const intent=await reserve();
      await receiveVoiceOutbound({AccountSid:account,CallSid:sid(n),From:`client:${identity()}`,IntentToken:intent.intentToken});
      provider.recording.mockResolvedValue({recordingSid:rec(n),callSid:sid(n),status:"completed",duration:40,channels:2});
      await receiveCallRecording(intent.callId,{AccountSid:account,CallSid:sid(n),RecordingSid:rec(n),RecordingStatus:"completed"});
      const recording=(await getVoiceCall(owner,intent.callId)).recording!;
      return {callId:intent.callId,id:recording.id,params:{AccountSid:account,CallSid:sid(n),RecordingSid:rec(n),RecordingStatus:"completed"}};
    }
    async function suggestedCall() {
      const r=await recordedCall();
      const quote="Please send a website proposal next week.";
      await pool.query("UPDATE voice_call_recordings SET transcript=$2,summary=$3,analysis_status='ready' WHERE id=$1",[r.id,quote,JSON.stringify({summary:"Website proposal requested.",highlights:[],followUps:[{text:"Prepare the website proposal.",quote}]})]);
      return {...r,input:{recordingId:r.id,suggestionIndex:0,title:"Review the website proposal",ownerUserId:member.user.id,dueAt:new Date(Date.now()+86400000).toISOString(),notes:"Review the site scope first."}};
    }
    async function phoneIntent() {
      await saveVoiceForwarding(owner,{lineId,mode:"forward",userId:owner.user.id,phone:"4045550199",always:true});
      return createVoiceIntent(owner,{lineId,to:remote,requestId:randomUUID(),mode:"phone"});
    }
    function phoneParent(n=90) { return {sid:sid(n),accountSid:account,parentCallSid:null,from:phone,to:"+14045550199",direction:"outbound-api",status:"ringing",duration:null}; }
    function phoneParams(n=90) { return {AccountSid:account,CallSid:sid(n),From:phone,To:"+14045550199"}; }
    it("rings the approved staff phone once and only dials the customer after press one",async()=>{
      const i=await phoneIntent();provider.create.mockResolvedValue(phoneParent());provider.fetch.mockResolvedValue(phoneParent());
      await Promise.all([startPhoneCall(owner,{callId:i.callId}),startPhoneCall(owner,{callId:i.callId})]);
      expect(provider.create).toHaveBeenCalledTimes(1);expect(provider.create).toHaveBeenCalledWith({callId:i.callId,phone:"+14045550199"});
      expect(await receivePhoneAnswer(i.callId,phoneParams())).toBeNull();
      expect(await receivePhoneAnswer(i.callId,{...phoneParams(),Digits:"2"},true)).toBeNull();
      expect((await getVoiceCall(owner,i.callId)).answeredAt).toBeNull();
      const dial=await receivePhoneAnswer(i.callId,{...phoneParams(),Digits:"1"},true);
      expect(dial).toMatchObject({from:phone,to:remote,callId:i.callId,recordCalls:true});
      await expect(receivePhoneAnswer(i.callId,{...phoneParams(),Digits:"1"},true)).rejects.toThrow();
      await expect(receiveVoiceOutbound({AccountSid:account,CallSid:sid(91),From:`client:${identity()}`,IntentToken:i.intentToken})).rejects.toThrow();
      // Parent handset answer is not customer answer and its duration includes screening.
      await receiveVoiceStatus({...phoneParams(),CallStatus:"in-progress"},{callId:i.callId,leg:"parent"});
      expect((await getVoiceCall(owner,i.callId)).answeredAt).toBeNull();
      provider.fetch.mockResolvedValue({...phoneParent(91),parentCallSid:sid(90),to:remote,direction:"outbound-dial"});
      await receiveVoiceStatus({AccountSid:account,CallSid:sid(91),From:phone,To:remote,ParentCallSid:sid(90),CallStatus:"in-progress"},{callId:i.callId,leg:"customer"});
      expect((await getVoiceCall(owner,i.callId)).answeredAt).not.toBeNull();
      await receiveVoiceStatus({AccountSid:account,CallSid:sid(91),From:phone,To:remote,ParentCallSid:sid(90),CallStatus:"completed",CallDuration:"20"},{callId:i.callId,leg:"customer"});
      provider.fetch.mockResolvedValue(phoneParent());
      await receiveVoiceStatus({...phoneParams(),CallStatus:"completed",CallDuration:"35"},{callId:i.callId,leg:"parent"});
      expect((await getVoiceCall(owner,i.callId)).duration).toBe(20);
      expect((await getVoiceCall(owner,i.callId)).recording).not.toBeNull();
    });
    it("recovers an uncertain provider create from signed callbacks without redialing",async()=>{
      const i=await phoneIntent();provider.create.mockRejectedValue(new Error("timeout"));provider.fetch.mockResolvedValue(phoneParent());
      await startPhoneCall(owner,{callId:i.callId});await startPhoneCall(owner,{callId:i.callId});
      expect(provider.create).toHaveBeenCalledTimes(1);
      await expect(createVoiceIntent(owner,{lineId,to:remote,requestId:randomUUID(),mode:"phone"})).rejects.toThrow("existing phone call");
      await receiveVoiceStatus({...phoneParams(),CallStatus:"ringing"},{callId:i.callId,leg:"parent"});
      expect((await pool.query("SELECT parent_sid FROM voice_calls WHERE id=$1",[i.callId])).rows[0].parent_sid).toBe(sid(90));
      expect(await receivePhoneAnswer(i.callId,{...phoneParams(),Digits:"1"},true)).toMatchObject({to:remote});
    });
    it("rejects other actors, changed destinations and substituted call legs",async()=>{
      const i=await phoneIntent();provider.create.mockResolvedValue(phoneParent());provider.fetch.mockResolvedValue(phoneParent());
      expect((await getVoiceWorkspace(owner)).lines[0].callbackPhone).toBe("+14045550199");
      await expect(startPhoneCall(member,{callId:i.callId})).rejects.toThrow();
      await expect(startPhoneCall(actor("voice-other",otherWs),{callId:i.callId})).rejects.toThrow();
      await expect(createVoiceIntent(member,{lineId,to:remote,mode:"phone",requestId:randomUUID()})).rejects.toThrow();
      await startPhoneCall(owner,{callId:i.callId});
      provider.fetch.mockResolvedValue({...phoneParent(),to:remote});
      await expect(receivePhoneAnswer(i.callId,phoneParams())).rejects.toThrow("identity changed");
      provider.fetch.mockResolvedValue(phoneParent());
      await expect(receivePhoneAnswer(i.callId,phoneParams(91))).rejects.toThrow();
      await saveVoiceForwarding(owner,{lineId,mode:"forward",userId:owner.user.id,phone:"4045550198",always:true});
      await expect(receivePhoneAnswer(i.callId,{...phoneParams(),Digits:"1"},true)).rejects.toThrow();
    });
    it("cancels while creation is in flight and cannot dial a customer afterward",async()=>{
      const i=await phoneIntent();let resolve!:(value:ReturnType<typeof phoneParent>)=>void;
      provider.create.mockImplementation(()=>new Promise(r=>{resolve=r;}));provider.fetch.mockResolvedValue(phoneParent());provider.end.mockResolvedValue({...phoneParent(),status:"canceled"});
      const started=startPhoneCall(owner,{callId:i.callId});await vi.waitFor(()=>expect(provider.create).toHaveBeenCalledTimes(1));
      await endCall(owner,{callId:i.callId});resolve(phoneParent());await started;
      expect(provider.end).toHaveBeenCalledWith(sid(90));
      await expect(receivePhoneAnswer(i.callId,{...phoneParams(),Digits:"1"},true)).rejects.toThrow();
      expect((await getVoiceCall(owner,i.callId)).status).toBe("canceled");
    });
    it("does not count personal voicemail as a customer answer and rechecks current access",async()=>{
      const i=await phoneIntent();provider.create.mockResolvedValue(phoneParent());provider.fetch.mockResolvedValue(phoneParent());
      await startPhoneCall(owner,{callId:i.callId});
      await pool.query("UPDATE voice_line_grants SET can_call=false WHERE line_id=$1 AND user_id=$2",[lineId,owner.user.id]);
      await expect(receivePhoneAnswer(i.callId,{...phoneParams(),Digits:"1"},true)).rejects.toThrow();
      await receiveVoiceStatus({...phoneParams(),CallStatus:"completed",CallDuration:"10"},{callId:i.callId,leg:"parent"});
      const call=await getVoiceCall(owner,i.callId);expect(call.status).toBe("no-answer");expect(call.answeredAt).toBeNull();expect(call.duration).toBeNull();expect(call.recording).toBeNull();
    });
    it("cancels an unstarted phone reservation without sending anything to the provider",async()=>{
      const i=await phoneIntent();await endCall(owner,{callId:i.callId});
      await expect(startPhoneCall(owner,{callId:i.callId})).rejects.toThrow();expect(provider.create).not.toHaveBeenCalled();
    });
    it("keeps unanswered handset calls distinct from answered customer calls",async()=>{
      const i=await phoneIntent();provider.create.mockResolvedValue(phoneParent());provider.fetch.mockResolvedValue(phoneParent());
      await startPhoneCall(owner,{callId:i.callId});
      await receiveVoiceStatus({...phoneParams(),CallStatus:"no-answer"},{callId:i.callId,leg:"parent"});
      const call=await getVoiceCall(owner,i.callId);expect(call.status).toBe("no-answer");expect(call.answeredAt).toBeNull();expect(call.recording).toBeNull();
    });
    it("calls saved alternate numbers within the same customer history and leaves shared numbers unlinked",async()=>{
      const lead=randomUUID();
      await pool.query("INSERT INTO leads(id,workspace_id,name,organization,phone) VALUES($1,$2,'Two numbers','',$3)",[lead,ws,remote]);
      const primary=await createVoiceIntent(owner,{lineId,to:remote,requestId:randomUUID(),recipient:{kind:"lead",id:lead}});
      await pool.query("UPDATE voice_calls SET status='completed' WHERE id=$1",[primary.callId]);
      const alternate="+14045550102";
      await savePhoneNumber(owner,{kind:"lead",id:lead,operation:"save",phone:alternate,label:"Website"});
      const second=await createVoiceIntent(owner,{lineId,to:alternate,requestId:randomUUID(),recipient:{kind:"lead",id:lead},conversationId:primary.conversationId});
      expect(second.conversationId).toBe(primary.conversationId);
      expect((await pool.query("SELECT remote_phone FROM voice_conversations WHERE id=(SELECT voice_conversation_id FROM voice_calls WHERE id=$1)",[second.callId])).rows[0].remote_phone).toBe(alternate);
      await pool.query("UPDATE voice_calls SET status='completed' WHERE id=$1",[second.callId]);
      const shared="+14045550103",other=randomUUID();
      await savePhoneNumber(owner,{kind:"lead",id:lead,operation:"save",phone:shared,label:"Office"});
      await pool.query("INSERT INTO leads(id,workspace_id,name,organization,phone) VALUES($1,$2,'Other person','',$3)",[other,ws,shared]);
      const incomingShared=await incoming(93,shared);
      const linked=(await pool.query("SELECT c.id,c.lead_id FROM crm_conversations c JOIN crm_conversation_sources s ON s.conversation_id=c.id JOIN voice_calls v ON v.voice_conversation_id=s.voice_conversation_id WHERE v.id=$1",[incomingShared.callId])).rows[0];
      expect(linked.lead_id).toBeNull();expect(linked.id).not.toBe(primary.conversationId);
    });
    it("links a first call to the chosen lead and rejects mismatched or conflicting identities",async()=>{
      const lead=randomUUID(),other=randomUUID();
      await pool.query("INSERT INTO leads(id,workspace_id,name,organization,phone) VALUES($1,$2,'First caller','',$3),($4,$2,'Different lead','',$3)",[lead,ws,remote,other]);
      const input={lineId,to:remote,requestId:randomUUID(),recipient:{kind:"lead",id:lead}};
      const call=await createVoiceIntent(owner,input);
      expect((await pool.query("SELECT lead_id FROM crm_conversations WHERE id=$1",[call.conversationId])).rows[0].lead_id).toBe(lead);
      expect((await createVoiceIntent(owner,input)).callId).toBe(call.callId);
      await expect(createVoiceIntent(owner,{...input,requestId:randomUUID(),recipient:{kind:"lead",id:other}})).rejects.toThrow("another CRM record");
      await expect(createVoiceIntent(owner,{...input,requestId:randomUUID(),to:"+14045550102"})).rejects.toThrow("phone number must match");
      await expect(createVoiceIntent(actor("voice-other",otherWs),input)).rejects.toThrow();
      expect((await pool.query("SELECT id FROM voice_calls")).rowCount).toBe(1);
    });
    it("links an incoming call to a unique lead, leaving ambiguous new callers unlinked",async()=>{
      const lead=randomUUID();await pool.query("INSERT INTO leads(id,workspace_id,name,organization,phone) VALUES($1,$2,'Inbound lead','',$3)",[lead,ws,remote]);
      const call=await incoming();
      expect((await pool.query("SELECT lead_id FROM crm_conversations c JOIN crm_conversation_sources s ON s.conversation_id=c.id JOIN voice_calls v ON v.voice_conversation_id=s.voice_conversation_id WHERE v.id=$1",[call.callId])).rows[0].lead_id).toBe(lead);
      const shared="+14045550109";
      await pool.query("INSERT INTO leads(id,workspace_id,name,organization,phone) VALUES(gen_random_uuid(),$1,'Shared A','',$2),(gen_random_uuid(),$1,'Shared B','',$2)",[ws,shared]);
      const ambiguous=await incoming(11,shared);
      expect((await pool.query("SELECT lead_id,contact_id FROM crm_conversations c JOIN crm_conversation_sources s ON s.conversation_id=c.id JOIN voice_calls v ON v.voice_conversation_id=s.voice_conversation_id WHERE v.id=$1",[ambiguous.callId])).rows[0]).toEqual({lead_id:null,contact_id:null});
    });
    it("remembers call takeaways once, respects grants, and separates normal expiry from explicit deletion",async()=>{
      const r=await suggestedCall();const call=await getVoiceCall(owner,r.callId);
      await Promise.all([captureCallMemory(),captureCallMemory()]);
      const memory=await loadClientMemory(owner,call.conversationId!);expect(memory).toHaveLength(1);expect(memory[0].text).toContain("Prepare the website proposal");
      expect(await loadClientMemory(member,call.conversationId!)).toEqual([]);
      await pool.query("UPDATE voice_call_recordings SET expires_at=now()-interval '1 day' WHERE id=$1",[r.id]);
      await runCallRecordingWorker();expect(await loadClientMemory(owner,call.conversationId!)).toHaveLength(1);
      await deleteCallRecording(owner,r.id);expect(await loadClientMemory(owner,call.conversationId!)).toEqual([]);
      await captureCallMemory();expect((await pool.query("SELECT id FROM crm_client_memory")).rowCount).toBe(0);
    });
    it("deletes linked call history, reviewed tasks and memory, then purges recording media",async()=>{
      await grant(member.user.id);const r=await suggestedCall();
      const call=await getVoiceCall(owner,r.callId);
      await createCallFollowUpTask(owner,r.input);
      const lead=randomUUID();
      await pool.query("INSERT INTO leads(id,workspace_id,name,organization) VALUES($1,$2,'Delete recorded lead','')",[lead,ws]);
      await pool.query("UPDATE crm_conversations SET lead_id=$2 WHERE id=$1",[call.conversationId,lead]);
      await pool.query("UPDATE voice_calls SET status='completed',ended_at=now() WHERE id=$1",[r.callId]);
      await deleteLead(owner,{leadId:lead,confirmed:'yes'});
      expect((await pool.query("SELECT id FROM crm_tasks")).rowCount).toBe(0);
      expect((await pool.query("SELECT id FROM crm_client_memory")).rowCount).toBe(0);
      expect((await pool.query("SELECT status,transcript,summary FROM voice_call_recordings WHERE id=$1",[r.id])).rows[0]).toEqual({status:'deleting',transcript:null,summary:null});
      await expect(getVoiceCall(owner,r.callId)).rejects.toThrow();
      await expect(getCallRecordingDownload(owner,r.id)).rejects.toThrow();
      await runCallRecordingWorker();
      expect(provider.deleteRecording).toHaveBeenCalledTimes(1);
      expect((await pool.query("SELECT status FROM voice_call_recordings WHERE id=$1",[r.id])).rows[0].status).toBe('deleted');
      await captureCallMemory();expect((await pool.query("SELECT id FROM crm_client_memory")).rowCount).toBe(0);
    });
    it("creates only reviewed tasks, saves edited details and schedules them in the assignee's My Day",async()=>{
      await grant(member.user.id);const r=await suggestedCall();
      expect((await pool.query("SELECT id FROM crm_tasks")).rowCount).toBe(0);
      const options=await getCallFollowUpOptions(owner,r.id,0);expect(options.members.map(m=>m.id)).toEqual(expect.arrayContaining([owner.user.id,member.user.id]));expect(options.members.map(m=>m.id)).not.toContain(viewer.user.id);
      const ids=await Promise.all([createCallFollowUpTask(owner,r.input),createCallFollowUpTask(owner,r.input)]);expect(ids[0]).toBe(ids[1]);expect((await pool.query("SELECT id FROM crm_tasks")).rowCount).toBe(1);
      const saved=await getCallFollowUpTask(member,ids[0]);expect(saved.title).toBe(r.input.title);expect(saved.notes).toBe(r.input.notes);expect(saved.ownerId).toBe(member.user.id);expect(saved.dueAt).toBe(r.input.dueAt);
      await pool.query("INSERT INTO voice_line_grants(workspace_id,line_id,user_id,can_read) VALUES($1,$2,$3,true)",[ws,lineId,viewer.user.id]);expect((await getCallFollowUpTask(viewer,ids[0])).canEdit).toBe(false);await expect(completeCallFollowUpTask(viewer,{taskId:ids[0],status:"completed",outcome:"Cannot write as a viewer."})).rejects.toThrow("read-only");
      expect((await getSalesToday(member)).tasks.map(t=>t.id)).toContain(ids[0]);expect((await getSalesToday(owner)).tasks.map(t=>t.id)).not.toContain(ids[0]);expect((await getSalesToday(owner,"team")).tasks.map(t=>t.id)).toContain(ids[0]);
      expect((await getVoiceCall(owner,r.callId)).recording?.followUpTasks).toEqual([{suggestionIndex:0,taskId:ids[0],status:"open"}]);
      const conversation=(await listConversationWorkspace(owner,{conversation:saved.conversationId})).selected;expect(conversation?.context.nextTask?.id).toBe(ids[0]);expect(conversation?.context.nextTask?.href).toBe(`/dashboard/tasks/${ids[0]}`);
    });
    it("rejects missing dates, inaccessible assignees, forged workspaces and viewer writes",async()=>{
      const r=await suggestedCall();
      for(const input of [{...r.input,dueAt:""},{...r.input,dueAt:"2026-10-22T09:00"},{...r.input,ownerUserId:""},{...r.input,suggestionIndex:4},{...r.input,title:" "}])await expect(createCallFollowUpTask(owner,input)).rejects.toThrow();
      await expect(createCallFollowUpTask(owner,r.input)).rejects.toThrow("teammate");
      await pool.query("INSERT INTO voice_line_grants(workspace_id,line_id,user_id,can_read) VALUES($1,$2,$3,true)",[ws,lineId,viewer.user.id]);await expect(createCallFollowUpTask(viewer,{...r.input,ownerUserId:owner.user.id})).rejects.toThrow("read-only");
      await expect(createCallFollowUpTask(actor("voice-other",otherWs),r.input)).rejects.toThrow();
      expect((await pool.query("SELECT id FROM crm_tasks")).rowCount).toBe(0);
    });
    it("keeps call-derived work hidden after line access is revoked, including the team queue",async()=>{
      await grant(member.user.id);const r=await suggestedCall(),id=await createCallFollowUpTask(owner,r.input);
      await pool.query("DELETE FROM voice_line_grants WHERE user_id=$1",[member.user.id]);
      expect((await getSalesToday(member)).tasks).toEqual([]);expect((await getSalesToday(member,"team")).tasks).toEqual([]);
      await expect(getCallFollowUpTask(member,id)).rejects.toThrow();await expect(updateCallFollowUpTask(member,{...r.input,taskId:id})).rejects.toThrow();
      await expect(completeCallFollowUpTask(member,{taskId:id,status:"completed",outcome:"Cannot bypass revoked access."})).rejects.toThrow();
    });
    it("reschedules and reassigns reviewed work, then saves the outcome and clears the open queue",async()=>{
      await grant(member.user.id);const r=await suggestedCall(),id=await createCallFollowUpTask(owner,r.input);
      const dueAt=new Date(Date.now()+2*86400000).toISOString();
      await updateCallFollowUpTask(member,{taskId:id,title:"Send the revised proposal",ownerUserId:owner.user.id,dueAt,notes:"Updated scope agreed."});
      expect((await getSalesToday(member)).tasks).toEqual([]);expect((await getSalesToday(owner)).tasks.map(t=>t.id)).toContain(id);
      await expect(completeCallFollowUpTask(owner,{taskId:id,status:"completed",outcome:""})).rejects.toThrow();
      await completeCallFollowUpTask(owner,{taskId:id,status:"completed",outcome:"Proposal reviewed with the customer."});
      const task=await getCallFollowUpTask(owner,id);expect(task.status).toBe("completed");expect(task.outcome).toContain("reviewed");expect((await getSalesToday(owner)).tasks).toEqual([]);
      await expect(updateCallFollowUpTask(owner,{taskId:id,title:"Reopen silently",ownerUserId:owner.user.id,dueAt})).rejects.toThrow();expect(await createCallFollowUpTask(owner,r.input)).toBe(id);
    });
    it("preserves an explicitly created task after audio deletion while rejecting fresh conversions",async()=>{
      await grant(member.user.id);const r=await suggestedCall(),id=await createCallFollowUpTask(owner,r.input);await deleteCallRecording(owner,r.id);
      expect((await getCallFollowUpTask(member,id)).title).toBe(r.input.title);expect((await getSalesToday(member)).tasks.map(t=>t.id)).toContain(id);
      await expect(createCallFollowUpTask(owner,r.input)).rejects.toThrow("no longer available");
    });
    it("keeps source-linked tasks attached when conversation histories are combined",async()=>{
      await grant(member.user.id);const r=await suggestedCall(),id=await createCallFollowUpTask(owner,r.input);const other=await incoming(91,"+14045550199");
      const before=await getCallFollowUpTask(owner,id),target=(await getVoiceCall(owner,other.callId)).conversationId;
      await mergeConversations(owner,{conversationId:before.conversationId,targetConversationId:target,confirmConflict:true});
      expect((await getCallFollowUpTask(member,id)).conversationId).toBe(target);expect((await getSalesToday(member)).tasks.map(t=>t.id)).toContain(id);
    });
    it("protects recent call follow-ups during prospect retention and scrubs expired human task content",async()=>{
      const business=randomUUID(),contact=randomUUID();
      await pool.query("INSERT INTO crm_businesses(id,workspace_id,name,normalized_phone) VALUES($1,$2,'Retention fixture',$3)",[business,ws,remote]);
      await pool.query("INSERT INTO contacts(id,workspace_id,business_id,name,phone) VALUES($1,$2,$3,'Retention contact',$4)",[contact,ws,business,remote]);
      await grant(member.user.id);const r=await suggestedCall(),id=await createCallFollowUpTask(owner,r.input);
      await pool.query("UPDATE crm_businesses SET updated_at=now()-interval '3 years',retained_until=now()-interval '1 year' WHERE id=$1",[business]);
      await pool.query("SELECT perform_reporting_retention()");expect((await pool.query("SELECT anonymized_at FROM crm_businesses WHERE id=$1",[business])).rows[0].anonymized_at).toBeNull();
      await pool.query("UPDATE crm_tasks SET updated_at=now()-interval '3 years',due_at=now()-interval '3 years',completion_outcome='Old private outcome' WHERE id=$1",[id]);
      await pool.query("SELECT perform_reporting_retention()");const task=(await pool.query("SELECT title,notes,completion_outcome,status FROM crm_tasks WHERE id=$1",[id])).rows[0];expect(task).toEqual({title:"Expired follow-up",notes:null,completion_outcome:null,status:"cancelled"});
    });
    it("preserves the reporting function in an older retention chain during the task upgrade",async()=>{
      const sql=await readFile("db/migrations/0015_call_follow_up_tasks.sql","utf8");
      const guard=sql.slice(sql.indexOf("DO $call_task_retention_upgrade$"),sql.indexOf("CREATE OR REPLACE FUNCTION perform_reporting_retention_before_inbox"));
      const db=await pool.connect(),schema="call_task_upgrade_"+randomUUID().replaceAll("-","");
      try {
        await db.query("BEGIN");await db.query(`CREATE SCHEMA "${schema}"`);await db.query(`SET LOCAL search_path="${schema}"`);
        await db.query("CREATE FUNCTION perform_reporting_retention_before_inbox() RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM 1; END $$");
        await db.query(guard);await db.query(guard);
        const result=(await db.query("SELECT pg_get_functiondef('perform_reporting_retention_before_agency_sales()'::regprocedure) body")).rows[0];expect(result.body).toContain("PERFORM 1");expect((await db.query("SELECT to_regprocedure('perform_reporting_retention_before_inbox()') value")).rows[0].value).toBeNull();
      } finally {await db.query("ROLLBACK");db.release();}
    });
    it("records new calls automatically without an announcement, snapshots preferences and skips voicemail-only calls",async()=>{
      const line=(await getVoiceWorkspace(owner)).lines[0];expect(line.recordCalls).toBe(true);expect(line.recordingAnnouncement).toBe(false);
      const call=await recordedCall();
      await saveRecordingPreferences(owner,{lineId,recordCalls:false,recordingAnnouncement:true,autoTranscribe:false});
      expect((await pool.query("SELECT recording_requested,recording_announcement FROM voice_calls WHERE id=$1",[call.callId])).rows[0]).toEqual({recording_requested:true,recording_announcement:false});
      await expect(saveRecordingPreferences(member,{lineId,recordCalls:true,recordingAnnouncement:false,autoTranscribe:true})).rejects.toThrow();
      const another=await reserve();const response=await receiveVoiceOutbound({AccountSid:account,CallSid:sid(78),From:`client:${identity()}`,IntentToken:another.intentToken});expect(response.recordCalls).toBe(false);
      const voicemailCall=await incoming(79);expect((await getVoiceCall(owner,voicemailCall.callId)).recording).toBeNull();
      await saveRecordingPreferences(owner,{lineId,recordCalls:true,recordingAnnouncement:false,autoTranscribe:false});
      const unanswered=await reserve();await receiveVoiceOutbound({AccountSid:account,CallSid:sid(81),From:`client:${identity()}`,IntentToken:unanswered.intentToken});
      await receiveVoiceDialAction(unanswered.callId,{AccountSid:account,CallSid:sid(81),DialCallStatus:"no-answer",DialCallDuration:"0"});expect((await getVoiceCall(owner,unanswered.callId)).recording?.status).toBe("absent");
    });
    it("binds recording identity and rechecks live access, expiry, workspace and media deletion grants",async()=>{
      const r=await recordedCall();await grant("voice-reader");
      expect(await getCallRecordingDownload(reader,r.id)).toEqual({recordingSid:rec(77),callSid:sid(77)});
      await expect(getCallRecordingDownload(actor("voice-other",otherWs),r.id)).rejects.toThrow();
      await expect(deleteCallRecording(reader,r.id)).rejects.toThrow();
      await expect(receiveCallRecording(r.callId,{...r.params,CallSid:sid(99)})).rejects.toThrow();
      await expect(receiveCallRecording(r.callId,{...r.params,RecordingSid:rec(88)})).rejects.toThrow();
      await pool.query("DELETE FROM voice_line_grants WHERE user_id='voice-reader'");await expect(getCallRecordingDownload(reader,r.id)).rejects.toThrow();
      await pool.query("UPDATE voice_call_recordings SET expires_at=now()-interval '1 second',transcript='Private expired text',summary='{}' WHERE id=$1",[r.id]);
      const expired=(await getVoiceCall(owner,r.callId)).recording!;expect(expired.status).toBe("expired");expect(expired.transcript).toBeNull();expect(expired.summary).toBeNull();await expect(getCallRecordingDownload(owner,r.id)).rejects.toThrow();
    });
    it("checkpoints transcripts, deduplicates callbacks/jobs, and completes a later summary stage",async()=>{
      vi.stubEnv("CALL_ANALYSIS_ENABLED","true");vi.stubEnv("OPENAI_API_KEY","synthetic-test-key");const r=await recordedCall();
      provider.media.mockImplementation(async()=>new Response("synthetic audio"));provider.transcribe.mockResolvedValue({text:"Please send a website proposal.",model:"gpt-transcribe"});provider.summarize.mockResolvedValue({summary:{summary:"Website inquiry",highlights:[],followUps:[{text:"Draft a proposal",quote:"Please send a website proposal."}]},model:"gpt-6-luna"});
      const outcomes=await Promise.all([runCallRecordingWorker(),runCallRecordingWorker()]);expect(outcomes.reduce((sum,x)=>sum+x.failed,0)).toBe(0);
      expect(provider.transcribe).toHaveBeenCalledTimes(1);
      await receiveCallRecording(r.callId,r.params);
      await runCallRecordingWorker();
      const call=(await getVoiceCall(owner,r.callId)).recording!;expect(call.transcript).toContain("website proposal");expect(call.summary?.followUps).toHaveLength(1);expect(call.analysisStatus).toBe("ready");expect(provider.transcribe).toHaveBeenCalledTimes(1);expect(provider.summarize).toHaveBeenCalledTimes(1);
      await expect(requestCallAnalysis(owner,{recordingId:r.id})).rejects.toThrow();
    });
    it("preserves a successful transcript on summary failure and bounds explicit paid retries",async()=>{
      vi.stubEnv("CALL_ANALYSIS_ENABLED","true");vi.stubEnv("OPENAI_API_KEY","synthetic-test-key");const r=await recordedCall();
      provider.media.mockImplementation(async()=>new Response("synthetic audio"));provider.transcribe.mockResolvedValue({text:"Customer text.",model:"gpt-transcribe"});provider.summarize.mockRejectedValue(new Error("synthetic failure"));
      await runCallRecordingWorker();for(let i=0;i<3;i++){await runCallRecordingWorker();if(i<2)await requestCallAnalysis(owner,{recordingId:r.id});}
      expect(provider.transcribe).toHaveBeenCalledTimes(1);expect(provider.summarize).toHaveBeenCalledTimes(3);expect((await getVoiceCall(owner,r.callId)).recording?.transcript).toBe("Customer text.");await expect(requestCallAnalysis(owner,{recordingId:r.id})).rejects.toThrow();
    });
    it("cannot resurrect deleted analysis after an in-flight provider request or callback",async()=>{
      vi.stubEnv("CALL_ANALYSIS_ENABLED","true");vi.stubEnv("OPENAI_API_KEY","synthetic-test-key");const r=await recordedCall();
      provider.media.mockImplementation(async()=>new Response("synthetic audio"));provider.transcribe.mockImplementation(async()=>{await deleteCallRecording(owner,r.id);return{text:"Do not resurrect this.",model:"gpt-transcribe"};});
      await runCallRecordingWorker();await receiveCallRecording(r.callId,r.params);
      const row=(await getVoiceCall(owner,r.callId)).recording!;expect(row.status).toBe("deleted");expect(row.transcript).toBeNull();expect(row.summary).toBeNull();expect(row.canPlay).toBe(false);
    });
    it("erases expired analysis and retries failed provider deletion without exposing audio",async()=>{
      const r=await recordedCall();await pool.query("UPDATE voice_call_recordings SET expires_at=now()-interval '1 day',transcript='private',summary='{}' WHERE id=$1",[r.id]);
      provider.deleteRecording.mockRejectedValueOnce(new Error("synthetic failure"));expect((await runCallRecordingWorker()).failed).toBe(1);expect((await getVoiceCall(owner,r.callId)).recording?.transcript).toBeNull();
      await pool.query("UPDATE voice_call_recordings SET delete_after=now() WHERE id=$1",[r.id]);await runCallRecordingWorker();expect((await getVoiceCall(owner,r.callId)).recording?.status).toBe("deleted");expect(provider.deleteRecording).toHaveBeenCalledTimes(2);
    });
    it("recovers a completed recording when its callback was missed",async()=>{
      const intent=await reserve();await receiveVoiceOutbound({AccountSid:account,CallSid:sid(80),From:`client:${identity()}`,IntentToken:intent.intentToken});
      await pool.query("UPDATE voice_calls SET ended_at=now() WHERE id=$1",[intent.callId]);await pool.query("UPDATE voice_call_recordings SET poll_after=now() WHERE call_id=$1",[intent.callId]);
      const result={recordingSid:rec(80),callSid:sid(80),status:"completed",duration:30,channels:2};provider.findRecording.mockResolvedValue(result);provider.recording.mockResolvedValue(result);
      await runCallRecordingWorker();expect((await getVoiceCall(owner,intent.callId)).recording?.canPlay).toBe(true);
    });
    it("verifies capability, grants only connector, does not inherit SMS, and rejects forged roles", async () => {
      expect((await getVoiceWorkspace(member)).lines).toHaveLength(0);
      expect((await getVoiceWorkspace(owner)).lines[0].canCall).toBe(true);
      await expect(connectVoiceLine(member, { phone })).rejects.toThrow();
      provider.lookup.mockResolvedValueOnce({
        accountSid: account,
        phone,
        providerSid: "PN" + "4".repeat(32),
        voiceEnabled: false,
      });
      await expect(connectVoiceLine(owner, { phone })).rejects.toThrow(
        "voice-capable",
      );
      await expect(reserve(remote, viewer)).rejects.toThrow();
      await expect(
        createVoiceIntent(actor("voice-other", otherWs), {
          lineId,
          to: remote,
          requestId: randomUUID(),
        }),
      ).rejects.toThrow();
      await pool.query(
        "UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",
        [owner.user.id],
      );
      await expect(issueVoiceToken(owner, lineId)).rejects.toThrow();
    });
    it("reserves immutable requests, binds browser identity, expires and redeems exactly once", async () => {
      const request = randomUUID(),
        a = await reserve(remote, owner, request),
        b = await reserve(remote, owner, request);
      expect(a.intentToken).toBe(b.intentToken);
      await expect(reserve("+14045550102", owner, request)).rejects.toThrow(
        "different",
      );
      await expect(
        receiveVoiceOutbound({
          AccountSid: account,
          CallSid: sid(1),
          From: "client:" + identity("voice-member"),
          IntentToken: a.intentToken,
        }),
      ).rejects.toThrow("identity");
      const result = await receiveVoiceOutbound({
        AccountSid: account,
        CallSid: sid(1),
        From: "client:" + identity(),
        IntentToken: a.intentToken,
        To: "+19005550123",
      });
      expect(result.to).toBe(remote);
      await expect(
        receiveVoiceOutbound({
          AccountSid: account,
          CallSid: sid(1),
          From: "client:" + identity(),
          IntentToken: a.intentToken,
        }),
      ).rejects.toThrow("already");
      const expired = await reserve("+14045550103");
      await pool.query(
        "UPDATE voice_intents SET expires_at=now()-interval '1 second' WHERE id=$1",
        [expired.intentId],
      );
      await expect(
        receiveVoiceOutbound({
          AccountSid: account,
          CallSid: sid(2),
          From: "client:" + identity(),
          IntentToken: expired.intentToken,
        }),
      ).rejects.toThrow();
    });
    it("fresh-checks restrictions and revoked calling at redemption, rejects extensions and rate caps", async () => {
      await expect(reserve(remote + " x12")).rejects.toThrow("extension");
      const a = await reserve();
      await pool.query(
        "INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status) VALUES($1,'call',$2,'blocked')",
        [ws, remote],
      );
      await expect(
        receiveVoiceOutbound({
          AccountSid: account,
          CallSid: sid(1),
          From: "client:" + identity(),
          IntentToken: a.intentToken,
        }),
      ).rejects.toThrow("blocked");
      await pool.query("DELETE FROM crm_channel_preferences");
      await saveVoiceGrant(owner, {
        lineId,
        userId: owner.user.id,
        canRead: true,
        canCall: false,
        canReceive: true,
        canManageVoicemail: true,
      });
      await expect(
        receiveVoiceOutbound({
          AccountSid: account,
          CallSid: sid(1),
          From: "client:" + identity(),
          IntentToken: a.intentToken,
        }),
      ).rejects.toThrow("approved");
      await grant(owner.user.id, true, true, true);
      for (let n = 1; n < 20; n++) await reserve("+1404555" + String(1000 + n));
      await expect(reserve("+14045559999")).rejects.toThrow("hourly");
    });
    it("forwards only to the approved mobile without browser presence and retains call recording policy", async () => {
      vi.stubEnv("CALL_ANALYSIS_ENABLED","true");vi.stubEnv("OPENAI_API_KEY","synthetic-test-key");
      await allHours();
      await saveRecordingPreferences(owner,{lineId,recordCalls:true,recordingAnnouncement:false,autoTranscribe:true});
      await saveVoiceForwarding(owner,{lineId,mode:"forward",userId:owner.user.id,phone:"4045550199",always:true});
      const c=await incoming();
      expect(c.targets).toEqual([]);expect(c.forwardPhone).toBe("+14045550199");expect(c.voicemail).toBe(false);expect(c.recordCalls).toBe(true);
      expect((await incoming()).forwardPhone).toBe(c.forwardPhone);
      provider.fetch.mockResolvedValue({accountSid:account,parentCallSid:sid(10),from:phone,to:c.forwardPhone});
      const params={AccountSid:account,CallSid:sid(11),ParentCallSid:sid(10),From:phone,To:c.forwardPhone!};
      await receiveVoiceForwardAnswer(c.callId,params);
      await receiveVoiceStatus({...params,CallStatus:"in-progress"},{callId:c.callId,leg:"staff"});
      expect((await pool.query("SELECT answered_at FROM voice_calls WHERE id=$1",[c.callId])).rows[0].answered_at).toBeNull();
      expect((await receiveVoiceForwardAnswer(c.callId,{...params,Digits:"1"},true)).accepted).toBe(true);
      const answered=(await pool.query("SELECT * FROM voice_calls WHERE id=$1",[c.callId])).rows[0];
      expect(answered.staff_user_id).toBe(owner.user.id);expect(answered.answered_at).not.toBeNull();
      expect((await receiveVoiceDialAction(c.callId,{AccountSid:account,CallSid:sid(10),From:remote,To:phone,DialCallSid:sid(11),DialCallStatus:"completed",DialCallDuration:"30"})).voicemail).toBe(false);
      expect((await getVoiceCall(owner,c.callId)).duration).toBe(30);
      provider.recording.mockResolvedValue({recordingSid:rec(10),callSid:sid(10),status:"completed",duration:30,channels:2});
      await receiveCallRecording(c.callId,{AccountSid:account,CallSid:sid(10),RecordingSid:rec(10),RecordingStatus:"completed"});
      const recording=(await getVoiceCall(owner,c.callId)).recording!;
      expect(recording.status).toBe("ready");
      expect(await getCallRecordingDownload(owner,recording.id)).toEqual({recordingSid:rec(10),callSid:sid(10)});
      expect((await pool.query("SELECT analysis_status FROM voice_call_recordings WHERE id=$1",[recording.id])).rows[0].analysis_status).toBe("queued");
    });
    it("returns unanswered mobile calls to CRM voicemail even when a personal voicemail picks up", async () => {
      await saveVoiceForwarding(owner,{lineId,mode:"forward",userId:owner.user.id,phone:"4045550199",always:true});
      const c=await incoming();
      provider.fetch.mockResolvedValue({accountSid:account,parentCallSid:sid(10),from:phone,to:c.forwardPhone});
      expect((await receiveVoiceForwardAnswer(c.callId,{AccountSid:account,CallSid:sid(11),Digits:"2"},true)).accepted).toBe(false);
      const outcome=await receiveVoiceDialAction(c.callId,{AccountSid:account,CallSid:sid(10),DialCallSid:sid(11),DialCallStatus:"completed",DialCallDuration:"8"});
      expect(outcome.voicemail).toBe(true);
      const call=(await pool.query("SELECT answered_at,status FROM voice_calls WHERE id=$1",[c.callId])).rows[0];
      expect(call.answered_at).toBeNull();expect(call.status).toBe("no-answer");
    });
    it("checks forwarding grants, business hours, changed destinations, loops, and provider identity", async () => {
      await expect(saveVoiceForwarding(member,{lineId,mode:"forward",userId:member.user.id,phone:"4045550199"})).rejects.toThrow();
      await expect(saveVoiceForwarding(owner,{lineId,mode:"forward",userId:reader.user.id,phone:"4045550199"})).rejects.toThrow();
      await expect(saveVoiceForwarding(owner,{lineId,mode:"forward",userId:owner.user.id,phone})).rejects.toThrow();
      await saveVoiceForwarding(owner,{lineId,mode:"forward",userId:owner.user.id,phone:"4045550199",always:false});
      await pool.query("UPDATE voice_lines SET hours_days='{}' WHERE id=$1",[lineId]);
      expect((await incoming()).voicemail).toBe(true);
      await saveVoiceForwarding(owner,{lineId,mode:"forward",userId:owner.user.id,phone:"4045550199",always:true});
      const c=await incoming(20);
      expect(c.forwardPhone).toBe("+14045550199");
      expect((await incoming(30,"+14045550199")).voicemail).toBe(true);
      provider.fetch.mockResolvedValue({accountSid:account,parentCallSid:sid(99),from:phone,to:c.forwardPhone});
      await expect(receiveVoiceForwardAnswer(c.callId,{AccountSid:account,CallSid:sid(21),Digits:"1"},true)).rejects.toThrow();
      provider.fetch.mockResolvedValue({accountSid:account,parentCallSid:sid(20),from:phone,to:c.forwardPhone});
      await saveVoiceForwarding(owner,{lineId,mode:"forward",userId:owner.user.id,phone:"4045550198",always:true});
      await expect(receiveVoiceForwardAnswer(c.callId,{AccountSid:account,CallSid:sid(21),Digits:"1"},true)).rejects.toThrow();
      await grant(owner.user.id,true,false);
      expect((await incoming(40)).voicemail).toBe(true);
    });
    it("rings only fresh approved presence, hours and pause fall back, and duplicate incoming is stable", async () => {
      await grant(member.user.id, false, true);
      await updateVoicePresence(member, { lineId, available: true });
      const a = await incoming(),
        b = await incoming();
      expect(a.callId).toBe(b.callId);
      expect(a.targets).toEqual([
        { identity: identity(member.user.id), userId: member.user.id },
      ]);
      expect((await incoming(11, "+14045550102")).targets).toHaveLength(1);
      await pool.query(
        "UPDATE voice_presence SET updated_at=now()-interval '2 minutes'",
      );
      expect((await incoming(12)).voicemail).toBe(true);
      await updateVoicePresence(member, { lineId, available: true });
      await saveVoiceRouting(owner, {
        lineId,
        status: "paused",
        timezone: "UTC",
        start: "00:00",
        end: "23:59",
        days: [0, 1, 2, 3, 4, 5, 6],
        ringSeconds: 20,
        greeting: "Please leave a recorded voicemail.",
      });
      expect((await incoming(13)).targets).toHaveLength(0);
      await expect(reserve()).rejects.toThrow("paused");
    });
    it("requires receive grant at accept and on signed staff answer after ring", async () => {
      await grant(member.user.id, false, true);
      await updateVoicePresence(member, { lineId, available: true });
      const call = await incoming();
      await expect(
        acceptVoiceCall(reader, { callId: call.callId }),
      ).rejects.toThrow();
      await acceptVoiceCall(member, { callId: call.callId });
      provider.fetch.mockResolvedValue({
        sid: sid(20),
        parentCallSid: sid(10),
        accountSid: account,
        from: remote,
        to: "client:" + identity(member.user.id),
        status: "in-progress",
        duration: 0,
      });
      await saveVoiceGrant(owner, {
        lineId,
        userId: member.user.id,
        canRead: true,
        canCall: false,
        canReceive: false,
        canManageVoicemail: false,
      });
      await expect(
        receiveVoiceStaffAnswer(call.callId, member.user.id, {
          AccountSid: account,
          CallSid: sid(20),
          ParentCallSid: sid(10),
          To: "client:" + identity(member.user.id),
          From: remote,
        }),
      ).rejects.toThrow("approved");
    });
    it("binds child SID/participants and preserves completed against late failures", async () => {
      const a = await reserve();
      await receiveVoiceOutbound({
        AccountSid: account,
        CallSid: sid(1),
        From: "client:" + identity(),
        IntentToken: a.intentToken,
      });
      provider.fetch.mockResolvedValue({
        sid: sid(2),
        parentCallSid: sid(99),
        accountSid: account,
        from: phone,
        to: remote,
        status: "in-progress",
        duration: 0,
      });
      await expect(
        receiveVoiceStatus(
          { AccountSid: account, CallSid: sid(2), CallStatus: "in-progress" },
          { callId: a.callId, leg: "customer" },
        ),
      ).rejects.toThrow("belong");
      provider.fetch.mockResolvedValue({
        sid: sid(2),
        parentCallSid: sid(1),
        accountSid: account,
        from: phone,
        to: remote,
        status: "in-progress",
        duration: 0,
      });
      await receiveVoiceStatus(
        { AccountSid: account, CallSid: sid(2), CallStatus: "in-progress" },
        { callId: a.callId, leg: "customer" },
      );
      await receiveVoiceStatus(
        {
          AccountSid: account,
          CallSid: sid(2),
          CallStatus: "completed",
          CallDuration: "45",
        },
        { callId: a.callId, leg: "customer" },
      );
      await receiveVoiceStatus(
        { AccountSid: account, CallSid: sid(2), CallStatus: "ringing" },
        { callId: a.callId, leg: "customer" },
      );
      await receiveVoiceStatus(
        { AccountSid: account, CallSid: sid(2), CallStatus: "failed" },
        { callId: a.callId, leg: "customer" },
      );
      expect((await getVoiceCall(owner, a.callId)).status).toBe("completed");
      expect((await getVoiceCall(owner, a.callId)).duration).toBe(45);
    });
    it("keeps missed/voicemail in Needs reply while answered real calls move to Waiting", async () => {
      await updateVoicePresence(owner, { lineId, available: true });
      const a = await incoming();
      await receiveVoiceDialAction(a.callId, {
        AccountSid: account,
        CallSid: sid(10),
        DialCallStatus: "no-answer",
        DialCallDuration: "0",
      });
      await receiveVoiceStatus(
        {
          AccountSid: account,
          CallSid: sid(10),
          CallStatus: "completed",
          CallDuration: "30",
        },
        { callId: a.callId },
      );
      let view = await listConversationWorkspace(owner);
      expect(view.items[0].status).toBe("needs_reply");
      await incoming(11);
      provider.fetch.mockResolvedValue({
        sid: sid(30),
        parentCallSid: sid(11),
        accountSid: account,
        from: remote,
        to: "client:" + identity(),
        status: "in-progress",
        duration: 0,
      });
      const b = (
        await pool.query("SELECT id FROM voice_calls WHERE parent_sid=$1", [
          sid(11),
        ])
      ).rows[0].id;
      await receiveVoiceStaffAnswer(b, owner.user.id, {
        AccountSid: account,
        CallSid: sid(30),
        ParentCallSid: sid(11),
        To: "client:" + identity(),
      });
      await receiveVoiceStatus(
        { AccountSid: account, CallSid: sid(30), CallStatus: "in-progress" },
        { callId: b, leg: "staff" },
      );
      view = await listConversationWorkspace(owner);
      expect(view.items[0].status).toBe("waiting");
    });
    it("does not mark Record action audio ready; callback scoped SID, grants and expiry protect playback", async () => {
      const a = await incoming();
      await receiveVoicemailAction(a.callId, {
        AccountSid: account,
        CallSid: sid(10),
        RecordingDuration: "15",
      });
      expect(
        (await pool.query("SELECT * FROM voice_voicemails")).rows,
      ).toHaveLength(0);
      await receiveVoicemailStatus(a.callId, {
        AccountSid: account,
        CallSid: sid(10),
        RecordingSid: rec(1),
        RecordingStatus: "completed",
        RecordingDuration: "15",
      });
      const v = (await getVoiceCall(owner, a.callId)).voicemail!;
      expect(await getVoicemailDownload(owner, v.id)).toEqual({
        recordingSid: rec(1),
        callSid: sid(10),
      });
      await expect(getVoicemailDownload(member, v.id)).rejects.toThrow();
      await grant(reader.user.id);
      expect((await getVoiceCall(reader, a.callId)).voicemail?.canDelete).toBe(
        false,
      );
      await expect(deleteVoicemail(reader, v.id)).rejects.toThrow();
      await pool.query(
        "UPDATE voice_voicemails SET expires_at=now()-interval '1 second'",
      );
      await expect(getVoicemailDownload(owner, v.id)).rejects.toThrow(
        "expired",
      );
    });
    it("leases bounded provider deletion, keeps tombstones and retries uncertain deletion later", async () => {
      for (let n = 1; n <= 2; n++) {
        const c = await incoming(n);
        await receiveVoicemailStatus(c.callId, {
          AccountSid: account,
          CallSid: sid(n),
          RecordingSid: rec(n),
          RecordingStatus: "completed",
          RecordingDuration: "10",
        });
      }
      await pool.query(
        "UPDATE voice_voicemails SET expires_at=now()-interval '1 day'",
      );
      provider.remove.mockRejectedValueOnce(new Error("uncertain"));
      expect(await runVoiceMaintenance()).toEqual({ checked: 1, failed: 1 });
      expect(await runVoiceMaintenance()).toEqual({ checked: 1, failed: 0 });
      expect(
        (
          await pool.query(
            "SELECT * FROM voice_voicemails WHERE status='deleted'",
          )
        ).rowCount,
      ).toBe(1);
      expect(
        (
          await pool.query(
            "SELECT * FROM voice_voicemails WHERE status='deleting'",
          )
        ).rowCount,
      ).toBe(1);
      await pool.query(
        "UPDATE voice_voicemails SET delete_after=now()-interval '1 second'",
      );
      expect(await runVoiceMaintenance()).toEqual({ checked: 1, failed: 0 });
      expect(
        (
          await pool.query(
            "SELECT * FROM voice_voicemails WHERE status='deleted'",
          )
        ).rowCount,
      ).toBe(2);
    });
    it("uses exact unambiguous contact identity, never business-wide matching or anonymous merging", async () => {
      const business = randomUUID(),
        contact = randomUUID();
      await pool.query(
        "INSERT INTO crm_businesses(id,workspace_id,name) VALUES($1,$2,$3)",
        [business, ws, "Fixture business"],
      );
      await pool.query(
        "INSERT INTO contacts(id,workspace_id,name,email,phone,business_id) VALUES($1,$2,$3,$4,$5,$6)",
        [contact, ws, "Exact person", "person@example.test", remote, business],
      );
      const a = await incoming();
      const view = await listConversationWorkspace(owner);
      expect(view.items[0].contactId).toBe(contact);
      const b = await incoming(11, "+14045550102");
      expect((await getVoiceCall(owner, a.callId)).conversationId).not.toBe(
        (await getVoiceCall(owner, b.callId)).conversationId,
      );
      const anon = await incoming(12, "anonymous"),
        anon2 = await incoming(13, "anonymous");
      expect((await getVoiceCall(owner, anon.callId)).conversationId).not.toBe(
        (await getVoiceCall(owner, anon2.callId)).conversationId,
      );
    });
    it("preserves source-scoped notes and history after deliberate merge and revocation", async () => {
      const a = await incoming(10),
        b = await incoming(11, "+14045550102"),
        ca = await getVoiceCall(owner, a.callId),
        cb = await getVoiceCall(owner, b.callId);
      await addConversationNote(owner, {
        conversationId: ca.conversationId,
        audienceSourceId: ca.sourceId,
        body: "Voice scoped note",
      });
      await mergeConversations(owner, {
        conversationId: ca.conversationId,
        targetConversationId: cb.conversationId,
        confirmConflicts: true,
      });
      await grant(reader.user.id);
      const merged = await listConversationWorkspace(reader, {
        conversation: cb.conversationId,
      });
      expect(merged.selected?.sources).toHaveLength(2);
      expect(
        merged.selected?.timeline.some((i) => i.text === "Voice scoped note"),
      ).toBe(true);
      await saveVoiceGrant(owner, {
        lineId,
        userId: reader.user.id,
        canRead: false,
        canCall: false,
        canReceive: false,
        canManageVoicemail: false,
      });
      expect(
        (
          await listConversationWorkspace(reader, {
            conversation: cb.conversationId,
          })
        ).selected,
      ).toBe(null);
    });
    it("paginates call history with fresh access before and after each page", async () => {
      let conversation = "";
      for (let n = 1; n <= 102; n++) {
        const a = await incoming(n);
        if (n === 1)
          conversation = (await getVoiceCall(owner, a.callId)).conversationId;
      }
      const v = await listConversationWorkspace(owner, { conversation }),
        source = v.selected!.sources[0];
      expect(source.voiceCalls).toHaveLength(100);
      expect(source.hasOlder).toBe(true);
      const older = await loadConversationSourceHistory(owner, {
        sourceId: source.id,
        before: source.before!,
      });
      expect(older.items).toHaveLength(2);
      expect(older.hasOlder).toBe(false);
      await expect(
        loadConversationSourceHistory(member, {
          sourceId: source.id,
          before: source.before!,
        }),
      ).rejects.toThrow();
    }, 30000);
    it("atomically claims one answering child, binds exact offered user, and rejects parent-leg screens", async () => {
      await grant(member.user.id, false, true);
      await updateVoicePresence(owner, { lineId, available: true });
      await updateVoicePresence(member, { lineId, available: true });
      const c = await incoming();
      provider.fetch.mockImplementation(async (id: string) => ({
        sid: id,
        parentCallSid: sid(10),
        accountSid: account,
        from: remote,
        to:
          "client:" + identity(id === sid(20) ? owner.user.id : member.user.id),
        status: "in-progress",
        duration: 0,
      }));
      await expect(
        receiveVoiceStaffAnswer(c.callId, owner.user.id, {
          AccountSid: account,
          CallSid: sid(10),
        }),
      ).rejects.toThrow("child");
      await expect(
        receiveVoiceStaffAnswer(c.callId, owner.user.id, {
          AccountSid: account,
          CallSid: sid(21),
        }),
      ).rejects.toThrow("identity");
      const results = await Promise.allSettled([
        receiveVoiceStaffAnswer(c.callId, owner.user.id, {
          AccountSid: account,
          CallSid: sid(20),
        }),
        receiveVoiceStaffAnswer(c.callId, member.user.id, {
          AccountSid: account,
          CallSid: sid(21),
        }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const stored = (
        await pool.query(
          "SELECT staff_sid,staff_user_id FROM voice_calls WHERE id=$1",
          [c.callId],
        )
      ).rows[0];
      const winningUser =
        stored.staff_sid === sid(20) ? owner.user.id : member.user.id;
      expect(stored.staff_user_id).toBe(winningUser);
      await receiveVoiceStaffAnswer(c.callId, winningUser, {
        AccountSid: account,
        CallSid: stored.staff_sid,
      });
      expect((await getVoiceCall(owner, c.callId)).status).toBe("in-progress");
      expect((await incoming(11)).targets.map((t) => t.userId)).not.toContain(
        winningUser,
      );
      await updateVoicePresence(actor(winningUser), {
        lineId,
        available: false,
      });
      await expect(
        receiveVoiceStaffAnswer(c.callId, winningUser, {
          AccountSid: account,
          CallSid: stored.staff_sid,
        }),
      ).rejects.toThrow("available");
    });
    it("retains authoritative child answer evidence when aggregate completion arrived first", async () => {
      await updateVoicePresence(owner, { lineId, available: true });
      const c = await incoming();
      provider.fetch.mockResolvedValue({
        sid: sid(20),
        parentCallSid: sid(10),
        accountSid: account,
        from: remote,
        to: "client:" + identity(),
        status: "in-progress",
        duration: 0,
      });
      await receiveVoiceStaffAnswer(c.callId, owner.user.id, {
        AccountSid: account,
        CallSid: sid(20),
      });
      // Model an older parent completion that was received before answer evidence.
      await pool.query(
        "UPDATE voice_calls SET status='completed',status_rank=5,answered_at=NULL,duration=60,ended_at=now() WHERE id=$1",
        [c.callId],
      );
      await receiveVoiceStatus(
        {
          AccountSid: account,
          CallSid: sid(20),
          CallStatus: "completed",
          CallDuration: "42",
        },
        { callId: c.callId, leg: "staff" },
      );
      const result = await getVoiceCall(owner, c.callId);
      expect(result.answeredAt).not.toBeNull();
      expect(result.duration).toBe(42);
      expect((await listConversationWorkspace(owner)).items[0].status).toBe(
        "waiting",
      );
    });
    it("ends an outbound browser parent conservatively if child callbacks are missing", async () => {
      const a = await reserve();
      await receiveVoiceOutbound({
        AccountSid: account,
        CallSid: sid(1),
        From: "client:" + identity(),
        IntentToken: a.intentToken,
      });
      await receiveVoiceStatus(
        {
          AccountSid: account,
          CallSid: sid(1),
          CallStatus: "completed",
          CallDuration: "60",
        },
        { callId: a.callId, leg: "parent" },
      );
      let call = await getVoiceCall(owner, a.callId);
      expect(call.status).toBe("completed");
      expect(call.answeredAt).toBeNull();
      provider.fetch.mockResolvedValue({
        sid: sid(2),
        parentCallSid: sid(1),
        accountSid: account,
        from: phone,
        to: remote,
        status: "completed",
        duration: 45,
      });
      await receiveVoiceStatus(
        {
          AccountSid: account,
          CallSid: sid(2),
          CallStatus: "completed",
          CallDuration: "45",
        },
        { callId: a.callId, leg: "customer" },
      );
      call = await getVoiceCall(owner, a.callId);
      expect(call.answeredAt).not.toBeNull();
      expect(call.duration).toBe(45);
    });
    it("rejects callback identity changes and cross-call voicemail SID replay", async () => {
      const a = await reserve();
      await receiveVoiceOutbound({
        AccountSid: account,
        CallSid: sid(1),
        From: "client:" + identity(),
        IntentToken: a.intentToken,
      });
      provider.fetch.mockResolvedValue({
        sid: sid(2),
        parentCallSid: sid(1),
        accountSid: account,
        from: phone,
        to: remote,
        status: "in-progress",
        duration: 0,
      });
      await receiveVoiceStatus(
        { AccountSid: account, CallSid: sid(2), CallStatus: "in-progress" },
        { callId: a.callId, leg: "customer" },
      );
      await expect(
        receiveVoiceStatus(
          {
            AccountSid: account,
            CallSid: sid(2),
            From: phone,
            To: "+14045550199",
            CallStatus: "completed",
          },
          { callId: a.callId, leg: "customer" },
        ),
      ).rejects.toThrow("participants");
      const b = await incoming(10),
        c = await incoming(11, "+14045550102");
      await receiveVoicemailStatus(b.callId, {
        AccountSid: account,
        CallSid: sid(10),
        RecordingSid: rec(1),
        RecordingStatus: "completed",
        RecordingDuration: "10",
      });
      await expect(
        receiveVoicemailStatus(c.callId, {
          AccountSid: account,
          CallSid: sid(11),
          RecordingSid: rec(1),
          RecordingStatus: "completed",
          RecordingDuration: "10",
        }),
      ).rejects.toThrow("another call");
      await expect(
        receiveVoiceStatus(
          {
            AccountSid: "AC" + "9".repeat(32),
            CallSid: sid(10),
            CallStatus: "completed",
          },
          { callId: b.callId },
        ),
      ).rejects.toThrow("account");
    });
    it("allows only the active original participant to stop a call after line grant revocation", async () => {
      const a = await reserve();
      await receiveVoiceOutbound({
        AccountSid: account,
        CallSid: sid(1),
        From: "client:" + identity(),
        IntentToken: a.intentToken,
      });
      await saveVoiceGrant(owner, {
        lineId,
        userId: owner.user.id,
        canRead: false,
        canCall: false,
        canReceive: false,
        canManageVoicemail: false,
      });
      provider.end.mockResolvedValue({
        sid: sid(1),
        accountSid: account,
        status: "canceled",
        duration: null,
      });
      await expect(endCall(member, { callId: a.callId })).rejects.toThrow(
        "participating",
      );
      await endCall(owner, { callId: a.callId });
      expect(provider.end).toHaveBeenCalledWith(sid(1));
      await expect(reserve()).rejects.toThrow();
    });
    it("leases concurrent cleanup and bounded retries stop until an explicit operator deletion", async () => {
      const c = await incoming();
      await receiveVoicemailStatus(c.callId, {
        AccountSid: account,
        CallSid: sid(10),
        RecordingSid: rec(1),
        RecordingStatus: "completed",
        RecordingDuration: "10",
      });
      const v = (await getVoiceCall(owner, c.callId)).voicemail!;
      await pool.query(
        "UPDATE voice_voicemails SET expires_at=now()-interval '1 day',deletion_attempts=9",
      );
      let release!: (value: { deleted: true }) => void;
      provider.remove.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
      const first = runVoiceMaintenance();
      for (let n = 0; n < 100 && !release; n++)
        await new Promise((resolve) => setTimeout(resolve, 2));
      expect(await runVoiceMaintenance()).toEqual({ checked: 0, failed: 0 });
      await expect(deleteVoicemail(owner, v.id)).rejects.toThrow("pending");
      release({ deleted: true });
      await first;
      await pool.query(
        "UPDATE voice_voicemails SET status='ready',deleted_at=NULL,lease_until=NULL,deletion_attempts=9,delete_after=now()",
      );
      provider.remove.mockRejectedValueOnce(Error("provider unavailable"));
      expect(await runVoiceMaintenance()).toEqual({ checked: 1, failed: 1 });
      await pool.query(
        "UPDATE voice_voicemails SET delete_after=now()-interval '1 second'",
      );
      expect(await runVoiceMaintenance()).toEqual({ checked: 0, failed: 0 });
      provider.remove.mockResolvedValue({ deleted: true });
      await deleteVoicemail(owner, v.id);
      expect(
        (
          await pool.query("SELECT status FROM voice_voicemails WHERE id=$1", [
            v.id,
          ])
        ).rows[0].status,
      ).toBe("deleted");
    });
  },
);
