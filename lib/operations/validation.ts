import { z } from "zod";

const identifier = z.string().uuid("The selected record is invalid.");
const optionalIdentifier = z.preprocess(
  (value) => value === "" ? undefined : value,
  identifier.optional(),
);
const optionalText = (maximum: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(maximum).optional(),
);
const optionalEmail = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().toLowerCase().email().max(254).optional(),
);
const optionalUrl = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().url().max(2_000).optional(),
);
const optionalDate = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.").optional(),
);

export const leadStatuses = ["new", "qualified", "proposal", "won", "lost", "archived"] as const;
export const clientStatuses = ["prospect", "active", "inactive", "archived"] as const;
export const siteStatuses = ["active", "paused", "archived"] as const;
export const projectStatuses = ["planned", "active", "on_hold", "completed", "cancelled", "archived"] as const;
export const milestoneStatuses = ["pending", "in_progress", "blocked", "completed"] as const;
export const recordKinds = ["deliverable", "decision", "note"] as const;

export const updateLeadSchema = z.object({
  leadId: identifier,
  status: z.enum(leadStatuses),
  ownerUserId: optionalText(200),
  nextAction: optionalText(300),
  nextActionAt: optionalDate,
  outcomeSummary: optionalText(1_000),
});

export const leadNoteSchema = z.object({
  leadId: identifier,
  body: z.string().trim().min(2, "Write at least two characters.").max(4_000),
});

export const convertLeadSchema = z.object({
  leadId: identifier,
  clientName: z.string().trim().min(2).max(160),
  projectName: z.string().trim().min(2).max(180),
  projectSummary: optionalText(2_000),
  createSite: z.preprocess((value) => value === "on" || value === true, z.boolean()),
});

export const clientSchema = z.object({
  clientId: optionalIdentifier,
  name: z.string().trim().min(2, "Enter a client name.").max(160),
  status: z.enum(clientStatuses).default("active"),
  notes: optionalText(4_000),
});

export const contactSchema = z.object({
  contactId: optionalIdentifier,
  clientId: identifier,
  name: z.string().trim().min(2, "Enter a contact name.").max(140),
  email: optionalEmail,
  phone: optionalText(40),
  title: optionalText(120),
  isPrimary: z.preprocess((value) => value === "on" || value === true, z.boolean()),
});

export const siteSchema = z.object({
  siteId: optionalIdentifier,
  clientId: optionalIdentifier,
  name: z.string().trim().min(2, "Enter a site name.").max(160),
  url: z.string().trim().url("Enter a complete URL, including https://").max(2_000),
  environment: z.enum(["production", "staging", "development"]).default("production"),
  status: z.enum(siteStatuses).default("active"),
  notes: optionalText(4_000),
});

export const projectSchema = z.object({
  projectId: optionalIdentifier,
  clientId: identifier,
  siteId: optionalIdentifier,
  ownerUserId: optionalText(200),
  name: z.string().trim().min(2, "Enter a project name.").max(180),
  status: z.enum(projectStatuses).default("planned"),
  summary: optionalText(4_000),
  startedAt: optionalDate,
  dueAt: optionalDate,
});

export const milestoneSchema = z.object({
  projectId: identifier,
  title: z.string().trim().min(2, "Enter a milestone title.").max(220),
  status: z.enum(milestoneStatuses).default("pending"),
  dueAt: optionalDate,
});

export const milestoneStatusSchema = z.object({
  projectId: identifier,
  milestoneId: identifier,
  status: z.enum(milestoneStatuses),
});

export const projectRecordSchema = z.object({
  projectId: identifier,
  kind: z.enum(recordKinds),
  title: z.string().trim().min(2, "Enter a title.").max(220),
  body: optionalText(8_000),
});

export const publicInquiryStorageSchema = z.object({
  submissionId: z.string().regex(/^[a-zA-Z0-9_-]{12,80}$/),
  fingerprint: z.string().length(64),
  inquiryType: z.enum(["project", "website-review"]),
  name: z.string().min(2).max(100),
  organization: z.string().min(2).max(140),
  email: z.string().email().max(254),
  phone: optionalText(30),
  interest: optionalText(160),
  websiteUrl: optionalUrl,
  description: optionalText(3_000),
});

export type OperationActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialOperationActionState: OperationActionState = {
  status: "idle",
  message: "",
};

export function formValues(formData: FormData, keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, formData.get(key) ?? undefined]));
}

export function asDatabaseDate(value: string | undefined) {
  return value ? `${value}T12:00:00.000Z` : null;
}

export function validationState(error: z.ZodError): OperationActionState {
  return {
    status: "error",
    message: "Review the highlighted information and try again.",
    fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
  };
}
