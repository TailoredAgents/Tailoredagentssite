import type {
  InboxMailbox,
  InboxDraft,
  InboxRecord,
  InboxMessage,
  InboxMember,
  InboxLinks,
} from "@/lib/inbox/types";
import type { SmsNumber, SmsRecord, SmsDraft } from "@/lib/sms/types";
import type { VoiceLine, VoiceCall } from "@/lib/voice/types";
export type ConversationStatus =
  "needs_reply" | "waiting" | "done" | "archived";
export type ConversationFilters = {
  text?: string | string[];
  contact?: string | string[];
  lead?: string | string[];
  conversation?: string | string[];
  thread?: string | string[];
  view?: string | string[];
  q?: string | string[];
  page?: string | string[];
  sourcePage?: string | string[];
};
export type ConversationSummary = {
  id: string;
  title: string;
  personName: string;
  businessName: string | null;
  contactId: string | null;
  leadId: string | null;
  businessId: string | null;
  ownerId: string | null;
  ownerName: string | null;
  status: ConversationStatus;
  remindAt: string | null;
  lastActivityAt: string;
  preview: string;
  unread: boolean;
  channels: ("email" | "sms" | "call")[];
  sourceCount: number;
};
export type ConversationSource = {
  id: string;
  channel: "email" | "sms" | "call";
  label: string;
  mailboxId: string | null;
  threadId: string | null;
  numberId: string | null;
  smsConversationId: string | null;
  externalAddresses: string[];
  canSend: boolean;
  mailbox: InboxMailbox | null;
  mailRecord: InboxRecord | null;
  number: SmsNumber | null;
  smsRecord: SmsRecord | null;
  line: VoiceLine | null;
  voiceConversationId: string | null;
  voiceCalls: VoiceCall[];
  hasOlder: boolean;
  before: string | null;
};
export type ConversationTimelineItem = {
  id: string;
  sourceId: string;
  channel: "email" | "sms" | "call" | "note";
  direction: "inbound" | "outbound" | null;
  text: string;
  subject: string | null;
  status: string | null;
  authorName: string | null;
  createdAt: string;
  emailMessage?: InboxMessage;
  mediaCount?: number;
  voiceCall?: VoiceCall;
};
export type ConversationContext = {
  opportunityId: string | null;
  stage: string | null;
  serviceInterest: string | null;
  clientId: string | null;
  projectId: string | null;
  nextTask: { id: string; title: string; dueAt: string; kind: string; href?: string } | null;
  mockup: { status: string; previewUrl: string | null } | null;
};
export type ConversationRecord = {
  introduction?: import("@/lib/lead-intro/data").LeadIntroduction | null;
  clientMemory?: import("./memory-types").ClientMemory[];
  recipient?: ConversationRecipient | null;
  conversation: ConversationSummary;
  sources: ConversationSource[];
  timeline: ConversationTimelineItem[];
  context: ConversationContext;
  historyPage: number;
  historyPages: number;
  historyTotal: number;
};
export type ConversationWorkspace = {
  recipientDrafts: { email: Record<string, InboxDraft>; sms: Record<string, SmsDraft> };
  recipient: ConversationRecipient | null;
  recipientConversations: ConversationSummary[];
  items: ConversationSummary[];
  selected: ConversationRecord | null;
  total: number;
  page: number;
  pages: number;
  q: string;
  view: string;
  counts: Record<string, number>;
  members: InboxMember[];
  links: InboxLinks & {
    contacts: { id: string; name: string; businessId: string | null }[];
  };
  mergeTargets: { id: string; title: string }[];
  sync: {
    channel: "email" | "sms" | "call";
    state: "ready" | "syncing" | "setup" | "grant_required" | "unavailable";
    message: string;
  }[];
  mailboxes: InboxMailbox[];
  numbers: SmsNumber[];
};
export type ConversationRecipient = {
  alternatePhones?: import("./phone-options").AlternatePhone[];
  id: string;
  kind: "contact" | "lead";
  name: string;
  email: string | null;
  phone: string | null;
  businessId: string | null;
  businessName: string | null;
};
export type ConversationActionState = {
  status: "idle" | "success" | "error";
  message: string;
  conversationId?: string;
};
