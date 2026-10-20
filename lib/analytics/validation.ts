import { z } from "zod";

export const analyticsEventNames = [
  "page_view",
  "cta_click",
  "phone_click",
  "form_start",
  "form_success",
  "booking_click",
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];

const pathSchema = z.string()
  .trim()
  .min(1)
  .max(300)
  .refine((value) => value.startsWith("/") && !value.startsWith("//"), "Path must be site-relative.")
  .refine((value) => !/[\r\n\t?#]/.test(value), "Path contains invalid characters.")
  .refine((value) => !/^\/(dashboard|sign-in|api)(\/|$)/.test(value), "Private paths are not measured.");

const optionalLabel = z.string().trim().min(1).max(120).optional();
const optionalAttribution = z.string().trim().min(1).max(100).optional();

export const analyticsEventSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  eventName: z.enum(analyticsEventNames),
  path: pathSchema,
  landingPath: pathSchema,
  target: optionalLabel,
  targetPath: pathSchema.optional(),
  formType: z.enum(["project", "website-review"]).optional(),
  referrerHost: z.string().trim().toLowerCase().max(253)
    .regex(/^[a-z0-9.-]+$/)
    .optional(),
  utmSource: optionalAttribution,
  utmMedium: optionalAttribution,
  utmCampaign: optionalAttribution,
  utmContent: optionalAttribution,
  utmTerm: optionalAttribution,
}).strict();

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;

export const analyticsRanges = ["7d", "30d", "90d"] as const;
export type AnalyticsRange = (typeof analyticsRanges)[number];

export function parseAnalyticsRange(value: string | string[] | undefined): AnalyticsRange {
  const requested = Array.isArray(value) ? value[0] : value;
  return analyticsRanges.includes(requested as AnalyticsRange)
    ? requested as AnalyticsRange
    : "30d";
}

export function analyticsRangeDays(range: AnalyticsRange) {
  return Number(range.slice(0, -1));
}
