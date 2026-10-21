import { z } from "zod";
import {
  salesStages,
  offerTypes,
  websiteStatuses,
  mockupStatuses,
} from "./types";

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? undefined : v),
    z.string().trim().max(max).optional(),
  );
const id = z.string().uuid();
const optionalId = z.preprocess(
  (v) => (v === "" ? undefined : v),
  id.optional(),
);
const email = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().trim().toLowerCase().email().max(254).optional(),
);
const url = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z
    .string()
    .trim()
    .url()
    .max(2000)
    .refine(
      (v) => /^https?:\/\//i.test(v),
      "Use an http or https website address.",
    )
    .optional(),
);
const money = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : Number(v)),
  z
    .number()
    .finite()
    .min(0)
    .max(10000000)
    .refine(
      (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001,
      "Use dollars with no more than two decimal places.",
    )
    .optional(),
);
const score = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : Number(v)),
  z.number().finite().min(0).max(100).optional(),
);
const dateTime = z
  .string()
  .datetime({ offset: true })
  .refine((v) => Number.isFinite(Date.parse(v)), "Use a valid date and time.");
const optionalDateTime = z.preprocess(
  (v) => (v === "" ? undefined : v),
  dateTime.optional(),
);
const businessFields = {
  businessName: z.string().trim().min(2).max(200),
  contactName: optionalText(140),
  email,
  phone: optionalText(80),
  websiteUrl: url,
  industry: optionalText(200),
  state: optionalText(100),
  websiteStatus: z.enum(websiteStatuses).default("unknown"),
  score,
  researchUrl: url,
  notes: optionalText(20000),
};
export const createOpportunitySchema = z
  .object({
    ...businessFields,
    title: z.string().trim().min(2).max(200),
    stage: z.enum(salesStages).default("prospect"),
    ownerUserId: optionalText(200),
    value: money,
    offerType: z.enum(offerTypes).default("standard"),
  })
  .refine(
    (v) => Boolean(v.email || v.phone || v.websiteUrl),
    "Include a phone number, email, or website so the business can be identified.",
  )
  .refine(
    (v) => !["won"].includes(v.stage),
    "Use the client handoff to mark an opportunity won.",
  );
export const updateOpportunitySchema = z.object({
  ...businessFields,
  opportunityId: id,
  expectedUpdatedAt: dateTime,
  expectedBusinessUpdatedAt: dateTime,
  title: z.string().trim().min(2).max(200),
  stage: z.enum(salesStages),
  ownerUserId: optionalText(200),
  value: money,
  offerType: z.enum(offerTypes),
  contactEmail: email,
  contactPhone: optionalText(80),
});
export const activitySchema = z.object({
  opportunityId: id,
  kind: z.enum(["note", "call", "email", "sms", "outcome"]),
  direction: z.enum(["inbound", "outbound", "internal"]).default("internal"),
  outcome: optionalText(120),
  body: z.string().trim().min(2).max(10000),
  occurredAt: optionalDateTime,
});
export const taskSchema = z
  .object({
    opportunityId: id,
    taskId: optionalId,
    title: z.string().trim().min(2).max(300),
    kind: z.enum(["follow_up", "appointment"]),
    ownerUserId: optionalText(200),
    dueAt: dateTime,
    endAt: optionalDateTime,
    location: optionalText(1000),
    notes: optionalText(4000),
  })
  .refine(
    (v) => !v.endAt || Date.parse(v.endAt) > Date.parse(v.dueAt),
    "The end time must be after the start time.",
  );
export const completeTaskSchema = z.object({
  opportunityId: id,
  taskId: id,
  status: z.enum(["completed", "cancelled"]),
  outcome: z.string().trim().min(2).max(2000),
});
export const requestMockupSchema = z.object({
  opportunityId: id,
  ownerUserId: optionalText(200),
  brief: z.string().trim().min(10).max(6000),
});
export const mockupSchema = z
  .object({
    opportunityId: id,
    status: z.enum(mockupStatuses),
    ownerUserId: optionalText(200),
    brief: z.string().trim().min(10).max(6000),
    previewUrl: url,
    repositoryUrl: url,
    projectPath: optionalText(2000),
    qaNotes: optionalText(6000),
  })
  .refine(
    (v) => !["ready", "delivered"].includes(v.status) || Boolean(v.previewUrl),
    "Add the actual preview link before marking a mockup ready or delivered.",
  );
export const convertOpportunitySchema = z.object({
  opportunityId: id,
  clientName: optionalText(160),
  projectName: z.string().trim().min(2).max(180),
  projectSummary: optionalText(2000),
  createSite: z.boolean().optional(),
});
export const preferenceSchema = z.object({
  opportunityId: id,
  channel: z.enum(["email", "sms", "call"]),
  address: z.string().trim().min(3).max(254),
  status: z.enum(["unknown", "allowed", "blocked"]),
  evidence: z.string().trim().min(5).max(2000),
});
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export function salesFormValues(form: FormData) {
  return Object.fromEntries(
    [...form.entries()].filter(
      ([key, value]) => !key.startsWith("$") && typeof value === "string",
    ),
  );
}
