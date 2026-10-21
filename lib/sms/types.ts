import type {
  InboxConnection,
  InboxLinks,
  InboxMember,
  InboxNote,
} from "@/lib/inbox/types";

export type SmsNumber = {
  id: string;
  phone: string;
  label: string;
  status: "active" | "paused";
  canSend: boolean;
};
export type SmsGrant = {
  userId: string;
  name: string;
  email: string;
  canSend: boolean;
};
export type SmsConversation = {
  id: string;
  numberId: string;
  phone: string;
  preview: string;
  lastMessageId: string | null;
  lastMessageAt: string;
  isRead: boolean;
  status: "open" | "waiting" | "done";
  ownerId: string | null;
  ownerName: string | null;
  businessId: string | null;
  leadId: string | null;
  blocked: boolean;
  permissionState: "unknown" | "allowed" | "blocked";
};
export type SmsMessage = {
  id: string;
  direction: "inbound" | "outbound";
  text: string;
  status: string;
  errorCode: string | null;
  createdAt: string;
  mediaCount: number;
  providerId: string | null;
};
export type SmsDraft = { id: string; to: string; text: string };
export type SmsRecord = {
  conversation: SmsConversation;
  messages: SmsMessage[];
  notes: InboxNote[];
  draft: SmsDraft | null;
};
export type SmsFilters = {
  number?: string | string[];
  thread?: string | string[];
  q?: string | string[];
  view?: string | string[];
  page?: string | string[];
  unread?: string | string[];
  compose?: string | string[];
};
export type SmsWorkspace = {
  connection: InboxConnection;
  numbers: SmsNumber[];
  number: SmsNumber | null;
  items: SmsConversation[];
  total: number;
  page: number;
  pages: number;
  q: string;
  view: "all" | "open" | "waiting" | "done";
  unreadOnly: boolean;
  selected: SmsRecord | null;
  composeDraft: SmsDraft | null;
  members: InboxMember[];
  links: InboxLinks;
};
export type SmsSettings = {
  connection: InboxConnection;
  configuredPhone: string | null;
  canManage: boolean;
  numbers: (SmsNumber & { grants: SmsGrant[] })[];
  members: InboxMember[];
  incomingUrl: string;
  statusUrl: string;
};
export type SmsActionState = {
  status: "idle" | "success" | "error";
  message: string;
  requestId?: string;
  sendState?: "pending" | "accepted" | "unknown" | "rejected";
  conversationId?: string;
};
