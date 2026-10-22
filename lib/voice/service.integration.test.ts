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
  connectVoiceLine,
  saveVoiceGrant,
  saveVoiceRouting,
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
  lookup: vi.fn(),
  fetch: vi.fn(),
  remove: vi.fn(),
  token: vi.fn(),
  end: vi.fn(),
}));
vi.mock("@/lib/voice-provider/provider", () => ({
  lookupOwnedVoiceNumber: provider.lookup,
  fetchVoiceCall: provider.fetch,
  deleteVoicemailMedia: provider.remove,
  endVoiceCall: provider.end,
}));
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
      provider.fetch.mockReset();
      provider.token.mockReturnValue({
        token: "synthetic-token",
        identity: identity(),
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      });
      lineId = await connectVoiceLine(owner, { phone });
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
