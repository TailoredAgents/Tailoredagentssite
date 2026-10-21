import { z } from "zod";

export type InboxActionState = {
  status: "idle" | "success" | "error";
  message: string;
  requestId?: string;
  sendState?: "pending" | "accepted" | "unknown" | "rejected";
  threadId?: string;
};

const providerId = z.string().trim().min(1).max(200);
const optionalProviderId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  providerId.optional(),
);
const optionalId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().uuid().optional(),
);
export const threadSchema = z.object({
  mailboxId: providerId,
  threadId: providerId,
});
export const conversationSchema = threadSchema.extend({
  status: z.enum(["open", "waiting", "done"]),
  ownerId: z.string().trim().max(200).optional(),
  businessId: optionalId,
  leadId: optionalId,
});
export const draftSchema = z.object({
  mailboxId: providerId,
  threadId: optionalProviderId,
  text: z.string().max(50000).default(""),
  to: z.string().trim().max(254).default(""),
  subject: z.string().trim().max(500).default(""),
  replyToMessageId: optionalProviderId,
});
export const noteSchema = threadSchema.extend({
  body: z.string().trim().min(1, "Enter a note.").max(20000),
});
export const sendSchema = draftSchema.extend({
  requestId: z.string().uuid("Refresh the composer before sending."),
  text: z
    .string()
    .trim()
    .min(1, "Write a message before sending.")
    .max(12000, "Keep this message to 12,000 characters or fewer."),
});
export function inboxFormValues(form: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...form.entries()].filter(([, value]) => typeof value === "string"),
  );
}
