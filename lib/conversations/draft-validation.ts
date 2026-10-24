import { z } from "zod";

export const draftRequestSchema = z.object({
  channel: z.enum(["email", "sms"]),
  accountId: z.string().trim().min(1).max(200),
  to: z.string().trim().min(1, "Choose a recipient first.").max(254),
  threadId: z.string().max(200).optional(),
  conversationId: z.string().uuid().optional(),
  recipient: z.object({ kind: z.enum(["contact", "lead"]), id: z.string().uuid() }).strict().optional(),
  direction: z.string().trim().max(1000).default(""),
  currentText: z.string().max(12000).default(""),
  subject: z.string().max(500).default(""),
}).strict();
export type DraftRequest = z.input<typeof draftRequestSchema>;
export const suggestedDraftSchema = z.object({
  subject: z.string().trim().max(200),
  text: z.string().trim().min(1).max(6000),
}).strict();
export type SuggestedDraft = z.infer<typeof suggestedDraftSchema>;
export type DraftResult = { draft: SuggestedDraft; contextNote: string } | { error: string };
