import "server-only";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { authorizeInbox } from "@/lib/inbox/data";
import { listMailboxes, MailProviderError } from "@/lib/inbox/mail-provider";
import { getTwilioConfiguration } from "@/lib/twilio/config";
import type { InboxMailbox } from "@/lib/inbox/types";
import type { SmsNumber } from "@/lib/sms/types";
import { getSmsSendUnavailableReason } from "@/lib/sms/data";
import type { ConversationWorkspace } from "./types";
import { getVoiceWorkspace } from "@/lib/voice/data";
import type { VoiceLine } from "@/lib/voice/types";
import { emailRelationshipSql } from "./email-scope";
export class ConversationAccessError extends Error {}
export type SourceRow = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  channel: "email" | "sms" | "call";
  mailbox_id: string | null;
  thread_id: string | null;
  sms_conversation_id: string | null;
  number_id: string | null;
  voice_conversation_id: string | null;
  line_id: string | null;
  external_addresses: string[];
  latest_message_id: string | null;
  last_activity_at: Date;
  last_inbound_at: Date | null;
  last_outbound_at: Date | null;
  visible: boolean;
  email_in_crm: boolean;
};
export type Scopes = {
  role: string;
  mailboxes: InboxMailbox[];
  numbers: SmsNumber[];
  lines: VoiceLine[];
  sync: ConversationWorkspace["sync"];
};
export const sourceSelect = `SELECT s.*,sc.number_id,vc.line_id,
  (s.channel<>'email' OR ${emailRelationshipSql("s.workspace_id", "s.external_addresses", {contactId:"relationship.contact_id",leadId:"relationship.lead_id",businessId:"relationship.business_id"})}) AS email_in_crm
  FROM crm_conversation_sources s
  JOIN crm_conversations relationship ON relationship.id=s.conversation_id AND relationship.workspace_id=s.workspace_id
  LEFT JOIN sms_conversations sc ON sc.id=s.sms_conversation_id AND sc.workspace_id=s.workspace_id
  LEFT JOIN voice_conversations vc ON vc.id=s.voice_conversation_id AND vc.workspace_id=s.workspace_id`;
export async function scopes(context: DashboardContext): Promise<Scopes> {
  const role = await authorizeInbox(context);
  let mailboxes: InboxMailbox[] = [];
  const sync: Scopes["sync"] = [];
  try {
    mailboxes = await listMailboxes(context);
    if (!mailboxes.length)
      sync.push({
        channel: "email",
        state: "grant_required",
        message: "No approved Mail address is available to this account.",
      });
  } catch (error) {
    sync.push({
      channel: "email",
      state: error instanceof MailProviderError ? error.state : "unavailable",
      message:
        error instanceof MailProviderError
          ? error.message
          : "Mail could not be checked. Its history is hidden until access can be verified.",
    });
  }
  const config = getTwilioConfiguration();
  let numbers: SmsNumber[] = [];
  if (config.ready) {
    numbers = (
      await getDatabasePool().query<{
        id: string;
        phone: string;
        status: "active" | "paused";
        can_send: boolean;
      }>(
        `SELECT n.id,n.phone,n.status,g.can_send FROM sms_numbers n JOIN sms_number_grants g ON g.workspace_id=n.workspace_id AND g.number_id=n.id WHERE n.workspace_id=$1 AND g.user_id=$2 AND n.account_sid=$3 AND n.phone=$4`,
        [
          context.workspace.id,
          context.user.id,
          config.accountSid,
          config.phoneNumber,
        ],
      )
    ).rows.map((n) => ({
      id: n.id,
      phone: n.phone,
      label: "Business SMS",
      status: n.status,
      sendUnavailableReason: getSmsSendUnavailableReason(role, config.enabled, n.status, n.can_send),
      canSend:
        n.can_send &&
        role !== "viewer" &&
        config.enabled &&
        n.status === "active",
    }));
    sync.push({
      channel: "sms",
      state: numbers.length ? "ready" : "grant_required",
      message: numbers.length
        ? "SMS history is current."
        : "No business number is approved for your account.",
    });
  } else
    sync.push({
      channel: "sms",
      state: "setup",
      message:
        "SMS setup is incomplete. Existing Mail conversations remain available.",
    });
  const voice = await getVoiceWorkspace(context);
  sync.push({ channel: "call", state: voice.state, message: voice.message });
  return { role, mailboxes, numbers, lines: voice.lines, sync };
}
export function permitted(source: SourceRow, scope: Scopes) {
  return (
    source.visible &&
    (source.channel === "email"
      ? source.email_in_crm && scope.mailboxes.some((m) => m.id === source.mailbox_id)
      : source.channel === "sms"
        ? scope.numbers.some((n) => n.id === source.number_id)
        : scope.lines.some((n) => n.id === source.line_id))
  );
}
export async function authorizedSources(
  context: DashboardContext,
  scope: Scopes,
  conversationId?: string,
) {
  const found = await getDatabasePool().query<SourceRow>(
    `${sourceSelect} WHERE s.workspace_id=$1 ${conversationId ? "AND s.conversation_id=$2" : ""}`,
    [context.workspace.id, ...(conversationId ? [conversationId] : [])],
  );
  return found.rows.filter((s) => permitted(s, scope));
}
export async function requireSource(
  context: DashboardContext,
  sourceId: string,
  scope?: Scopes,
) {
  const current = scope ?? (await scopes(context));
  const row = (
    await getDatabasePool().query<SourceRow>(
      `${sourceSelect} WHERE s.workspace_id=$1 AND s.id=$2`,
      [context.workspace.id, sourceId],
    )
  ).rows[0];
  if (!row || !permitted(row, current))
    throw new ConversationAccessError(
      "This conversation source is not available to your account.",
    );
  return row;
}
