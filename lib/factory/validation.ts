import { z } from "zod";
const uuid = z.string().uuid("Choose an existing lead or website plan.");
const referenceUrl = z.string().trim().url("Use a complete public http or https reference URL.").max(2000).refine((value) => {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && host.includes(".") && !host.endsWith(".local") && !host.endsWith(".localhost") && !host.endsWith(".internal") && !/^\d+\.\d+\.\d+\.\d+$/.test(host) && !host.includes(":");
}, "Use a public website reference without credentials or an internal address.");
export const startFactorySchema = z.object({ leadId: uuid });
export const messageFactorySchema = z.object({ projectId: uuid, requestId: uuid, body: z.string().trim().min(1,"Add a detail or direction for the website plan.").max(8000), referenceUrls: z.array(referenceUrl).max(8).default([]) });
export const approvalFactorySchema = z.object({ projectId: uuid, planId: uuid });
export const retryFactorySchema = z.object({ projectId: uuid, jobId: uuid, requestId: uuid });
export const settingsFactorySchema = z.object({ researchEnabled: z.boolean(), autoResearch: z.boolean(), monthlyBudgetDollars: z.coerce.number().finite().min(1).max(1000).refine(v => Math.abs(Math.round(v * 100)-v * 100)<1e-8,"Use a dollar amount with at most two decimal places.") });
