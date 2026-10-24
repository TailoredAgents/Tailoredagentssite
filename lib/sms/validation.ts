import { z } from "zod";
import { normalizePhone } from "@/lib/sales/import";
export type { SmsActionState } from "./types";
const identifier = z.string().uuid("Choose a valid record.");
const optionalId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  identifier.optional(),
);
export const phoneSchema = z
  .string()
  .trim()
  .max(50)
  .refine(
    (value) => !/(?:ext(?:ension)?\.?|[x#])\s*\d+\s*$/i.test(value),
    "Text a mobile number without an extension.",
  )
  .transform((value) => normalizePhone(value))
  .refine(
    (value): value is string => !!value,
    "Enter a valid 10-digit US phone number.",
  );
export const threadSchema = z.object({
  numberId: identifier,
  conversationId: identifier,
});
export const connectSchema = z.object({ phone: phoneSchema });
const bool = z.preprocess(
  (value) =>
    value === true || value === "true" || value === "on" || value === "1",
  z.boolean(),
);
export const grantSchema = z.object({
  numberId: identifier,
  userId: z.string().trim().min(1).max(200),
  canRead: bool,
  canSend: bool,
});
export const numberSchema = z.object({
  numberId: identifier,
  status: z.enum(["active", "paused"]),
});
export const conversationSchema = threadSchema.extend({
  status: z.enum(["open", "waiting", "done"]),
  ownerId: z.string().trim().max(200).optional(),
  businessId: optionalId,
  leadId: optionalId,
});
export const draftSchema = z.object({
  composeKey: z.string().regex(/^(contact|lead):[0-9a-f-]{36}$/i).optional(),
  numberId: identifier,
  conversationId: optionalId,
  to: z.string().trim().max(50).default(""),
  text: z.string().max(1600).default(""),
});
export const sendSchema = draftSchema.extend({
  requestId: identifier,
  text: z
    .string()
    .max(1600, "Keep this text to 1,600 characters or fewer.")
    .refine((value) => !!value.trim(), "Write a text message first."),
});
export const checkSchema = z.object({
  numberId: identifier,
  requestId: identifier,
});
export const noteSchema = threadSchema.extend({
  body: z.string().trim().min(1, "Enter a note.").max(20000),
});
export function smsFormValues(form: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...form.entries()].filter(([, value]) => typeof value === "string"),
  );
}
