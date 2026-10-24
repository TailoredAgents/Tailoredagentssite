import { getConversationRecipient, recipientMatchesAddress, recipientMatchesConversation } from "@/lib/conversations/recipients";
import "server-only";
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { resolveDashboardConfiguration } from "@/lib/dashboard/config";
import { getVoiceConfiguration } from "@/lib/voice-provider/config";
import {
  createVoiceAccessToken,
  voiceIdentity,
} from "@/lib/voice-provider/token";
import {
  lookupOwnedVoiceNumber,
  fetchVoiceCall,
  endVoiceCall,
  deleteVoicemailMedia,
} from "@/lib/voice-provider/provider";
import { authorizedSources, scopes } from "@/lib/conversations/access";
import {
  authorizeVoice,
  lineAccess,
  VoiceAccessError,
  VoiceInputError,
  type LineRow,
} from "./data";
import {
  connectSchema,
  grantSchema,
  routingSchema,
  intentSchema,
  presenceSchema,
  callSchema,
  sidSchema,
  accountSchema,
  statusSchema,
  recordingSchema,
} from "./validation";
import type { VoiceIntent } from "./types";
import { prepareCallRecording } from "./recordings";
export { VoiceInputError, VoiceAccessError } from "./data";
async function tx<T>(
  workspaceId: string,
  context: DashboardContext | null,
  fn: (db: PoolClient) => Promise<T>,
  manage = false,
) {
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `unified-work:${workspaceId}`,
    ]);
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `agency-voice:${workspaceId}`,
    ]);
    if (context) {
      const role = (
        await db.query<{ role: string }>(
          "SELECT m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active' FOR SHARE OF m,w",
          [workspaceId, context.user.id],
        )
      ).rows[0]?.role;
      if (
        !role ||
        role === "viewer" ||
        (manage && !["owner", "admin"].includes(role))
      )
        throw new VoiceAccessError(
          "Your workspace access no longer allows this action.",
        );
    }
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
async function audit(
  db: PoolClient,
  context: DashboardContext,
  action: string,
  id: string,
  metadata: Record<string, unknown> = {},
) {
  await insertAuditLog(db, {
    workspaceId: context.workspace.id,
    actorUserId: context.user.id,
    action,
    targetType: "voice_call",
    targetId: id,
    metadata,
  });
}
export async function connectVoiceLine(
  context: DashboardContext,
  raw: unknown,
) {
  const input = connectSchema.parse(raw);
  await authorizeVoice(context, true, true);
  const config = getVoiceConfiguration();
  if (!config.restReady || input.phone !== config.phoneNumber)
    throw new VoiceInputError(
      "Choose the configured business number and complete its provider connection.",
    );
  const verified = await lookupOwnedVoiceNumber(input.phone);
  if (
    !verified.voiceEnabled ||
    verified.accountSid !== config.accountSid ||
    verified.phone !== input.phone
  )
    throw new VoiceInputError(
      "This account has not verified a voice-capable business number.",
    );
  return tx(
    context.workspace.id,
    context,
    async (db) => {
      const old = (
        await db.query<{ id: string; workspace_id: string }>(
          "SELECT id,workspace_id FROM voice_lines WHERE account_sid=$1 AND phone=$2 FOR UPDATE",
          [config.accountSid, input.phone],
        )
      ).rows[0];
      if (old && old.workspace_id !== context.workspace.id)
        throw new VoiceInputError(
          "This line is already connected to another workspace.",
        );
      const id = old?.id ?? randomUUID();
      await db.query(
        "INSERT INTO voice_lines(id,workspace_id,account_sid,phone,provider_sid) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET provider_sid=EXCLUDED.provider_sid",
        [
          id,
          context.workspace.id,
          config.accountSid,
          input.phone,
          verified.providerSid,
        ],
      );
      await db.query(
        "INSERT INTO voice_line_grants(workspace_id,line_id,user_id,can_read,can_call,can_receive,can_manage_voicemail) VALUES($1,$2,$3,true,true,true,true) ON CONFLICT(workspace_id,line_id,user_id) DO NOTHING",
        [context.workspace.id, id, context.user.id],
      );
      await audit(db, context, "voice.line.connected", id);
      return id;
    },
    true,
  );
}
export async function saveVoiceGrant(context: DashboardContext, raw: unknown) {
  const input = grantSchema.parse(raw);
  return tx(
    context.workspace.id,
    context,
    async (db) => {
      await lineAccess(db, context, input.lineId, "manage");
      const member = (
        await db.query(
          "SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2 AND status='active' AND role<>'viewer'",
          [context.workspace.id, input.userId],
        )
      ).rowCount;
      if (!member)
        throw new VoiceInputError(
          "Choose an active teammate who can work in this workspace.",
        );
      await db.query(
        "INSERT INTO voice_line_grants(workspace_id,line_id,user_id,can_read,can_call,can_receive,can_manage_voicemail) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workspace_id,line_id,user_id) DO UPDATE SET can_read=EXCLUDED.can_read,can_call=EXCLUDED.can_call,can_receive=EXCLUDED.can_receive,can_manage_voicemail=EXCLUDED.can_manage_voicemail",
        [
          context.workspace.id,
          input.lineId,
          input.userId,
          input.canRead,
          input.canCall,
          input.canReceive,
          input.canManageVoicemail,
        ],
      );
      if (!input.canReceive)
        await db.query(
          "UPDATE voice_presence SET available=false WHERE workspace_id=$1 AND line_id=$2 AND user_id=$3",
          [context.workspace.id, input.lineId, input.userId],
        );
      await audit(db, context, "voice.grant.updated", input.lineId, {
        userId: input.userId,
        canRead: input.canRead,
        canCall: input.canCall,
        canReceive: input.canReceive,
        canManageVoicemail: input.canManageVoicemail,
      });
    },
    true,
  );
}
export async function saveVoiceRouting(
  context: DashboardContext,
  raw: unknown,
) {
  const i = routingSchema.parse(raw);
  return tx(
    context.workspace.id,
    context,
    async (db) => {
      await lineAccess(db, context, i.lineId, "manage");
      await db.query(
        "UPDATE voice_lines SET status=$3,timezone=$4,hours_start=$5,hours_end=$6,hours_days=$7,ring_seconds=$8,greeting=$9 WHERE workspace_id=$1 AND id=$2",
        [
          context.workspace.id,
          i.lineId,
          i.status,
          i.timezone,
          i.start,
          i.end,
          [...new Set(i.days)],
          i.ringSeconds,
          i.greeting,
        ],
      );
      if (i.status === "paused")
        await db.query(
          "UPDATE voice_presence SET available=false WHERE workspace_id=$1 AND line_id=$2",
          [context.workspace.id, i.lineId],
        );
      await audit(db, context, "voice.routing.updated", i.lineId);
    },
    true,
  );
}
export async function issueVoiceToken(
  context: DashboardContext,
  lineId: string,
) {
  const access = await lineAccess(getDatabasePool(), context, lineId);
  const line = access.row;
  if (
    !getVoiceConfiguration().enabled ||
    line.status !== "active" ||
    access.role === "viewer" ||
    (!line.can_call && !line.can_receive)
  )
    throw new VoiceAccessError(
      "Your current grant does not allow connecting the browser phone.",
    );
  return createVoiceAccessToken(
    voiceIdentity(context.workspace.id, context.user.id),
    { canReceive: line.can_receive },
  );
}
export async function updateVoicePresence(
  context: DashboardContext,
  raw: unknown,
) {
  const i = presenceSchema.parse(raw);
  await tx(context.workspace.id, context, async (db) => {
    await lineAccess(db, context, i.lineId, i.available ? "receive" : "read");
    await db.query(
      "INSERT INTO voice_presence(workspace_id,line_id,user_id,available) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,line_id,user_id) DO UPDATE SET available=EXCLUDED.available,updated_at=now()",
      [context.workspace.id, i.lineId, context.user.id, i.available],
    );
  });
}
async function ensureConversation(
  db: PoolClient,
  workspaceId: string,
  lineId: string,
  remote: string,
  explicit?: string,
) {
  let v = (
    await db.query<{ id: string }>(
      "SELECT id FROM voice_conversations WHERE workspace_id=$1 AND line_id=$2 AND remote_phone=$3",
      [workspaceId, lineId, remote],
    )
  ).rows[0];
  if (!v) {
    v = { id: randomUUID() };
    await db.query(
      "INSERT INTO voice_conversations(id,workspace_id,line_id,remote_phone) VALUES($1,$2,$3,$4)",
      [v.id, workspaceId, lineId, remote],
    );
  }
  let source = (
    await db.query<{ id: string; conversation_id: string }>(
      "SELECT id,conversation_id FROM crm_conversation_sources WHERE workspace_id=$1 AND voice_conversation_id=$2",
      [workspaceId, v.id],
    )
  ).rows[0];
  if (source) {
    if (explicit && source.conversation_id !== explicit)
      throw new VoiceInputError(
        "This phone already has a call history. Link its conversation explicitly before calling from another context.",
      );
    return {
      voiceId: v.id,
      sourceId: source.id,
      conversationId: source.conversation_id,
    };
  }
  let canonical = explicit;
  if (!canonical && remote.startsWith("+")) {
    const matches = (
      await db.query<{ id: string }>(
        `SELECT DISTINCT c.id FROM crm_conversations c LEFT JOIN contacts p ON p.id=c.contact_id AND p.workspace_id=c.workspace_id LEFT JOIN leads l ON l.id=c.lead_id AND l.workspace_id=c.workspace_id LEFT JOIN crm_conversation_sources s ON s.conversation_id=c.id AND s.workspace_id=c.workspace_id LEFT JOIN sms_conversations sc ON sc.id=s.sms_conversation_id AND sc.workspace_id=s.workspace_id WHERE c.workspace_id=$1 AND c.merged_into_id IS NULL AND (crm_normalized_phone(p.phone)=$2 OR crm_normalized_phone(l.phone)=$2 OR sc.remote_phone=$2) LIMIT 2`,
        [workspaceId, remote],
      )
    ).rows;
    if (matches.length === 1) canonical = matches[0].id;
  }
  if (!canonical) {
    canonical = randomUUID();
    const contacts = remote.startsWith("+")
      ? (
          await db.query<{ id: string; kind: string; business_id: string | null }>(
            `SELECT p.id,'contact' kind,p.business_id FROM contacts p LEFT JOIN crm_businesses b ON b.id=p.business_id AND b.workspace_id=p.workspace_id WHERE p.workspace_id=$1 AND crm_normalized_phone(p.phone)=$2 AND b.anonymized_at IS NULL UNION ALL SELECT l.id,'lead' kind,l.business_id FROM leads l LEFT JOIN crm_businesses b ON b.id=l.business_id AND b.workspace_id=l.workspace_id WHERE l.workspace_id=$1 AND crm_normalized_phone(l.phone)=$2 AND l.anonymized_at IS NULL AND b.anonymized_at IS NULL LIMIT 2`,
            [workspaceId, remote],
          )
        ).rows
      : [];
    await db.query(
      "INSERT INTO crm_conversations(id,workspace_id,contact_id,business_id,lead_id) VALUES($1,$2,$3,$4,$5)",
      [
        canonical,
        workspaceId,
        contacts.length === 1 && contacts[0].kind === "contact" ? contacts[0].id : null,
        contacts.length === 1 ? contacts[0].business_id : null,
        contacts.length === 1 && contacts[0].kind === "lead" ? contacts[0].id : null,
      ],
    );
  }
  const sourceId = randomUUID();
  await db.query(
    "INSERT INTO crm_conversation_sources(id,workspace_id,conversation_id,channel,voice_conversation_id,external_addresses) VALUES($1,$2,$3,'call',$4,$5)",
    [
      sourceId,
      workspaceId,
      canonical,
      v.id,
      remote.startsWith("+") ? [remote] : [],
    ],
  );
  return { voiceId: v.id, sourceId, conversationId: canonical };
}
async function blocked(db: PoolClient, ws: string, phone: string) {
  return !!(
    await db.query(
      "SELECT 1 FROM crm_channel_preferences WHERE workspace_id=$1 AND normalized_address=$2 AND channel='call' AND status='blocked'",
      [ws, phone],
    )
  ).rowCount;
}
function intentToken(
  id: string,
  workspace: string,
  actor: string,
  expires: Date,
) {
  const secret = resolveDashboardConfiguration().authSecret;
  if (secret.length < 32)
    throw new VoiceInputError(
      "The dashboard signing configuration is incomplete.",
    );
  return (
    id +
    "." +
    createHmac("sha256", secret)
      .update(JSON.stringify([id, workspace, actor, expires.toISOString()]))
      .digest("base64url")
  );
}
export async function createVoiceIntent(
  context: DashboardContext,
  raw: unknown,
): Promise<VoiceIntent> {
  const i = intentSchema.parse(raw);
  if (i.conversationId) {
    const allowed = await authorizedSources(
      context,
      await scopes(context),
      i.conversationId,
    );
    if (!allowed.length)
      throw new VoiceAccessError(
        "This conversation is not available to your account.",
      );
  }
  const hash = createHash("sha256").update(JSON.stringify(i)).digest("hex");
  return tx(context.workspace.id, context, async (db) => {
    const { row: line } = await lineAccess(db, context, i.lineId, "call");
    if (i.recipient) await db.query(`SELECT id FROM ${i.recipient.kind === "lead" ? "leads" : "contacts"} WHERE workspace_id=$1 AND id=$2 FOR SHARE`, [context.workspace.id,i.recipient.id]);
    const recipient = i.recipient ? await getConversationRecipient(context, i.recipient.kind, i.recipient.id) : null;
    if (i.recipient && (!recipient || !recipientMatchesAddress(recipient, i.to)))
      throw new VoiceInputError("The phone number must match the selected customer. Refresh their contact details first.");
    async function linkRecipient(conversationId: string) {
      if (!recipient) return;
      const row = (await db.query<{contact_id:string|null;lead_id:string|null;business_id:string|null}>("SELECT contact_id,lead_id,business_id FROM crm_conversations WHERE workspace_id=$1 AND id=$2 AND merged_into_id IS NULL FOR UPDATE", [context.workspace.id, conversationId])).rows[0];
      if (!row || !recipientMatchesConversation(recipient, row, [i.to]))
        throw new VoiceInputError("This phone history belongs to another CRM record. Review its customer link before calling.");
      await db.query(`UPDATE crm_conversations SET ${recipient.kind === "lead" ? "lead_id" : "contact_id"}=$3,business_id=COALESCE(business_id,$4),updated_at=now() WHERE workspace_id=$1 AND id=$2`, [context.workspace.id, conversationId, recipient.id, recipient.businessId]);
    }
    if (await blocked(db, context.workspace.id, i.to))
      throw new VoiceInputError(
        "Calling this phone is blocked in CRM channel preferences.",
      );
    const old = (
      await db.query<{
        id: string;
        payload_hash: string;
        expires_at: Date;
        redeemed_at: Date | null;
        call_id: string;
      }>(
        "SELECT * FROM voice_intents WHERE workspace_id=$1 AND actor_user_id=$2 AND request_id=$3",
        [context.workspace.id, context.user.id, i.requestId],
      )
    ).rows[0];
    if (old) {
      if (old.payload_hash !== hash)
        throw new VoiceInputError(
          "This call request was already used for different details.",
        );
      if (old.redeemed_at || old.expires_at.getTime() <= Date.now())
        throw new VoiceInputError(
          "This call request has already started or expired. Refresh its existing call before starting another.",
        );
      const c = await getCallDb(db, context.workspace.id, old.call_id);
      const source = (
        await db.query<{ conversation_id: string }>(
          "SELECT conversation_id FROM crm_conversation_sources WHERE workspace_id=$1 AND voice_conversation_id=$2",
          [context.workspace.id, c.voice_conversation_id],
        )
      ).rows[0];
      await linkRecipient(source.conversation_id);
      return {
        intentId: old.id,
        intentToken: intentToken(
          old.id,
          context.workspace.id,
          context.user.id,
          old.expires_at,
        ),
        callId: old.call_id,
        conversationId: source.conversation_id,
        expiresAt: old.expires_at.toISOString(),
        to: i.to,
        from: line.phone,
      };
    }
    const recent = (
      await db.query<{ actor: number; line: number }>(
        `SELECT count(*) FILTER(WHERE actor_user_id=$3)::int actor,count(*)::int line FROM voice_intents WHERE workspace_id=$1 AND line_id=$2 AND created_at>now()-interval '1 hour'`,
        [context.workspace.id, i.lineId, context.user.id],
      )
    ).rows[0];
    if (recent.actor >= 20 || recent.line >= 60)
      throw new VoiceInputError(
        "This voice line reached its hourly call limit. Try again later.",
      );
    if (i.conversationId) {
      const count = (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM crm_conversation_sources WHERE workspace_id=$1 AND conversation_id=$2 AND visible",
          [context.workspace.id, i.conversationId],
        )
      ).rows[0].n;
      const visible = await authorizedSources(
        context,
        await scopes(context),
        i.conversationId,
      );
      if (!count || count !== visible.length)
        throw new VoiceAccessError(
          "All linked histories must be approved before adding a call to this conversation.",
        );
    }
    const binding = await ensureConversation(
        db,
        context.workspace.id,
        i.lineId,
        i.to,
        i.conversationId,
      ),
      callId = randomUUID(),
      id = randomUUID(),
      expires = new Date(Date.now() + 120000);
    await linkRecipient(binding.conversationId);
    await db.query(
      "INSERT INTO voice_calls(id,workspace_id,line_id,voice_conversation_id,actor_user_id,direction,from_phone,to_phone) VALUES($1,$2,$3,$4,$5,'outbound',$6,$7)",
      [
        callId,
        context.workspace.id,
        i.lineId,
        binding.voiceId,
        context.user.id,
        line.phone,
        i.to,
      ],
    );
    await db.query(
      "INSERT INTO voice_intents(id,workspace_id,actor_user_id,request_id,payload_hash,line_id,call_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        id,
        context.workspace.id,
        context.user.id,
        i.requestId,
        hash,
        i.lineId,
        callId,
        expires,
      ],
    );
    await audit(db, context, "voice.intent.reserved", callId);
    await refreshSource(db, context.workspace.id, binding.voiceId);
    return {
      intentId: id,
      intentToken: intentToken(
        id,
        context.workspace.id,
        context.user.id,
        expires,
      ),
      callId,
      conversationId: binding.conversationId,
      expiresAt: expires.toISOString(),
      to: i.to,
      from: line.phone,
    };
  });
}
type CallRow = {
  id: string;
  workspace_id: string;
  line_id: string;
  voice_conversation_id: string;
  actor_user_id: string | null;
  direction: "inbound" | "outbound";
  from_phone: string;
  to_phone: string;
  parent_sid: string | null;
  customer_sid: string | null;
  staff_sid: string | null;
  staff_user_id: string | null;
  status: string;
  status_rank: number;
  duration: number | null;
  created_at: Date;
  answered_at: Date | null;
  ended_at: Date | null;
  recording_requested: boolean;
  recording_announcement: boolean;
};
async function getCallDb(
  db: Pick<PoolClient, "query">,
  ws: string,
  id: string,
) {
  const c = (
    await db.query<CallRow>(
      "SELECT * FROM voice_calls WHERE workspace_id=$1 AND id=$2",
      [ws, id],
    )
  ).rows[0];
  if (!c) throw new VoiceInputError("This call is unavailable.");
  return c;
}
function checkAccount(p: Record<string, string>) {
  const config = getVoiceConfiguration();
  if (
    !config.webhookReady ||
    accountSchema.parse(p.AccountSid) !== config.accountSid
  )
    throw new VoiceInputError(
      "The call account does not match this connection.",
    );
  return config;
}
async function webhookLine(phone: string) {
  const config = getVoiceConfiguration();
  if (phone !== config.phoneNumber)
    throw new VoiceInputError("This voice line is not configured.");
  const line = (
    await getDatabasePool().query<LineRow>(
      "SELECT l.* FROM voice_lines l JOIN workspaces w ON w.id=l.workspace_id WHERE l.account_sid=$1 AND l.phone=$2 AND w.status='active'",
      [config.accountSid, phone],
    )
  ).rows[0];
  if (!line)
    throw new VoiceInputError("This voice line has not been approved.");
  return line;
}
async function freshActor(
  db: PoolClient,
  c: CallRow,
  permission: "call" | "receive",
  userId = c.actor_user_id,
) {
  if (!userId)
    throw new VoiceAccessError(
      "No approved staff member is bound to this call.",
    );
  const context = {
    workspace: { id: c.workspace_id },
    user: { id: userId },
  } as DashboardContext;
  await lineAccess(db, context, c.line_id, permission);
  return context;
}
async function refreshSource(
  db: Pick<PoolClient, "query">,
  ws: string,
  voiceId: string,
) {
  await db.query(
    `UPDATE crm_conversation_sources s SET latest_message_id=x.token,last_activity_at=x.activity,last_inbound_at=(SELECT max(c.created_at) FROM voice_calls c WHERE c.workspace_id=s.workspace_id AND c.voice_conversation_id=s.voice_conversation_id AND c.direction='inbound'),last_outbound_at=(SELECT max(c.answered_at) FROM voice_calls c WHERE c.workspace_id=s.workspace_id AND c.voice_conversation_id=s.voice_conversation_id AND c.answered_at IS NOT NULL),visible=true FROM LATERAL(SELECT c.id::text||':'||c.status||':'||COALESCE((SELECT v.id::text||':'||v.status FROM voice_voicemails v WHERE v.call_id=c.id ORDER BY v.created_at DESC LIMIT 1),'') token,GREATEST(c.created_at,COALESCE(c.answered_at,c.created_at),COALESCE(c.ended_at,c.created_at)) activity FROM voice_calls c WHERE c.workspace_id=$1 AND c.voice_conversation_id=$2 ORDER BY c.created_at DESC,c.id DESC LIMIT 1)x WHERE s.workspace_id=$1 AND s.voice_conversation_id=$2`,
    [ws, voiceId],
  );
}
export async function receiveVoiceOutbound(p: Record<string, string>) {
  checkAccount(p);
  const [id, mac, ...extra] = (p.IntentToken ?? "").split(".");
  if (
    extra.length ||
    !mac ||
    !/^[-\w]{43}$/.test(mac) ||
    !/^[-\da-f]{36}$/i.test(id ?? "")
  )
    throw new VoiceInputError(
      "A valid unexpired browser call request is required.",
    );
  const intent = (
    await getDatabasePool().query<{
      workspace_id: string;
      actor_user_id: string;
      expires_at: Date;
      call_id: string;
    }>("SELECT * FROM voice_intents WHERE id=$1", [id])
  ).rows[0];
  if (!intent) throw new VoiceInputError("This call request is unavailable.");
  const expected = intentToken(
    id,
    intent.workspace_id,
    intent.actor_user_id,
    intent.expires_at,
  ).split(".")[1];
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected)))
    throw new VoiceInputError("This call request is invalid.");
  return tx(intent.workspace_id, null, async (db) => {
    const current = (
      await db.query<{ redeemed_at: Date | null; expires_at: Date }>(
        "SELECT * FROM voice_intents WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (current.redeemed_at || current.expires_at.getTime() <= Date.now())
      throw new VoiceInputError(
        "This call request has already started or expired.",
      );
    const c = await getCallDb(db, intent.workspace_id, intent.call_id);
    await freshActor(db, c, "call");
    const sid = sidSchema.parse(p.CallSid);
    if (
      p.From !== `client:${voiceIdentity(c.workspace_id, intent.actor_user_id)}`
    )
      throw new VoiceInputError(
        "The browser identity does not match this call request.",
      );
    if (await blocked(db, c.workspace_id, c.to_phone))
      throw new VoiceInputError(
        "Calling this phone is blocked in CRM channel preferences.",
      );
    await db.query("UPDATE voice_intents SET redeemed_at=now() WHERE id=$1", [
      id,
    ]);
    await db.query(
      "UPDATE voice_calls SET parent_sid=$3,status='ringing',status_rank=2 WHERE workspace_id=$1 AND id=$2",
      [c.workspace_id, c.id, sid],
    );
    await refreshSource(db, c.workspace_id, c.voice_conversation_id);
    const recording = await prepareCallRecording(db, c.workspace_id, c.id);
    return { intentId: id, callId: c.id, from: c.from_phone, to: c.to_phone, ...recording };
  });
}
function inHours(line: LineRow) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: line.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const val = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      val("weekday"),
    ),
    time = val("hour") + ":" + val("minute");
  return (
    line.hours_days.includes(day) &&
    time >= line.hours_start &&
    time < line.hours_end
  );
}
export async function receiveVoiceIncoming(p: Record<string, string>) {
  const config = checkAccount(p),
    sid = sidSchema.parse(p.CallSid),
    line = await webhookLine(p.To);
  const remote = /^\+[1-9]\d{7,14}$/.test(p.From ?? "")
    ? p.From
    : ["anonymous", "restricted", "unknown", "unavailable", "private"].includes(
          (p.From ?? "").toLowerCase(),
        )
      ? `anonymous:${sid}`
      : null;
  if (!remote)
    throw new VoiceInputError("This caller identity is unsupported.");
  return tx(line.workspace_id, null, async (db) => {
    let call = (
      await db.query<CallRow>("SELECT * FROM voice_calls WHERE parent_sid=$1", [
        sid,
      ])
    ).rows[0];
    const newCall = !call;
    if (
      call &&
      (call.line_id !== line.id ||
        call.from_phone !== p.From ||
        call.to_phone !== line.phone)
    )
      throw new VoiceInputError("The provider call identity has changed.");
    if (!call) {
      const binding = await ensureConversation(
        db,
        line.workspace_id,
        line.id,
        remote,
      );
      call = { id: randomUUID() } as CallRow;
      await db.query(
        "INSERT INTO voice_calls(id,workspace_id,line_id,voice_conversation_id,direction,from_phone,to_phone,parent_sid,status,status_rank) VALUES($1,$2,$3,$4,'inbound',$5,$6,$7,'ringing',2)",
        [
          call.id,
          line.workspace_id,
          line.id,
          binding.voiceId,
          p.From,
          line.phone,
          sid,
        ],
      );
      call = await getCallDb(db, line.workspace_id, call.id);
      await refreshSource(db, line.workspace_id, binding.voiceId);
    }
    const fresh = (
      await db.query<LineRow>(
        "SELECT * FROM voice_lines WHERE workspace_id=$1 AND id=$2",
        [line.workspace_id, line.id],
      )
    ).rows[0];
    let targets: { identity: string; userId: string }[] = [];
    if (
      config.enabled &&
      fresh.status === "active" &&
      inHours(fresh) &&
      call.status === "ringing"
    ) {
      const users = (
        await db.query<{ user_id: string }>(
          `SELECT g.user_id FROM voice_line_grants g JOIN workspace_memberships m ON m.workspace_id=g.workspace_id AND m.user_id=g.user_id JOIN voice_presence p ON p.workspace_id=g.workspace_id AND p.line_id=g.line_id AND p.user_id=g.user_id WHERE g.workspace_id=$1 AND g.line_id=$2 AND g.can_read AND g.can_receive AND m.status='active' AND m.role<>'viewer' AND p.available AND p.updated_at>now()-interval '60 seconds' AND NOT EXISTS(SELECT 1 FROM voice_calls busy WHERE busy.workspace_id=g.workspace_id AND busy.status IN ('ringing','in-progress') AND (busy.actor_user_id=g.user_id OR busy.staff_user_id=g.user_id)) ORDER BY g.user_id LIMIT 10`,
          [line.workspace_id, line.id],
        )
      ).rows;
      for (const u of users) {
        const identity = voiceIdentity(line.workspace_id, u.user_id);
        targets.push({ identity, userId: u.user_id });
        await db.query(
          "INSERT INTO voice_call_targets(workspace_id,call_id,user_id,identity) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [line.workspace_id, call.id, u.user_id, identity],
        );
      }
    }
    if (newCall && targets.length) {
      await prepareCallRecording(db,line.workspace_id,call.id);
      call=await getCallDb(db,line.workspace_id,call.id);
    }
    return {
      callId: call.id,
      targets,
      voicemail: targets.length === 0,
      greeting: fresh.greeting,
      timeout: fresh.ring_seconds,
      recordCalls: call.recording_requested,
      recordingAnnouncement: call.recording_announcement,
    };
  });
}
export async function callForCallback(
  p: Record<string, string>,
  context: { callId?: string; intentId?: string } = {},
) {
  checkAccount(p);
  let c: CallRow | undefined;
  if (context.callId)
    c = (
      await getDatabasePool().query<CallRow>(
        "SELECT * FROM voice_calls WHERE id=$1",
        [callSchema.parse({ callId: context.callId }).callId],
      )
    ).rows[0];
  else if (context.intentId)
    c = (
      await getDatabasePool().query<CallRow>(
        "SELECT c.* FROM voice_calls c JOIN voice_intents i ON i.call_id=c.id AND i.workspace_id=c.workspace_id WHERE i.id=$1",
        [context.intentId],
      )
    ).rows[0];
  else
    c = (
      await getDatabasePool().query<CallRow>(
        "SELECT * FROM voice_calls WHERE parent_sid=$1 OR customer_sid=$1 OR staff_sid=$1 OR parent_sid=$2",
        [sidSchema.parse(p.CallSid), p.ParentCallSid || null],
      )
    ).rows[0];
  if (!c)
    throw new VoiceInputError(
      "This callback is not bound to an approved call.",
    );
  await webhookLine(c.direction === "inbound" ? c.to_phone : c.from_phone);
  return c;
}
async function bindLeg(
  db: PoolClient,
  c: CallRow,
  p: Record<string, string>,
  leg?: string,
) {
  const sid = sidSchema.parse(p.CallSid);
  if (sid === c.parent_sid) return "parent";
  if (sid === c.customer_sid) {
    if (
      (p.From && p.From !== c.from_phone) ||
      (p.To && p.To !== c.to_phone) ||
      (p.ParentCallSid && p.ParentCallSid !== c.parent_sid)
    )
      throw new VoiceInputError("The customer call participants have changed.");
    return "customer";
  }
  if (sid === c.staff_sid) {
    if (
      (p.To &&
        p.To !== `client:${voiceIdentity(c.workspace_id, c.staff_user_id!)}`) ||
      (p.ParentCallSid && p.ParentCallSid !== c.parent_sid)
    )
      throw new VoiceInputError("The staff call identity has changed.");
    return "staff";
  }
  const actual = await fetchVoiceCall(sid);
  if (
    actual.accountSid !== getVoiceConfiguration().accountSid ||
    actual.parentCallSid !== c.parent_sid ||
    (p.ParentCallSid && p.ParentCallSid !== c.parent_sid)
  )
    throw new VoiceInputError(
      "This call leg does not belong to this conversation.",
    );
  if (
    c.direction === "outbound" &&
    actual.from === c.from_phone &&
    actual.to === c.to_phone &&
    (leg === undefined || leg === "customer")
  ) {
    if (c.customer_sid)
      throw new VoiceInputError("A different customer call is already bound.");
    await db.query(
      "UPDATE voice_calls SET customer_sid=$3 WHERE workspace_id=$1 AND id=$2",
      [c.workspace_id, c.id, sid],
    );
    return "customer";
  }
  if (
    c.direction === "inbound" &&
    actual.to.startsWith("client:") &&
    (leg === undefined || leg === "staff")
  ) {
    const target = (
      await db.query<{ user_id: string }>(
        "SELECT user_id FROM voice_call_targets WHERE workspace_id=$1 AND call_id=$2 AND identity=$3",
        [c.workspace_id, c.id, actual.to.slice(7)],
      )
    ).rows[0];
    if (!target)
      throw new VoiceInputError("This staff call was not an approved target.");
    return "staff";
  }
  throw new VoiceInputError(
    "The call participants do not match this conversation.",
  );
}
const ranks: Record<string, number> = {
  queued: 1,
  ringing: 2,
  "in-progress": 3,
  completed: 5,
  busy: 4,
  "no-answer": 4,
  canceled: 4,
  failed: 4,
};
async function applyStatus(
  db: PoolClient,
  c: CallRow,
  status: string,
  duration: number | null,
  leg: string,
) {
  if (leg === "staff" && status !== "in-progress" && status !== "completed")
    return;
  const rank = ranks[status];
  const answered =
    (leg === "customer" || leg === "staff") &&
    (status === "in-progress" || status === "completed");
  // Answer/duration evidence remains useful when aggregate parent completion
  // arrived first; terminal state must not discard a verified answered leg.
  if (c.status === "completed" && answered) {
    await db.query(
      "UPDATE voice_calls SET answered_at=COALESCE(answered_at,now()),duration=CASE WHEN $3::integer IS NOT NULL THEN $3 ELSE duration END WHERE workspace_id=$1 AND id=$2",
      [c.workspace_id, c.id, duration],
    );
    await refreshSource(db, c.workspace_id, c.voice_conversation_id);
    return;
  }
  if (
    rank < c.status_rank ||
    c.status === "completed" ||
    (c.ended_at && status !== "completed")
  )
    return;
  await db.query(
    `UPDATE voice_calls SET status=$3,status_rank=$4,duration=COALESCE($5,duration),answered_at=CASE WHEN $6 THEN COALESCE(answered_at,now()) ELSE answered_at END,ended_at=CASE WHEN $4>=4 THEN COALESCE(ended_at,now()) ELSE ended_at END WHERE workspace_id=$1 AND id=$2`,
    [c.workspace_id, c.id, status, rank, duration, answered],
  );
  await refreshSource(db, c.workspace_id, c.voice_conversation_id);
}
function durationOf(raw: string | undefined) {
  if (raw === undefined || raw === "") return null;
  if (!/^\d{1,6}$/.test(raw) || Number(raw) > 86400)
    throw new VoiceInputError("The call duration is invalid.");
  return Number(raw);
}
export async function receiveVoiceStatus(
  p: Record<string, string>,
  context: {
    callId?: string;
    intentId?: string;
    leg?: "parent" | "browser" | "customer" | "staff";
  } = {},
) {
  const c = await callForCallback(p, context);
  const status = statusSchema.parse(p.CallStatus);
  return tx(c.workspace_id, null, async (db) => {
    const live = await getCallDb(db, c.workspace_id, c.id),
      leg = await bindLeg(db, live, p, context.leg);
    if (
      leg === "parent" &&
      live.direction === "outbound" &&
      status === "in-progress"
    )
      return;
    if (leg === "staff" && live.staff_sid !== p.CallSid) return;
    await applyStatus(db, live, status, durationOf(p.CallDuration), leg);
  });
}
export async function receiveVoiceStaffAnswer(
  callId: string,
  userId: string,
  p: Record<string, string>,
) {
  const c = await callForCallback(p, { callId });
  return tx(c.workspace_id, null, async (db) => {
    const live = await getCallDb(db, c.workspace_id, c.id);
    if (live.direction !== "inbound" || live.ended_at)
      throw new VoiceAccessError("This incoming call is no longer ringing.");
    if (live.staff_sid) {
      if (live.staff_sid !== p.CallSid || live.staff_user_id !== userId)
        throw new VoiceAccessError(
          "Another teammate has already answered this call.",
        );
    }
    const target = (
      await db.query(
        "SELECT 1 FROM voice_call_targets WHERE workspace_id=$1 AND call_id=$2 AND user_id=$3",
        [c.workspace_id, c.id, userId],
      )
    ).rowCount;
    if (!target)
      throw new VoiceAccessError(
        "You were not an approved target of this incoming call.",
      );
    await freshActor(db, live, "receive", userId);
    const presence = (
      await db.query(
        "SELECT 1 FROM voice_presence WHERE workspace_id=$1 AND line_id=$2 AND user_id=$3 AND available AND updated_at>now()-interval '60 seconds'",
        [c.workspace_id, c.line_id, userId],
      )
    ).rowCount;
    if (!presence)
      throw new VoiceAccessError("This browser phone is no longer available.");
    if (live.staff_sid) {
      if (
        (p.To && p.To !== `client:${voiceIdentity(c.workspace_id, userId)}`) ||
        (p.ParentCallSid && p.ParentCallSid !== live.parent_sid)
      )
        throw new VoiceInputError("The answering staff identity has changed.");
      return { announce: live.recording_requested && live.recording_announcement };
    }
    const child = sidSchema.parse(p.CallSid);
    if (child === live.parent_sid)
      throw new VoiceInputError("An answering staff child leg is required.");
    const actual = await fetchVoiceCall(child);
    if (
      actual.accountSid !== getVoiceConfiguration().accountSid ||
      actual.parentCallSid !== live.parent_sid ||
      actual.to !== `client:${voiceIdentity(c.workspace_id, userId)}` ||
      (p.To && p.To !== actual.to) ||
      (p.ParentCallSid && p.ParentCallSid !== live.parent_sid)
    )
      throw new VoiceInputError(
        "The answering staff identity does not match this call target.",
      );
    await db.query(
      "UPDATE voice_calls SET staff_sid=$3,staff_user_id=$4 WHERE workspace_id=$1 AND id=$2",
      [c.workspace_id, c.id, p.CallSid, userId],
    );
    await applyStatus(db, live, "in-progress", null, "staff");
    return { announce: live.recording_requested && live.recording_announcement };
  });
}
export async function acceptVoiceCall(context: DashboardContext, raw: unknown) {
  const i = callSchema.parse(raw);
  return tx(context.workspace.id, context, async (db) => {
    const c = await getCallDb(db, context.workspace.id, i.callId);
    await lineAccess(db, context, c.line_id, "receive");
    if (c.direction !== "inbound" || c.status !== "ringing")
      throw new VoiceInputError("This call is no longer ringing.");
    const target = (
      await db.query(
        "SELECT 1 FROM voice_call_targets WHERE workspace_id=$1 AND call_id=$2 AND user_id=$3",
        [c.workspace_id, c.id, context.user.id],
      )
    ).rowCount;
    if (!target)
      throw new VoiceAccessError(
        "You are not an approved target of this incoming call.",
      );
  });
}
export async function receiveVoiceDialAction(
  callId: string,
  p: Record<string, string>,
) {
  const c = await callForCallback(p, { callId });
  return tx(c.workspace_id, null, async (db) => {
    const live = await getCallDb(db, c.workspace_id, c.id);
    if (p.CallSid !== live.parent_sid)
      throw new VoiceInputError("The dial result does not match this call.");
    const status = statusSchema.parse(p.DialCallStatus),
      duration = durationOf(p.DialCallDuration);
    if (["busy","no-answer","canceled","failed"].includes(status) && !live.answered_at) {
      await db.query("UPDATE voice_call_recordings SET status='absent' WHERE workspace_id=$1 AND call_id=$2 AND status='pending' AND recording_sid IS NULL",[c.workspace_id,c.id]);
    }
    if (p.DialCallSid) {
      await bindLeg(
        db,
        live,
        { ...p, CallSid: p.DialCallSid, ParentCallSid: live.parent_sid! },
        live.direction === "outbound" ? "customer" : "staff",
      );
    }
    await applyStatus(
      db,
      live,
      status,
      duration,
      live.direction === "outbound"
        ? "customer"
        : status === "completed"
          ? "staff"
          : "parent",
    );
    const line = (
      await db.query<LineRow>(
        "SELECT * FROM voice_lines WHERE workspace_id=$1 AND id=$2",
        [c.workspace_id, c.line_id],
      )
    ).rows[0];
    return {
      voicemail:
        live.direction === "inbound" &&
        status !== "completed" &&
        !live.answered_at,
      greeting: line.greeting,
    };
  });
}
export async function receiveVoicemailStatus(
  callId: string,
  p: Record<string, string>,
) {
  const c = await callForCallback(p, { callId });
  if (c.direction !== "inbound" || p.CallSid !== c.parent_sid)
    throw new VoiceInputError(
      "This voicemail is not bound to an incoming call.",
    );
  const recording = recordingSchema.parse(p.RecordingSid),
    duration = durationOf(p.RecordingDuration);
  if (duration !== null && duration > 185)
    throw new VoiceInputError("This voicemail exceeds its duration limit.");
  const status =
    p.RecordingStatus === "completed"
      ? "ready"
      : ["absent", "failed"].includes(p.RecordingStatus)
        ? "failed"
        : p.RecordingStatus === "in-progress"
          ? "processing"
          : null;
  if (!status)
    throw new VoiceInputError("This voicemail status is unsupported.");
  return tx(c.workspace_id, null, async (db) => {
    const old = (
      await db.query<{ call_id: string; status: string }>(
        "SELECT call_id,status FROM voice_voicemails WHERE recording_sid=$1",
        [recording],
      )
    ).rows[0];
    if (old && old.call_id !== c.id)
      throw new VoiceInputError("This recording belongs to another call.");
    if (old && ["ready", "deleted", "deleting"].includes(old.status)) return;
    await db.query(
      "INSERT INTO voice_voicemails(id,workspace_id,call_id,recording_sid,status,duration) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(recording_sid) DO UPDATE SET status=EXCLUDED.status,duration=EXCLUDED.duration",
      [randomUUID(), c.workspace_id, c.id, recording, status, duration],
    );
    await refreshSource(db, c.workspace_id, c.voice_conversation_id);
  });
}
export async function receiveVoicemailAction(
  callId: string,
  p: Record<string, string>,
) {
  const c = await callForCallback(p, { callId });
  if (c.direction !== "inbound" || p.CallSid !== c.parent_sid)
    throw new VoiceInputError(
      "This voicemail action does not match the incoming call.",
    );
  durationOf(p.RecordingDuration);
}
export async function getVoicemailDownload(
  context: DashboardContext,
  id: string,
) {
  const row = (
    await getDatabasePool().query<{
      line_id: string;
      recording_sid: string;
      parent_sid: string;
      status: string;
      expires_at: Date;
    }>(
      `SELECT v.*,c.line_id,c.parent_sid FROM voice_voicemails v JOIN voice_calls c ON c.id=v.call_id AND c.workspace_id=v.workspace_id WHERE v.workspace_id=$1 AND v.id=$2`,
      [context.workspace.id, id],
    )
  ).rows[0];
  if (!row) throw new VoiceInputError("This voicemail is unavailable.");
  await lineAccess(getDatabasePool(), context, row.line_id);
  if (row.status !== "ready" || row.expires_at.getTime() <= Date.now())
    throw new VoiceInputError(
      "This voicemail is expired, deleted, or not ready.",
    );
  return { recordingSid: row.recording_sid, callSid: row.parent_sid };
}
export async function deleteVoicemail(context: DashboardContext, id: string) {
  const item = await tx(context.workspace.id, context, async (db) => {
    const row = (
      await db.query<{
        line_id: string;
        recording_sid: string;
        parent_sid: string;
        status: string;
        lease_until: Date | null;
      }>(
        `SELECT v.*,c.line_id,c.parent_sid FROM voice_voicemails v JOIN voice_calls c ON c.id=v.call_id AND c.workspace_id=v.workspace_id WHERE v.workspace_id=$1 AND v.id=$2 FOR UPDATE OF v`,
        [context.workspace.id, id],
      )
    ).rows[0];
    if (!row) throw new VoiceInputError("This voicemail is unavailable.");
    await lineAccess(db, context, row.line_id, "voicemail");
    if (row.status === "deleted") return null;
    if (row.lease_until && row.lease_until.getTime() > Date.now())
      throw new VoiceInputError(
        "Voicemail deletion is already pending. Refresh its status.",
      );
    await db.query(
      "UPDATE voice_voicemails SET status='deleting',deletion_attempts=CASE WHEN deletion_attempts>=10 THEN 0 ELSE deletion_attempts END,lease_until=now()+interval '1 minute' WHERE workspace_id=$1 AND id=$2",
      [context.workspace.id, id],
    );
    return row;
  });
  if (!item) return;
  try {
    await deleteVoicemailMedia({
      recordingSid: item.recording_sid,
      callSid: item.parent_sid,
    });
    await tx(context.workspace.id, context, async (db) => {
      await db.query(
        "UPDATE voice_voicemails SET status='deleted',deleted_at=now(),lease_until=NULL WHERE workspace_id=$1 AND id=$2",
        [context.workspace.id, id],
      );
      await audit(db, context, "voice.voicemail.deleted", id);
    });
  } catch (error) {
    await getDatabasePool().query(
      "UPDATE voice_voicemails SET status=CASE WHEN deletion_attempts>=9 THEN 'failed' ELSE status END,lease_until=NULL,delete_after=now()+interval '1 hour',deletion_attempts=deletion_attempts+1 WHERE workspace_id=$1 AND id=$2",
      [context.workspace.id, id],
    );
    throw error;
  }
}
export async function endCall(context: DashboardContext, raw: unknown) {
  const i = callSchema.parse(raw);
  await authorizeVoice(context, true);
  const c = await getCallDb(getDatabasePool(), context.workspace.id, i.callId);
  // A participating active teammate can stop an existing billable call even if
  // their line's new-call permission was revoked while it was connected.
  if (
    c.actor_user_id !== context.user.id &&
    c.staff_user_id !== context.user.id
  )
    throw new VoiceAccessError(
      "Only the staff member participating in this call can end it.",
    );
  const config = getVoiceConfiguration();
  const bound = (
    await getDatabasePool().query(
      "SELECT 1 FROM voice_lines WHERE workspace_id=$1 AND id=$2 AND account_sid=$3 AND phone=$4",
      [context.workspace.id, c.line_id, config.accountSid, config.phoneNumber],
    )
  ).rowCount;
  if (!bound)
    throw new VoiceAccessError(
      "This call line no longer matches the configured provider.",
    );
  if (!c.parent_sid) {
    await tx(context.workspace.id, context, async (db) => {
      await db.query(
        "UPDATE voice_intents SET expires_at=LEAST(expires_at,now()) WHERE workspace_id=$1 AND call_id=$2",
        [context.workspace.id, c.id],
      );
      await applyStatus(db, c, "canceled", null, "parent");
    });
    return;
  }
  const result = await endVoiceCall(c.parent_sid);
  await tx(context.workspace.id, null, async (db) => {
    await applyStatus(
      db,
      await getCallDb(db, context.workspace.id, c.id),
      result.status,
      result.duration,
      "parent",
    );
  });
}
