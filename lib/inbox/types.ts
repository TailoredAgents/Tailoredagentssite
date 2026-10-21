export type InboxMailbox = { id: string; name: string; email: string; canSend: boolean; addresses: { id: string; address: string }[] };
export type InboxConnection = { state: "ready" | "setup" | "grant_required" | "unavailable"; message: string };
export type InboxMember = { id: string; name: string; email: string };
export type MailThread = {
  id: string; latestMessageId: string; subject: string; preview: string;
  participants: string[]; messageCount: number; isRead: boolean;
  hasAttachments: boolean; deliveryStatus: string | null; updatedAt: string;
};
export type InboxConversation = MailThread & {
  mailboxId: string; status: "open" | "waiting" | "done";
  ownerId: string | null; ownerName: string | null;
  businessId: string | null; leadId: string | null;
};
export type InboxMessage = {
  id: string; direction: "inbound" | "outbound"; from: string; fromName: string | null;
  to: string; cc: string | null; subject: string; text: string;
  deliveryStatus: string | null; deliveryDetail: string | null; createdAt: string;
  replyTargets: string[];
  attachments: { id: string; filename: string; contentType: string; size: number }[];
};
export type MailThreadRecord = { threadId: string; subject: string; messages: InboxMessage[] };
export type InboxNote = { id: string; authorName: string; body: string; createdAt: string };
export type InboxDraft = { id: string; text: string; to: string; subject: string; replyToMessageId: string | null };
export type InboxRecord = {
  conversation: InboxConversation; messages: InboxMessage[]; notes: InboxNote[];
  draft: InboxDraft | null;
};
export type InboxLinks = { businesses: { id: string; name: string; clientId: string | null }[]; leads: { id: string; name: string }[] };
export type InboxWorkspace = {
  connection: InboxConnection; mailboxes: InboxMailbox[]; mailbox: InboxMailbox | null;
  items: InboxConversation[]; total: number; page: number; pages: number;
  q: string; view: "inbox" | "sent" | "archive"; unreadOnly: boolean;
  selected: InboxRecord | null; members: InboxMember[]; links: InboxLinks;
  composeDraft?: InboxDraft | null;
};
export type InboxFilters = { mailbox?: string | string[]; thread?: string | string[]; view?: string | string[]; q?: string | string[]; page?: string | string[]; unread?: string | string[]; compose?: string | string[] };
export type MailSendInput = { mailboxId: string; fromAddressId: string; threadId?: string; replyToMessageId?: string; to?: string; subject?: string; text: string; idempotencyKey: string };
export type MailSendResult = { messageId: string; threadId: string; providerId?: string; status: "accepted" | "pending" };
