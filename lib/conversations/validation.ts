import { z } from "zod";
const id = z.string().uuid();
const optionalId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  id.optional(),
);
export const workSchema = z.object({
  conversationId: id,
  ownerId: z.string().max(200).optional(),
  status: z.enum(["needs_reply", "waiting", "done", "archived"]),
  remindAt: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().datetime({ offset: true }).optional(),
  ),
});
export const readSchema = z.object({ conversationId: id });
export const noteSchema = readSchema.extend({
  audienceSourceId: id,
  body: z.string().trim().min(1).max(20000),
});
export const contextSchema = readSchema.extend({
  contactId: optionalId,
  leadId: optionalId,
  businessId: optionalId,
});
export const mergeSchema = readSchema.extend({
  targetConversationId: id,
  confirmConflict: z.preprocess(
    (v) => v === true || v === "on" || v === "true",
    z.boolean(),
  ),
});
export const sourceSchema = readSchema.extend({
  sourceId: id,
  confirmConflict: z.preprocess(
    (v) => v === true || v === "on" || v === "true",
    z.boolean(),
  ),
});
export const historySchema = z.object({
  sourceId: id,
  before: z.string().max(4000).optional(),
});
export const formValues = (form: FormData) =>
  Object.fromEntries(
    [...form.entries()].filter(([, v]) => typeof v === "string"),
  );
