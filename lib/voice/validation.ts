import { z } from "zod";
import { normalizePhone } from "@/lib/sales/import";
export const phoneSchema = z
  .string()
  .trim()
  .max(40)
  .refine(
    (v) => !/(?:ext\.?|extension|[x#;,])/i.test(v),
    "Enter a direct phone number without an extension.",
  )
  .transform(normalizePhone)
  .pipe(
    z
      .string()
      .regex(
        /^\+[1-9]\d{7,14}$/,
        "Enter a valid 10-digit US phone number.",
      ),
  );
export const connectSchema = z.object({ phone: phoneSchema });
export const grantSchema = z
  .object({
    lineId: z.uuid(),
    userId: z.string().min(1).max(200),
    canRead: z.boolean(),
    canCall: z.boolean(),
    canReceive: z.boolean(),
    canManageVoicemail: z.boolean(),
  })
  .refine(
    (v) => v.canRead || !(v.canCall || v.canReceive || v.canManageVoicemail),
    "Read access is required for calling, receiving, or voicemail management.",
  );
export const routingSchema = z
  .object({
    lineId: z.uuid(),
    status: z.enum(["active", "paused"]),
    timezone: z
      .string()
      .max(100)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Choose a valid timezone."),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    days: z.array(z.number().int().min(0).max(6)).max(7),
    ringSeconds: z.coerce.number().int().min(10).max(30),
    greeting: z.string().trim().min(10).max(1500),
  })
  .refine((v) => v.start < v.end, "Business hours must end after they start.");
export const intentSchema = z.object({
  lineId: z.uuid(),
  to: phoneSchema,
  conversationId: z.uuid().optional(),
  requestId: z.uuid(),
});
export const callSchema = z.object({ callId: z.uuid() });
export const presenceSchema = z.object({
  lineId: z.uuid(),
  available: z.boolean(),
});
export const sidSchema = z.string().regex(/^CA[0-9a-fA-F]{32}$/);
export const recordingSchema = z.string().regex(/^RE[0-9a-fA-F]{32}$/);
export const accountSchema = z.string().regex(/^AC[0-9a-fA-F]{32}$/);
export const statusSchema = z.enum([
  "queued",
  "ringing",
  "in-progress",
  "completed",
  "busy",
  "no-answer",
  "canceled",
  "failed",
]);
