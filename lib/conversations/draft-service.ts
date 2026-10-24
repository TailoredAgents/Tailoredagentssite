import "server-only";
import { loadClientMemory, memoryEvidence, rememberSuggestions } from "./memory";
import type { DashboardContext } from "@/lib/dashboard/data";
import { getDatabasePool } from "@/lib/dashboard/db";
import { normalizePhone } from "@/lib/sales/import";
import { authorizedSources, scopes, type Scopes } from "./access";
import { listConversationWorkspace } from "./data";
import { discover } from "./discovery";
import { getConversationRecipient, recipientMatchesAddress } from "./recipients";
import { draftRequestSchema } from "./draft-validation";
import { DraftError, requireDraftConfiguration, writeSuggestedDraft } from "./draft-provider";
import { reserveDraftRequest } from "./draft-rate-limit";

export async function generateClientDraft(context: DashboardContext, raw: unknown) {
  const input = draftRequestSchema.parse(raw);
  const assertSending = (scope: Scopes) => {
    const account = input.channel === "email" ? scope.mailboxes.find(m => m.id === input.accountId) : scope.numbers.find(n => n.id === input.accountId);
    if (scope.role === "viewer" || !account?.canSend) throw new DraftError("You need send access to this email address or number to generate a draft.");
  };
  const scope = await scopes(context);
  assertSending(scope);
  requireDraftConfiguration();
  if (input.channel === "sms" ? !normalizePhone(input.to) : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) throw new DraftError("Enter a valid recipient before generating a draft.");
  let conversationId = input.conversationId;
  if (input.threadId) {
    if (!conversationId) await discover(context, scope);
    const source = (await authorizedSources(context, scope, conversationId)).find(s => input.channel === "email"
      ? s.channel === "email" && s.mailbox_id === input.accountId && s.thread_id === input.threadId
      : s.channel === "sms" && s.number_id === input.accountId && s.sms_conversation_id === input.threadId);
    if (!source) throw new DraftError("This history is no longer available. Refresh the Inbox before generating a draft.");
    conversationId = source.conversation_id;
  }
  const data = await listConversationWorkspace(context, {
    ...(conversationId ? { conversation: conversationId } : {}),
    ...(input.recipient ? { [input.recipient.kind]: input.recipient.id } : {}),
  });
  const record = data.selected, recipient = data.recipient;
  if ((conversationId && record?.conversation.id !== conversationId) || (input.recipient && !recipient)) throw new DraftError("The client or conversation is no longer available. Refresh the Inbox.");
  if (recipient && !recipientMatchesAddress(recipient, input.to)) throw new DraftError("The recipient has changed. Open their conversation to generate a matching draft.");
  const matchesAddress = (address: string) => input.channel === "email" ? address.toLowerCase() === input.to.toLowerCase() : !!normalizePhone(address) && normalizePhone(address) === normalizePhone(input.to);
  if (record && !recipient && !record.sources.some(s => s.externalAddresses.some(matchesAddress))) throw new DraftError("The recipient does not match this conversation.");
  const memory = record ? (await loadClientMemory(context, record.conversation.id)).filter(m => m.useInDrafts).slice(0,20) : [];
  const evidence = memoryEvidence(record);
  const history = (record?.timeline || []).filter(item => item.channel !== "note" && !["failed", "undelivered", "rejected"].includes(item.status || ""))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-24).map(item => ({
      channel: item.channel, direction: item.direction, date: item.createdAt, subject: item.subject?.slice(0, 200),
      text: (item.voiceCall?.recording?.summary?.summary || item.text).slice(0, 1600),
    }));
  const leadId = recipient?.kind === "lead" ? recipient.id : record?.conversation.leadId;
  const businessId = recipient?.businessId || record?.conversation.businessId;
  const facts = leadId ? (await getDatabasePool().query<{ interest: string | null; website: string | null; inquiry: string | null }>(
    "SELECT left(interest,500) AS interest,left(website_url,500) AS website,left(description,2000) AS inquiry FROM leads WHERE workspace_id=$1 AND id=$2 AND anonymized_at IS NULL",
    [context.workspace.id, leadId],
  )).rows[0] : null;
  const business = businessId ? (await getDatabasePool().query<{ website: string | null; industry: string | null }>(
    "SELECT left(website_url,500) AS website,industry FROM crm_businesses WHERE workspace_id=$1 AND id=$2 AND anonymized_at IS NULL",
    [context.workspace.id, businessId],
  )).rows[0] : null;
  const verify = async () => {
    if (record && memory.length) {
      const current = await loadClientMemory(context, record.conversation.id);
      if (memory.some(m => !current.some(c => c.id === m.id && c.revision === m.revision && c.useInDrafts))) throw new DraftError("The client brief or its access changed. Generate again using the current details.");
    }
    const fresh = await scopes(context);
    assertSending(fresh);
    if (recipient) {
      const current = await getConversationRecipient(context, recipient.kind, recipient.id);
      if (!current || !recipientMatchesAddress(current, input.to)) throw new DraftError("The client details changed. Refresh and generate again.");
    }
    if (record) {
      const allowed = await authorizedSources(context, fresh, record.conversation.id);
      if (record.sources.some(source => !allowed.some(s => s.id === source.id))) throw new DraftError("Conversation access changed. Refresh before generating another draft.");
    }
  };
  await verify();
  await reserveDraftRequest(context);
  const draft = await writeSuggestedDraft(input.channel, {
    staffDirection: input.direction || "Suggest the most useful next message.",
    currentDraft: input.currentText, subject: input.subject, senderName: context.user.name,
    client: recipient ? { name: recipient.name, businessName: recipient.businessName, business, inquiry: facts } : null,
    serviceInterest: record?.context.serviceInterest || facts?.interest || null,
    clientMemory: memory.map(m => ({ category: m.category, text: m.text, date: m.occurredAt })),
    memoryEvidence: evidence.map(e => ({ id: e.id, text: e.text, date: e.date, direction: e.direction })),
    history, historyScope: "Recent accessible messages only. Internal notes and attachments are excluded.",
  });
  // A grant revoked during the provider call must also hide derived content.
  await verify();
  let memorySaved = true;
  try { await rememberSuggestions(context, evidence, draft.memories || []); } catch { memorySaved = false; }
  await verify();
  return { draft: { subject: draft.subject, text: draft.text }, contextNote: `${recipient ? "Client details" : "Your direction"}${history.length ? ` + ${history.length} recent message${history.length === 1 ? "" : "s"}` : " · no conversation history yet"}${memory.length ? ` + ${memory.length} saved client facts` : ""}${memorySaved ? "" : " · brief update unavailable"}` };
}
