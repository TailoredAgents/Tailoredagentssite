import "server-only";
import { z } from "zod";
import { boundedBody } from "./validation";
import type { metaConversionConfiguration } from "./conversion-config";

export const conversionNames = {
  new: "NewLead", qualified: "QualifiedLead", proposal: "Proposal", won: "Won", lost: "Lost", archived: "Archived",
} as const;
export type ConversionStage = keyof typeof conversionNames;
export type MetaConversion = { id: string; providerLeadId: string; stage: ConversionStage; occurredAt: Date };
const eventSchema = z.object({ id: z.string().uuid(), providerLeadId: z.string().regex(/^\d{5,30}$/),
  stage: z.enum(["new", "qualified", "proposal", "won", "lost", "archived"]), occurredAt: z.date() });

export class MetaConversionError extends Error {
  constructor(readonly code: string, readonly retryable = false) { super(code); }
}

export function conversionPayload(input: MetaConversion, testEventCode?: string) {
  const event = eventSchema.parse(input);
  const timestamp = Math.floor(event.occurredAt.getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);
  if (timestamp > now || timestamp <= now - 7 * 86400) throw new MetaConversionError("event_outside_upload_window");
  return {
    data: [{ event_name: conversionNames[event.stage], event_time: timestamp,
      event_id: `${testEventCode ? "test:" : ""}${event.id}`, action_source: "system_generated",
      user_data: { lead_id: event.providerLeadId },
      custom_data: { event_source: "crm", lead_event_source: "Tailored Agents CRM" } }],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };
}

export async function sendMetaConversion(event: MetaConversion, config: ReturnType<typeof metaConversionConfiguration>) {
  if (!config.ready) throw new MetaConversionError("not_configured");
  const payload = conversionPayload(event, config.mode === "test" ? config.testEventCode : undefined);
  try {
    const response = await fetch(`https://graph.facebook.com/${config.version}/${config.datasetId}/events`, {
      method: "POST", redirect: "error", cache: "no-store",
      headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
    });
    const body: unknown = JSON.parse((await boundedBody(response.body, 32000)).toString("utf8"));
    const result = z.object({ events_received: z.number().optional(), error: z.object({ code: z.number().int().optional(), is_transient: z.boolean().optional() }).optional() }).safeParse(body);
    if (response.ok && result.success && result.data.events_received === 1 && !result.data.error) return;
    const code = result.success ? result.data.error?.code : undefined;
    // Never retain Meta's message text: it can echo submitted identifiers or credentials.
    throw new MetaConversionError(code ? `meta_${code}` : `http_${response.status}`,
      response.status === 429 || response.status >= 500 || (result.success && result.data.error?.is_transient === true));
  } catch (error) {
    if (error instanceof MetaConversionError) throw error;
    throw new MetaConversionError("response_unconfirmed", true);
  }
}
