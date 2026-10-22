import "server-only";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import {
  getTwilioConfiguration,
  getTwilioPublicConfiguration,
} from "@/lib/twilio/config";
import type {
  SmsConversation,
  SmsDraft,
  SmsFilters,
  SmsNumber,
  SmsRecord,
  SmsSettings,
  SmsWorkspace,
} from "./types";

export class SmsAccessError extends Error {}
export function getSmsSendUnavailableReason(role: string, enabled: boolean, status: string, canSend: boolean) {
  if (!enabled) return "Outbound SMS is turned off for this workspace. An administrator must enable SMS sending in the server configuration.";
  if (status !== "active") return "This business number is paused. An administrator can resume it in Settings.";
  if (role === "viewer") return "Your dashboard access is read-only.";
  if (!canSend) return "Your number access allows reading. An administrator must enable sending for your account.";
  return null;
}
export async function authorizeSms(
  context: DashboardContext,
  mutate = false,
  manage = false,
) {
  const result = await getDatabasePool().query<{ role: string }>(
    "SELECT m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active'",
    [context.workspace.id, context.user.id],
  );
  const role = result.rows[0]?.role;
  if (
    !role ||
    (mutate && !["owner", "admin", "member"].includes(role)) ||
    (manage && !["owner", "admin"].includes(role))
  )
    throw new SmsAccessError(
      "Your workspace access does not allow this action.",
    );
  return role;
}
export async function requireSmsNumber(
  context: DashboardContext,
  numberId: string,
  sending = false,
) {
  const role = await authorizeSms(context, sending),
    config = getTwilioConfiguration();
  if (!config.ready)
    throw new SmsAccessError("Connect the SMS service in Settings first.");
  const found = await getDatabasePool().query<{
    id: string;
    phone: string;
    status: "active" | "paused";
    can_send: boolean;
    account_sid: string;
  }>(
    `SELECT n.id,n.phone,n.status,g.can_send,n.account_sid FROM sms_numbers n JOIN sms_number_grants g ON g.number_id=n.id AND g.workspace_id=n.workspace_id WHERE n.workspace_id=$1 AND n.id=$2 AND g.user_id=$3 AND n.account_sid=$4 AND n.phone=$5`,
    [
      context.workspace.id,
      numberId,
      context.user.id,
      config.accountSid,
      config.phoneNumber,
    ],
  );
  const number = found.rows[0];
  if (!number)
    throw new SmsAccessError(
      "This business number is not available to your account.",
    );
  const unavailableReason = getSmsSendUnavailableReason(role, config.enabled, number.status, number.can_send);
  if (sending && unavailableReason) throw new SmsAccessError(unavailableReason);
  return {
    ...number,
    canSend: unavailableReason === null,
    sendUnavailableReason: unavailableReason,
  };
}
const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const validId = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
const conversationSelect = `SELECT c.id,c.number_id AS "numberId",c.remote_phone AS phone,COALESCE(CASE WHEN lm.body_removed_at IS NULL AND lm.body_expires_at>now() THEN left(lm.body,180) ELSE '[Expired message content removed]' END,'') AS preview,lm.id AS "lastMessageId",COALESCE(lm.created_at,c.created_at) AS "lastMessageAt",COALESCE(r.latest_message_id=lm.id,false) AS "isRead",c.status,c.owner_user_id AS "ownerId",u.name AS "ownerName",c.business_id AS "businessId",c.lead_id AS "leadId",EXISTS(SELECT 1 FROM crm_channel_preferences p WHERE p.workspace_id=c.workspace_id AND p.channel='sms' AND p.normalized_address=c.remote_phone AND p.status='blocked') AS blocked FROM sms_conversations c LEFT JOIN "user" u ON u.id=c.owner_user_id LEFT JOIN LATERAL(SELECT m.id,m.body,m.body_removed_at,m.body_expires_at,m.created_at FROM sms_messages m WHERE m.conversation_id=c.id AND m.workspace_id=c.workspace_id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) lm ON true LEFT JOIN sms_read_receipts r ON r.conversation_id=c.id AND r.workspace_id=c.workspace_id AND r.user_id=$3`;
type ConversationRow = Omit<SmsConversation, "lastMessageAt"> & {
  lastMessageAt: Date;
};
function conversation(row: ConversationRow): SmsConversation {
  return { ...row, lastMessageAt: row.lastMessageAt.toISOString() };
}
async function privateDraft(
  context: DashboardContext,
  numberId: string,
  thread = "",
): Promise<SmsDraft | null> {
  return (
    (
      await getDatabasePool().query<SmsDraft>(
        `SELECT id,recipient AS "to",body AS text FROM sms_drafts WHERE workspace_id=$1 AND number_id=$2 AND author_user_id=$3 AND thread_key=$4 AND updated_at>now()-interval '90 days'`,
        [context.workspace.id, numberId, context.user.id, thread],
      )
    ).rows[0] ?? null
  );
}
export async function listSmsWorkspace(
  context: DashboardContext,
  filters: SmsFilters = {},
): Promise<SmsWorkspace> {
  const role = await authorizeSms(context),
    config = getTwilioConfiguration(),
    pool = getDatabasePool();
  const q = one(filters.q).slice(0, 120),
    view = ["open", "waiting", "done"].includes(one(filters.view))
      ? (one(filters.view) as "open" | "waiting" | "done")
      : "all",
    unreadOnly = one(filters.unread) === "1";
  const blank: SmsWorkspace = {
    connection: {
      state: "ready",
      message: "Connected to the business SMS inbox.",
    },
    numbers: [],
    number: null,
    items: [],
    total: 0,
    page: 1,
    pages: 1,
    q,
    view,
    unreadOnly,
    selected: null,
    composeDraft: null,
    members: [],
    links: { businesses: [], leads: [] },
  };
  if (!config.ready)
    return {
      ...blank,
      connection: {
        state: "setup",
        message:
          "Configure and verify the business number in Settings. SMS remains unavailable until setup is complete.",
      },
    };
  const listed = await pool.query<{
    id: string;
    phone: string;
    status: "active" | "paused";
    canSend: boolean;
  }>(
    `SELECT n.id,n.phone,n.status,g.can_send AS "canSend" FROM sms_numbers n JOIN sms_number_grants g ON g.number_id=n.id AND g.workspace_id=n.workspace_id WHERE n.workspace_id=$1 AND g.user_id=$2 AND n.account_sid=$3 AND n.phone=$4 ORDER BY n.phone`,
    [
      context.workspace.id,
      context.user.id,
      config.accountSid,
      config.phoneNumber,
    ],
  );
  const numbers: SmsNumber[] = listed.rows.map((n) => {
    const unavailableReason = getSmsSendUnavailableReason(role, config.enabled, n.status, n.canSend);
    return { ...n, label: "Business SMS", canSend: unavailableReason === null, sendUnavailableReason: unavailableReason };
  });
  const number = one(filters.number)
    ? numbers.find((n) => n.id === one(filters.number))
    : numbers[0];
  if (!number)
    return {
      ...blank,
      connection: {
        state: "grant_required",
        message:
          "Ask a workspace owner or administrator to approve your access to the business number.",
      },
    };
  const args: unknown[] = [context.workspace.id, number.id, context.user.id],
    where = ["c.workspace_id=$1", "c.number_id=$2"];
  if (view !== "all") {
    args.push(view);
    where.push(`c.status=$${args.length}`);
  }
  if (q) {
    args.push(`%${q.replace(/[\\%_]/g, "\\$&")}%`);
    where.push(
      `(c.remote_phone ILIKE $${args.length} ESCAPE '\\' OR EXISTS(SELECT 1 FROM crm_businesses b WHERE b.id=c.business_id AND b.workspace_id=c.workspace_id AND b.name ILIKE $${args.length} ESCAPE '\\') OR EXISTS(SELECT 1 FROM sms_messages m WHERE m.conversation_id=c.id AND m.workspace_id=c.workspace_id AND m.body_removed_at IS NULL AND m.body_expires_at>now() AND m.body ILIKE $${args.length} ESCAPE '\\'))`,
    );
  }
  if (unreadOnly) where.push("NOT COALESCE(r.latest_message_id=lm.id,false)");
  const matching = `${conversationSelect} WHERE ${where.join(" AND ")}`;
  const total = Number(
      (
        await pool.query(
          `SELECT count(*)::int AS n FROM (${matching}) found`,
          args,
        )
      ).rows[0].n,
    ),
    pages = Math.max(1, Math.ceil(total / 25)),
    page = Math.min(
      pages,
      Math.max(1, Number.parseInt(one(filters.page), 10) || 1),
    );
  const items = (
    await pool.query<ConversationRow>(
      `${matching} ORDER BY "lastMessageAt" DESC,c.id LIMIT 25 OFFSET $${args.length + 1}`,
      [...args, (page - 1) * 25],
    )
  ).rows.map(conversation);
  let selected: SmsRecord | null = null;
  if (validId(one(filters.thread))) {
    const row = (
      await pool.query<ConversationRow>(
        `${conversationSelect} WHERE c.workspace_id=$1 AND c.number_id=$2 AND c.id=$4`,
        [context.workspace.id, number.id, context.user.id, one(filters.thread)],
      )
    ).rows[0];
    if (row) {
      const [messages, notes, draft] = await Promise.all([
        pool.query<{
          id: string;
          direction: "inbound" | "outbound";
          text: string;
          status: string;
          errorCode: string | null;
          createdAt: Date;
          mediaCount: number;
          providerId: string | null;
        }>(
          `SELECT id,direction,CASE WHEN body_removed_at IS NULL AND body_expires_at>now() THEN body ELSE '[Expired message content removed]' END AS text,status,error_code AS "errorCode",created_at AS "createdAt",media_count AS "mediaCount",provider_sid AS "providerId" FROM sms_messages WHERE workspace_id=$1 AND conversation_id=$2 ORDER BY created_at DESC,id DESC LIMIT 200`,
          [context.workspace.id, row.id],
        ),
        pool.query<{
          id: string;
          authorName: string;
          body: string;
          createdAt: Date;
        }>(
          `SELECT n.id,COALESCE(u.name,'Former teammate') AS "authorName",n.body,n.created_at AS "createdAt" FROM sms_notes n LEFT JOIN "user" u ON u.id=n.author_user_id WHERE n.workspace_id=$1 AND n.conversation_id=$2 AND n.created_at>now()-interval '24 months' ORDER BY n.created_at DESC,n.id DESC LIMIT 200`,
          [context.workspace.id, row.id],
        ),
        privateDraft(context, number.id, row.id),
      ]);
      selected = {
        conversation: conversation(row),
        messages: messages.rows
          .reverse()
          .map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
        notes: notes.rows
          .reverse()
          .map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
        draft,
      };
    }
  }
  const [members, businesses, leads, composeDraft] = await Promise.all([
    pool.query<{ id: string; name: string; email: string }>(
      `SELECT u.id,u.name,u.email FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id JOIN sms_number_grants g ON g.user_id=u.id AND g.workspace_id=m.workspace_id WHERE m.workspace_id=$1 AND g.number_id=$2 AND m.status='active' AND m.role IN ('owner','admin','member') ORDER BY u.name LIMIT 200`,
      [context.workspace.id, number.id],
    ),
    pool.query<{ id: string; name: string; clientId: string | null }>(
      `SELECT id,name,client_id AS "clientId" FROM crm_businesses WHERE workspace_id=$1 AND anonymized_at IS NULL ORDER BY name LIMIT 500`,
      [context.workspace.id],
    ),
    pool.query<{ id: string; name: string }>(
      `SELECT id,organization || ' — ' || name AS name FROM leads WHERE workspace_id=$1 AND status<>'archived' ORDER BY created_at DESC LIMIT 500`,
      [context.workspace.id],
    ),
    privateDraft(context, number.id),
  ]);
  try {
    await requireSmsNumber(context, number.id);
  } catch (error) {
    if (error instanceof SmsAccessError)
      return {
        ...blank,
        connection: { state: "grant_required", message: error.message },
      };
    throw error;
  }
  return {
    ...blank,
    numbers,
    number,
    items,
    total,
    page,
    pages,
    selected,
    composeDraft,
    members: members.rows,
    links: { businesses: businesses.rows, leads: leads.rows },
  };
}
export async function listSmsSettings(
  context: DashboardContext,
): Promise<SmsSettings> {
  const role = await authorizeSms(context),
    config = getTwilioPublicConfiguration(),
    full = getTwilioConfiguration(),
    canManage = ["owner", "admin"].includes(role);
  const blank: SmsSettings = {
    connection: {
      state: config.ready ? "ready" : "setup",
      message: !config.ready
        ? "SMS setup is incomplete."
        : config.enabled
          ? "SMS is configured. Number approval and permissions still apply."
          : "SMS is configured. Sending is paused by the server switch.",
    },
    configuredPhone: config.phoneNumber || null,
    canManage,
    numbers: [],
    members: [],
    incomingUrl: config.incomingUrl,
    statusUrl: config.statusUrlTemplate,
  };
  if (!canManage) return blank;
  const pool = getDatabasePool(),
    [numbers, members] = await Promise.all([
      pool.query<{ id: string; phone: string; status: "active" | "paused" }>(
        "SELECT id,phone,status FROM sms_numbers WHERE workspace_id=$1 AND account_sid=$2 AND phone=$3 ORDER BY phone",
        [context.workspace.id, full.accountSid, full.phoneNumber],
      ),
      pool.query<{ id: string; name: string; email: string }>(
        `SELECT u.id,u.name,u.email FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id WHERE m.workspace_id=$1 AND m.status='active' ORDER BY u.name LIMIT 200`,
        [context.workspace.id],
      ),
    ]);
  const grants = await pool.query<{
    numberId: string;
    userId: string;
    name: string;
    email: string;
    canSend: boolean;
  }>(
    `SELECT g.number_id AS "numberId",g.user_id AS "userId",u.name,u.email,g.can_send AS "canSend" FROM sms_number_grants g JOIN "user" u ON u.id=g.user_id JOIN sms_numbers n ON n.id=g.number_id AND n.workspace_id=g.workspace_id WHERE g.workspace_id=$1 AND n.account_sid=$2 AND n.phone=$3 ORDER BY u.name`,
    [context.workspace.id, full.accountSid, full.phoneNumber],
  );
  return {
    ...blank,
    members: members.rows,
    numbers: numbers.rows.map((n) => ({
      ...n,
      label: "Business SMS",
      canSend: config.enabled && n.status === "active",
      grants: grants.rows
        .filter((g) => g.numberId === n.id)
        .map((g) => ({
          userId: g.userId,
          name: g.name,
          email: g.email,
          canSend: g.canSend,
        })),
    })),
  };
}
