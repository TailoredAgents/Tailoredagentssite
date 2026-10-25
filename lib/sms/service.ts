import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { getTwilioConfiguration } from "@/lib/twilio/config";
import {
  createSms,
  fetchSms,
  lookupOwnedNumber,
  TwilioProviderError,
} from "@/lib/twilio/provider";
import { authorizeSms, requireSmsNumber, SmsAccessError } from "./data";
import {
  checkSchema,
  connectSchema,
  conversationSchema,
  draftSchema,
  grantSchema,
  noteSchema,
  numberSchema,
  phoneSchema,
  sendSchema,
  threadSchema,
} from "./validation";
import type { SmsActionState } from "./types";

export class SmsInputError extends Error {}
async function tx<T>(
  workspaceId: string,
  context: DashboardContext | null,
  work: (db: PoolClient) => Promise<T>,
  manage = false,
  read = false,
) {
  const db = await getDatabasePool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `agency-sms:${workspaceId}`,
    ]);
    if (context) {
      const access = await db.query<{ role: string }>(
        "SELECT m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active'",
        [workspaceId, context.user.id],
      );
      const role = access.rows[0]?.role;
      if (
        !role ||
        (!read && !["owner", "admin", "member"].includes(role)) ||
        (manage && !["owner", "admin"].includes(role))
      )
        throw new SmsAccessError(
          "Your workspace access no longer allows this action.",
        );
    }
    const result = await work(db);
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
    targetType: "sms_conversation",
    targetId: id,
    metadata,
  });
}
async function numberAccess(
  db: PoolClient,
  context: DashboardContext,
  numberId: string,
  send = false,
  manage = false,
) {
  const config = getTwilioConfiguration();
  if (!config.ready)
    throw new SmsAccessError("Configure the SMS service in Settings first.");
  const row = (
    await db.query<{
      id: string;
      phone: string;
      status: string;
      account_sid: string;
      can_send: boolean;
    }>(
      `SELECT n.*,COALESCE(g.can_send,false) AS can_send FROM sms_numbers n LEFT JOIN sms_number_grants g ON g.number_id=n.id AND g.workspace_id=n.workspace_id AND g.user_id=$3 WHERE n.workspace_id=$1 AND n.id=$2 AND n.account_sid=$4 AND n.phone=$5 ${manage ? "" : "AND g.user_id IS NOT NULL"}`,
      [
        context.workspace.id,
        numberId,
        context.user.id,
        config.accountSid,
        config.phoneNumber,
      ],
    )
  ).rows[0];
  if (!row)
    throw new SmsAccessError(
      "This business number is not available to your account.",
    );
  if (send && (!row.can_send || row.status !== "active" || !config.enabled))
    throw new SmsAccessError(
      "Sending is paused or your number grant does not allow sending.",
    );
  return row;
}
async function conversationRow(
  db: PoolClient,
  context: DashboardContext,
  numberId: string,
  id: string,
) {
  const row = (
    await db.query<{ id: string; remote_phone: string }>(
      "SELECT id,remote_phone FROM sms_conversations WHERE workspace_id=$1 AND number_id=$2 AND id=$3 AND deleted_at IS NULL",
      [context.workspace.id, numberId, id],
    )
  ).rows[0];
  if (!row)
    throw new SmsInputError("This conversation is no longer available.");
  return row;
}
async function ensureConversation(
  db: PoolClient,
  workspaceId: string,
  numberId: string,
  phone: string,
) {
  return (
    await db.query<{ id: string; remote_phone: string }>(
      "INSERT INTO sms_conversations(id,workspace_id,number_id,remote_phone) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,number_id,remote_phone) WHERE deleted_at IS NULL DO UPDATE SET remote_phone=EXCLUDED.remote_phone RETURNING id,remote_phone",
      [randomUUID(), workspaceId, numberId, phone],
    )
  ).rows[0];
}
export async function connectSmsNumber(
  context: DashboardContext,
  raw: unknown,
) {
  const input = connectSchema.parse(raw);
  await authorizeSms(context, true, true);
  const config = getTwilioConfiguration();
  if (!config.ready || input.phone !== config.phoneNumber)
    throw new SmsInputError(
      "Choose the business number configured for this environment.",
    );
  const verified = await lookupOwnedNumber(input.phone);
  if (
    !verified.smsEnabled ||
    verified.phone !== config.phoneNumber ||
    verified.accountSid !== config.accountSid
  )
    throw new SmsInputError(
      "Twilio has not verified this account's SMS-capable business number.",
    );
  return tx(
    context.workspace.id,
    context,
    async (db) => {
      const existing = (
        await db.query<{ id: string; workspace_id: string }>(
          "SELECT id,workspace_id FROM sms_numbers WHERE account_sid=$1 AND phone=$2 FOR UPDATE",
          [config.accountSid, input.phone],
        )
      ).rows[0];
      if (existing && existing.workspace_id !== context.workspace.id)
        throw new SmsInputError(
          "This business number is already connected to another workspace.",
        );
      const id = existing?.id ?? randomUUID();
      if (!existing)
        await db.query(
          "INSERT INTO sms_numbers(id,workspace_id,account_sid,provider_sid,phone,connected_by_user_id) VALUES($1,$2,$3,$4,$5,$6)",
          [
            id,
            context.workspace.id,
            verified.accountSid,
            verified.providerSid,
            verified.phone,
            context.user.id,
          ],
        );
      await db.query(
        "INSERT INTO sms_number_grants(workspace_id,number_id,user_id,can_send,approved_by_user_id) VALUES($1,$2,$3,true,$3) ON CONFLICT(workspace_id,number_id,user_id) DO UPDATE SET can_send=true,approved_by_user_id=EXCLUDED.approved_by_user_id,updated_at=now()",
        [context.workspace.id, id, context.user.id],
      );
      await audit(db, context, "sms.number_connected", id);
      return id;
    },
    true,
  );
}
export async function saveSmsGrant(context: DashboardContext, raw: unknown) {
  const input = grantSchema.parse(raw);
  if (input.canSend && !input.canRead)
    throw new SmsInputError("Read access is required before allowing sends.");
  await authorizeSms(context, true, true);
  await tx(
    context.workspace.id,
    context,
    async (db) => {
      await numberAccess(db, context, input.numberId, false, true);
      const target = await db.query(
        "SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2 AND status='active'",
        [context.workspace.id, input.userId],
      );
      if (!target.rowCount)
        throw new SmsInputError("Choose an active teammate in this workspace.");
      if (input.canRead)
        await db.query(
          "INSERT INTO sms_number_grants(workspace_id,number_id,user_id,can_send,approved_by_user_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,number_id,user_id) DO UPDATE SET can_send=EXCLUDED.can_send,approved_by_user_id=EXCLUDED.approved_by_user_id,updated_at=now()",
          [
            context.workspace.id,
            input.numberId,
            input.userId,
            input.canSend,
            context.user.id,
          ],
        );
      else
        await db.query(
          "DELETE FROM sms_number_grants WHERE workspace_id=$1 AND number_id=$2 AND user_id=$3",
          [context.workspace.id, input.numberId, input.userId],
        );
      await audit(
        db,
        context,
        input.canRead ? "sms.grant_saved" : "sms.grant_revoked",
        input.numberId,
        { userId: input.userId, canSend: input.canSend },
      );
    },
    true,
  );
}
export async function setSmsNumberStatus(
  context: DashboardContext,
  raw: unknown,
) {
  const input = numberSchema.parse(raw);
  await authorizeSms(context, true, true);
  await tx(
    context.workspace.id,
    context,
    async (db) => {
      await numberAccess(db, context, input.numberId, false, true);
      await db.query(
        "UPDATE sms_numbers SET status=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2",
        [context.workspace.id, input.numberId, input.status],
      );
      await audit(db, context, "sms.number_status_changed", input.numberId, {
        status: input.status,
      });
    },
    true,
  );
}
export async function saveSmsConversation(
  context: DashboardContext,
  raw: unknown,
) {
  const input = conversationSchema.parse(raw);
  await authorizeSms(context, true);
  await tx(context.workspace.id, context, async (db) => {
    await numberAccess(db, context, input.numberId);
    await conversationRow(db, context, input.numberId, input.conversationId);
    if (
      input.ownerId &&
      !(
        await db.query(
          "SELECT 1 FROM workspace_memberships m JOIN sms_number_grants g ON g.workspace_id=m.workspace_id AND g.user_id=m.user_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin','member') AND g.number_id=$3",
          [context.workspace.id, input.ownerId, input.numberId],
        )
      ).rowCount
    )
      throw new SmsInputError(
        "Choose an active editor with access to this number.",
      );
    if (
      input.businessId &&
      !(
        await db.query(
          "SELECT 1 FROM crm_businesses WHERE workspace_id=$1 AND id=$2 AND anonymized_at IS NULL",
          [context.workspace.id, input.businessId],
        )
      ).rowCount
    )
      throw new SmsInputError(
        "Choose an available business in this workspace.",
      );
    if (
      input.leadId &&
      !(
        await db.query(
          "SELECT 1 FROM leads WHERE workspace_id=$1 AND id=$2 AND status<>'archived'",
          [context.workspace.id, input.leadId],
        )
      ).rowCount
    )
      throw new SmsInputError("Choose an available inquiry in this workspace.");
    await db.query(
      "UPDATE sms_conversations SET status=$1,owner_user_id=$2,business_id=$3,lead_id=$4,updated_at=now() WHERE id=$5 AND workspace_id=$6",
      [
        input.status,
        input.ownerId || null,
        input.businessId || null,
        input.leadId || null,
        input.conversationId,
        context.workspace.id,
      ],
    );
    await audit(db, context, "sms.conversation_updated", input.conversationId, {
      status: input.status,
    });
  });
}
export async function saveSmsDraft(context: DashboardContext, raw: unknown) {
  const input = draftSchema.parse(raw);
  await authorizeSms(context, true);
  await tx(context.workspace.id, context, async (db) => {
    await numberAccess(db, context, input.numberId);
    if (input.conversationId)
      await conversationRow(db, context, input.numberId, input.conversationId);
    await db.query(
      "INSERT INTO sms_drafts(id,workspace_id,number_id,author_user_id,thread_key,recipient,body) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workspace_id,number_id,author_user_id,thread_key) DO UPDATE SET recipient=EXCLUDED.recipient,body=EXCLUDED.body,updated_at=now()",
      [
        randomUUID(),
        context.workspace.id,
        input.numberId,
        context.user.id,
        input.conversationId || input.composeKey || "",
        input.to,
        input.text,
      ],
    );
  });
}
export async function addSmsNote(context: DashboardContext, raw: unknown) {
  const input = noteSchema.parse(raw);
  await authorizeSms(context, true);
  await tx(context.workspace.id, context, async (db) => {
    await numberAccess(db, context, input.numberId);
    await conversationRow(db, context, input.numberId, input.conversationId);
    await db.query(
      "INSERT INTO sms_notes(id,workspace_id,conversation_id,author_user_id,body) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        context.workspace.id,
        input.conversationId,
        context.user.id,
        input.body,
      ],
    );
    await audit(db, context, "sms.note_added", input.conversationId);
  });
}
export async function markSmsRead(context: DashboardContext, raw: unknown) {
  const input = threadSchema.parse(raw);
  await tx(
    context.workspace.id,
    context,
    async (db) => {
      await numberAccess(db, context, input.numberId);
      await conversationRow(db, context, input.numberId, input.conversationId);
      const latest = (
        await db.query<{ id: string }>(
          "SELECT id FROM sms_messages WHERE workspace_id=$1 AND conversation_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1",
          [context.workspace.id, input.conversationId],
        )
      ).rows[0];
      if (!latest) return;
      await db.query(
        "INSERT INTO sms_read_receipts(workspace_id,conversation_id,user_id,latest_message_id) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,conversation_id,user_id) DO UPDATE SET latest_message_id=EXCLUDED.latest_message_id,read_at=now()",
        [
          context.workspace.id,
          input.conversationId,
          context.user.id,
          latest.id,
        ],
      );
    },
    false,
    true,
  );
}

type Intent = {
  request_id: string;
  workspace_id: string;
  number_id: string;
  message_id: string;
  actor_user_id: string | null;
  request_hash: string;
  state: "sending" | "accepted" | "unknown" | "rejected";
  provider_sid: string | null;
  conversation_id: string;
  remote_phone: string;
  phone: string;
  account_sid: string;
  status: string;
};
const intentSql = `SELECT i.*,m.conversation_id,m.status,c.remote_phone,n.phone,n.account_sid FROM sms_outbound_intents i JOIN sms_messages m ON m.id=i.message_id AND m.workspace_id=i.workspace_id JOIN sms_conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id JOIN sms_numbers n ON n.id=i.number_id AND n.workspace_id=i.workspace_id`;
function result(intent: Intent): SmsActionState {
  return {
    status: intent.state === "accepted" ? "success" : "error",
    message:
      intent.state === "accepted"
        ? intent.status === "delivered"
          ? "Twilio reports this text delivered."
          : ["failed", "undelivered"].includes(intent.status)
            ? "Twilio reports this text could not be delivered. Review its status before creating another message."
            : "Twilio accepted this text. Delivery is not yet confirmed."
        : intent.state === "rejected"
          ? "Twilio did not accept this text. Review the recipient and configuration before another attempt."
          : "This send has not been confirmed. Check its status; this request will never create another send.",
    requestId: intent.request_id,
    sendState: intent.state === "sending" ? "pending" : intent.state,
    conversationId: intent.conversation_id,
  };
}
const statusRanks: Record<string, number> = {
  reserved: 0,
  unknown: 1,
  accepted: 10,
  queued: 10,
  sending: 20,
  sent: 30,
  failed: 40,
  undelivered: 40,
  delivered: 50,
  received: 50,
};
async function applyStatus(
  db: PoolClient,
  workspaceId: string,
  messageId: string,
  status: string,
  errorCode: string | null,
) {
  if (!(status in statusRanks))
    throw new SmsInputError("The SMS provider returned an unsupported status.");
  await db.query(
    "UPDATE sms_messages SET status=$3,status_rank=$4,error_code=$5,updated_at=now() WHERE workspace_id=$1 AND id=$2 AND status_rank<=$4",
    [workspaceId, messageId, status, statusRanks[status], errorCode],
  );
}
function validProvider(
  record: { sid: string; accountSid: string; from: string; to: string },
  intent: Pick<Intent, "account_sid" | "phone" | "remote_phone">,
) {
  return (
    record.accountSid === intent.account_sid &&
    record.from === intent.phone &&
    record.to === intent.remote_phone &&
    /^(SM|MM)[0-9a-f]{32}$/i.test(record.sid)
  );
}
export async function sendSmsMessage(
  context: DashboardContext,
  raw: unknown,
): Promise<SmsActionState> {
  const input = sendSchema.parse(raw);
  await requireSmsNumber(context, input.numberId, true);
  const reservation = await tx(context.workspace.id, context, async (db) => {
    const number = await numberAccess(db, context, input.numberId, true);
    const linked = input.conversationId
      ? await conversationRow(db, context, input.numberId, input.conversationId)
      : null;
    const phone = linked?.remote_phone ?? phoneSchema.parse(input.to);
    if (phone === number.phone)
      throw new SmsInputError(
        "Choose a recipient other than the business number.",
      );
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          numberId: number.id,
          to: phone,
          text: input.text,
          actor: context.user.id,
        }),
      )
      .digest("hex");
    const existing = (
      await db.query<Intent>(
        `${intentSql} WHERE i.workspace_id=$1 AND i.request_id=$2`,
        [context.workspace.id, input.requestId],
      )
    ).rows[0];
    if (existing) {
      if (
        existing.number_id !== input.numberId ||
        existing.actor_user_id !== context.user.id ||
        existing.request_hash !== hash
      )
        throw new SmsInputError(
          "This send key belongs to a different message. Check the original attempt without changing it.",
        );
      return { created: false, intent: existing };
    }
    const quota = (
      await db.query<{ actor: number; number: number }>(
        "SELECT count(*) FILTER(WHERE actor_user_id=$3)::int AS actor,count(*)::int AS number FROM sms_outbound_intents WHERE workspace_id=$1 AND number_id=$2 AND created_at>now()-interval '1 hour'",
        [context.workspace.id, input.numberId, context.user.id],
      )
    ).rows[0];
    if (quota.actor >= 30 || quota.number >= 100)
      throw new SmsInputError(
        "The hourly SMS limit has been reached (30 per teammate, 100 per business number). Existing send status checks remain available.",
      );
    const preference = (
      await db.query<{ status: string }>(
        "SELECT status FROM crm_channel_preferences WHERE workspace_id=$1 AND channel='sms' AND normalized_address=$2 FOR UPDATE",
        [context.workspace.id, phone],
      )
    ).rows[0]?.status;
    if (preference === "blocked")
      throw new SmsInputError(
        "This phone number has opted out of SMS.",
      );
    const conversation =
        linked ??
        (await ensureConversation(db, context.workspace.id, number.id, phone)),
      messageId = randomUUID();
    await db.query(
      "INSERT INTO sms_messages(id,workspace_id,conversation_id,direction,body,status,actor_user_id) VALUES($1,$2,$3,'outbound',$4,'reserved',$5)",
      [
        messageId,
        context.workspace.id,
        conversation.id,
        input.text,
        context.user.id,
      ],
    );
    await db.query(
      "INSERT INTO sms_outbound_intents(request_id,workspace_id,number_id,message_id,actor_user_id,request_hash,state) VALUES($1,$2,$3,$4,$5,$6,'sending')",
      [
        input.requestId,
        context.workspace.id,
        number.id,
        messageId,
        context.user.id,
        hash,
      ],
    );
    await db.query(
      "UPDATE sms_conversations SET updated_at=now() WHERE id=$1 AND workspace_id=$2",
      [conversation.id, context.workspace.id],
    );
    await audit(db, context, "sms.send_reserved", conversation.id, {
      requestId: input.requestId,
    });
    return {
      created: true,
      intent: {
        request_id: input.requestId,
        workspace_id: context.workspace.id,
        number_id: number.id,
        message_id: messageId,
        actor_user_id: context.user.id,
        request_hash: hash,
        state: "sending",
        provider_sid: null,
        conversation_id: conversation.id,
        remote_phone: phone,
        phone: number.phone,
        account_sid: number.account_sid,
        status: "reserved",
      } as Intent,
    };
  });
  if (!reservation.created) return result(reservation.intent);
  const intent = reservation.intent;
  try {
    // Recheck the grant, sending switch and suppression immediately before the
    // one permitted create request. Status checks never enter this branch.
    await requireSmsNumber(context, input.numberId, true);
    if (
      (
        await getDatabasePool().query(
          "SELECT 1 FROM crm_channel_preferences WHERE workspace_id=$1 AND channel='sms' AND normalized_address=$2 AND status='blocked'",
          [context.workspace.id, intent.remote_phone],
        )
      ).rowCount
    )
      throw new SmsInputError("This phone number has opted out of SMS.");
    const sent = await createSms({
      from: intent.phone,
      to: intent.remote_phone,
      text: input.text,
      attemptId: input.requestId,
    });
    if (!validProvider(sent, intent))
      throw new Error("Unexpected SMS provider identity");
    return await tx(context.workspace.id, null, async (db) => {
      const current = (
        await db.query<Intent>(
          `${intentSql} WHERE i.workspace_id=$1 AND i.request_id=$2`,
          [context.workspace.id, input.requestId],
        )
      ).rows[0];
      if (current.provider_sid && current.provider_sid !== sent.sid)
        throw new Error("Provider message identity changed");
      await db.query(
        "UPDATE sms_outbound_intents SET state='accepted',provider_sid=$3,updated_at=now() WHERE workspace_id=$1 AND request_id=$2",
        [context.workspace.id, input.requestId, sent.sid],
      );
      await db.query(
        "UPDATE sms_messages SET provider_sid=$3 WHERE workspace_id=$1 AND id=$2",
        [context.workspace.id, intent.message_id, sent.sid],
      );
      await applyStatus(
        db,
        context.workspace.id,
        intent.message_id,
        sent.status,
        null,
      );
      await db.query(
        "DELETE FROM sms_drafts WHERE workspace_id=$1 AND number_id=$2 AND author_user_id=$3 AND thread_key=$4 AND body=$5 AND recipient=$6",
        [
          context.workspace.id,
          input.numberId,
          context.user.id,
          input.conversationId || input.composeKey || "",
          input.text,
          input.to,
        ],
      );
      await audit(db, context, "sms.message_accepted", intent.conversation_id, {
        requestId: input.requestId,
      });
      return result(
        (
          await db.query<Intent>(
            `${intentSql} WHERE i.workspace_id=$1 AND i.request_id=$2`,
            [context.workspace.id, input.requestId],
          )
        ).rows[0],
      );
    });
  } catch (error) {
    const rejected =
      error instanceof SmsAccessError ||
      error instanceof SmsInputError ||
      (error instanceof TwilioProviderError && error.outcome === "rejected");
    return tx(context.workspace.id, null, async (db) => {
      // A signed callback may have completed the reservation while the HTTP call
      // failed. Never overwrite that proof with a weaker transport outcome.
      const current = (
        await db.query<Intent>(
          `${intentSql} WHERE i.workspace_id=$1 AND i.request_id=$2`,
          [context.workspace.id, input.requestId],
        )
      ).rows[0];
      if (current.provider_sid) return result(current);
      if (
        error instanceof TwilioProviderError &&
        error.providerCode === 21610
      ) {
        await db.query(
          "INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status,evidence) VALUES($1,'sms',$2,'blocked','Twilio reported recipient opt-out (21610).') ON CONFLICT(workspace_id,channel,normalized_address) DO UPDATE SET status='blocked',evidence=EXCLUDED.evidence,actor_user_id=NULL,updated_at=now()",
          [context.workspace.id, intent.remote_phone],
        );
      }
      await db.query(
        "UPDATE sms_outbound_intents SET state=$3,updated_at=now() WHERE workspace_id=$1 AND request_id=$2",
        [
          context.workspace.id,
          input.requestId,
          rejected ? "rejected" : "unknown",
        ],
      );
      await applyStatus(
        db,
        context.workspace.id,
        intent.message_id,
        rejected ? "failed" : "unknown",
        null,
      );
      const state = result({
        ...current,
        state: rejected ? "rejected" : "unknown",
      });
      if (rejected && error instanceof Error) state.message = error.message;
      return state;
    });
  }
}
export async function checkSmsSend(
  context: DashboardContext,
  raw: unknown,
): Promise<SmsActionState> {
  const input = checkSchema.parse(raw);
  await requireSmsNumber(context, input.numberId);
  const intent = (
    await getDatabasePool().query<Intent>(
      `${intentSql} WHERE i.workspace_id=$1 AND i.request_id=$2 AND i.number_id=$3 AND i.actor_user_id=$4`,
      [context.workspace.id, input.requestId, input.numberId, context.user.id],
    )
  ).rows[0];
  if (!intent)
    throw new SmsInputError(
      "This send attempt is not available to your account.",
    );
  if (!intent.provider_sid)
    return result({
      ...intent,
      state: intent.state === "sending" ? "unknown" : intent.state,
    });
  try {
    const latest = await fetchSms(intent.provider_sid);
    if (!validProvider(latest, intent) || latest.sid !== intent.provider_sid)
      throw new SmsInputError(
        "The provider response does not match this send.",
      );
    await tx(
      context.workspace.id,
      context,
      async (db) => {
        await numberAccess(db, context, input.numberId);
        await applyStatus(
          db,
          context.workspace.id,
          intent.message_id,
          latest.status,
          null,
        );
      },
      false,
      true,
    );
  } catch (error) {
    if (error instanceof SmsAccessError) throw error;
    return {
      ...result(intent),
      message:
        "The provider status could not be refreshed. No new text was sent.",
    };
  }
  await requireSmsNumber(context, input.numberId);
  return result(
    (
      await getDatabasePool().query<Intent>(
        `${intentSql} WHERE i.workspace_id=$1 AND i.request_id=$2`,
        [context.workspace.id, input.requestId],
      )
    ).rows[0],
  );
}

const accountSid = z.string().regex(/^AC[0-9a-f]{32}$/i),
  messageSid = z.string().regex(/^(SM|MM)[0-9a-f]{32}$/i),
  e164 = z.string().regex(/^\+[1-9][0-9]{7,14}$/);
const incomingSchema = z.object({
  AccountSid: accountSid,
  MessageSid: messageSid,
  From: e164,
  To: e164,
  Body: z.string().max(1600).default(""),
  NumMedia: z
    .string()
    .regex(/^\d{1,3}$/)
    .transform(Number)
    .refine((n) => n <= 100)
    .default(0),
  OptOutType: z.string().max(20).optional(),
});
export async function receiveSmsWebhook(params: Record<string, string>) {
  const input = incomingSchema.parse({
    ...params,
    MessageSid: params.MessageSid || params.SmsSid,
  });
  if (params.SmsSid && params.SmsSid !== input.MessageSid)
    throw new SmsInputError("Conflicting provider message identities.");
  const config = getTwilioConfiguration();
  if (
    !config.webhookReady ||
    input.AccountSid !== config.accountSid ||
    input.To !== config.phoneNumber
  )
    throw new SmsAccessError(
      "This inbound message is outside the configured business number.",
    );
  const number = (
    await getDatabasePool().query<{ id: string; workspace_id: string }>(
      "SELECT n.id,n.workspace_id FROM sms_numbers n JOIN workspaces w ON w.id=n.workspace_id WHERE n.account_sid=$1 AND n.phone=$2 AND w.status='active'",
      [input.AccountSid, input.To],
    )
  ).rows[0];
  if (!number)
    throw new SmsAccessError("This business number is not connected.");
  return tx(number.workspace_id, null, async (db) => {
    const prior = (
      await db.query<{
        conversation_id: string;
        direction: string;
        workspace_id: string;
        number_id: string;
        remote_phone: string;
      }>(
        "SELECT m.conversation_id,m.direction,m.workspace_id,c.number_id,c.remote_phone FROM sms_messages m JOIN sms_conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id WHERE m.provider_sid=$1",
        [input.MessageSid],
      )
    ).rows[0];
    if (prior) {
      if (
        prior.workspace_id !== number.workspace_id ||
        prior.direction !== "inbound" ||
        prior.number_id !== number.id ||
        prior.remote_phone !== input.From
      )
        throw new SmsInputError(
          "This provider message identity is already reserved.",
        );
      return { conversationId: prior.conversation_id, duplicate: true };
    }
    const conversation = await ensureConversation(
        db,
        number.workspace_id,
        number.id,
        input.From,
      ),
      id = randomUUID();
    await db.query(
      "INSERT INTO sms_messages(id,workspace_id,conversation_id,direction,provider_sid,body,status,status_rank,media_count) VALUES($1,$2,$3,'inbound',$4,$5,'received',50,$6)",
      [
        id,
        number.workspace_id,
        conversation.id,
        input.MessageSid,
        input.Body,
        input.NumMedia,
      ],
    );
    await db.query(
      "UPDATE sms_conversations SET updated_at=now(),status='open' WHERE workspace_id=$1 AND id=$2",
      [number.workspace_id, conversation.id],
    );
    const stop =
      input.OptOutType?.toUpperCase() === "STOP" ||
      ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(
        input.Body.trim().toUpperCase(),
      );
    if (stop)
      await db.query(
        "INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status,evidence) VALUES($1,'sms',$2,'blocked','Inbound SMS opt-out received through verified Twilio webhook.') ON CONFLICT(workspace_id,channel,normalized_address) DO UPDATE SET status='blocked',evidence=EXCLUDED.evidence,actor_user_id=NULL,updated_at=now()",
        [number.workspace_id, input.From],
      );
    if (
      input.OptOutType?.toUpperCase() === "START" ||
      ["START", "UNSTOP"].includes(input.Body.trim().toUpperCase())
    )
      await insertAuditLog(db, {
        workspaceId: number.workspace_id,
        action: "sms.resubscription_review_requested",
        targetType: "sms_conversation",
        targetId: conversation.id,
      });
    return { conversationId: conversation.id, duplicate: false };
  });
}
const statusSchema = z.object({
  AccountSid: accountSid,
  MessageSid: messageSid,
  From: e164.optional(),
  To: e164.optional(),
  MessageStatus: z.enum([
    "accepted",
    "queued",
    "sending",
    "sent",
    "delivered",
    "undelivered",
    "failed",
  ]),
  ErrorCode: z
    .string()
    .regex(/^\d{1,20}$/)
    .optional(),
});
export async function receiveSmsStatus(
  attemptId: string,
  params: Record<string, string>,
) {
  z.string().uuid().parse(attemptId);
  const input = statusSchema.parse({
    ...params,
    MessageSid: params.MessageSid || params.SmsSid,
    MessageStatus: params.MessageStatus || params.SmsStatus,
    ErrorCode: params.ErrorCode || undefined,
  });
  if (params.SmsSid && params.SmsSid !== input.MessageSid)
    throw new SmsInputError("Conflicting provider message identities.");
  const config = getTwilioConfiguration();
  if (!config.webhookReady || input.AccountSid !== config.accountSid)
    throw new SmsAccessError(
      "This status is outside the configured business number.",
    );
  const found = (
    await getDatabasePool().query<Intent>(
      `${intentSql} WHERE i.request_id=$1`,
      [attemptId],
    )
  ).rows[0];
  if (!found)
    throw new SmsInputError("This status has no reserved send attempt.");
  if (
    found.account_sid !== config.accountSid ||
    found.phone !== config.phoneNumber ||
    (input.From !== undefined && input.From !== found.phone) ||
    (input.To !== undefined && input.To !== found.remote_phone)
  )
    throw new SmsAccessError("This status does not match its send attempt.");
  if (found.provider_sid && found.provider_sid !== input.MessageSid)
    throw new SmsInputError(
      "A different provider message is already attached to this attempt.",
    );
  if (!found.provider_sid && (!input.From || !input.To)) {
    const verified = await fetchSms(input.MessageSid);
    if (!validProvider(verified, found) || verified.sid !== input.MessageSid)
      throw new SmsAccessError(
        "This status could not be bound to the original send.",
      );
  }
  return tx(found.workspace_id, null, async (db) => {
    const current = (
      await db.query<Intent>(`${intentSql} WHERE i.request_id=$1`, [attemptId])
    ).rows[0];
    if (current.provider_sid && current.provider_sid !== input.MessageSid)
      throw new SmsInputError(
        "A different provider message is already attached to this attempt.",
      );
    await db.query(
      "UPDATE sms_outbound_intents SET provider_sid=$3,state='accepted',updated_at=now() WHERE workspace_id=$1 AND request_id=$2",
      [current.workspace_id, attemptId, input.MessageSid],
    );
    await db.query(
      "UPDATE sms_messages SET provider_sid=$3 WHERE workspace_id=$1 AND id=$2",
      [current.workspace_id, current.message_id, input.MessageSid],
    );
    await applyStatus(
      db,
      current.workspace_id,
      current.message_id,
      input.MessageStatus,
      input.ErrorCode || null,
    );
    return { accepted: true };
  });
}
