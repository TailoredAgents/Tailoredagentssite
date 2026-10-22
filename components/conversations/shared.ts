import type { ConversationFilters, ConversationStatus, ConversationSummary } from "@/lib/conversations/types";

export const queueLabels: Record<string, string> = { mine: "Mine", team: "Team", unassigned: "Unassigned", needs_reply: "Needs reply", unread: "Unread", waiting: "Waiting", done: "Done", archived: "Archived", due: "Due now", reminders: "Reminders" };
export const statusLabels: Record<ConversationStatus, string> = { needs_reply: "Needs reply", waiting: "Waiting", done: "Done", archived: "Archived" };
export const sourceChannelLabels = { email: "Email", sms: "SMS", call: "Call" };

export function conversationWorkLabel(conversation: ConversationSummary) {
  if (conversation.status === "needs_reply" && conversation.remindAt) return new Date(conversation.remindAt).getTime() <= Date.now() ? "Reminder due" : "Reminder set";
  return statusLabels[conversation.status];
}

export function conversationHref(filters: ConversationFilters = {}, overrides: Record<string, string | undefined> = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...overrides })) {
    if (key === "thread") continue;
    const next = Array.isArray(value) ? value[0] : value;
    if (next) query.set(key, next);
  }
  return `/dashboard/inbox${query.size ? `?${query}` : ""}`;
}

export function safeExternalUrl(value: string | null | undefined) {
  if (!value) return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
