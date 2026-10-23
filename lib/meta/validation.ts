import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { normalizePhone } from "@/lib/sales/import";

const id = z.string().regex(/^\d{5,30}$/);
export const webhookSchema = z.object({
  object: z.literal("page"),
  entry: z
    .array(
      z.object({
        id,
        changes: z
          .array(z.object({ field: z.string(), value: z.unknown() }))
          .max(100),
      }),
    )
    .max(100),
});
export const leadEventSchema = z.object({
  leadgen_id: id,
  page_id: id.optional(),
  form_id: id,
  ad_id: id.optional(),
});
export const providerLeadSchema = z.object({
  id,
  form_id: id,
  created_time: z
    .string()
    .refine((value) => Number.isFinite(Date.parse(value))),
  field_data: z
    .array(
      z.object({
        name: z.string().max(200),
        values: z.array(z.string().max(4000)).max(30),
      }),
    )
    .max(100),
  ad_id: id.optional(),
  ad_name: z.string().max(500).optional(),
  adset_id: id.optional(),
  adset_name: z.string().max(500).optional(),
  campaign_id: id.optional(),
  campaign_name: z.string().max(500).optional(),
  platform: z.string().max(40).optional(),
  is_organic: z.boolean().optional(),
});

export function signedMetaBody(
  body: Buffer,
  signature: string | null,
  secret: string,
) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature))
    return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}

export async function boundedBody(
  body: ReadableStream<Uint8Array> | null,
  limit = 128_000,
) {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new Error("body_too_large");
      }
      parts.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts);
}

export function mapMetaLead(raw: unknown) {
  const lead = providerLeadSchema.parse(raw);
  const fields = new Map(
    lead.field_data.map((field) => [
      field.name.toLowerCase(),
      field.values.join(", ").trim(),
    ]),
  );
  const name =
    fields.get("full_name") ||
    [fields.get("first_name"), fields.get("last_name")]
      .filter(Boolean)
      .join(" ") ||
    "Facebook / Instagram lead";
  const rawEmail = fields.get("email")?.toLowerCase();
  const email =
    rawEmail && z.string().email().max(254).safeParse(rawEmail).success
      ? rawEmail
      : null;
  const phone = fields.get("phone_number") || fields.get("phone") || null;
  return {
    name: name.slice(0, 200),
    organization: (
      fields.get("company_name") ||
      fields.get("business_name") ||
      name
    ).slice(0, 200),
    email,
    phone: phone ? normalizePhone(phone) : null,
    description: lead.field_data
      .map(
        (field) =>
          `${field.name.replaceAll("_", " ")}: ${field.values.join(", ")}`,
      )
      .join("\n"),
    context: {
      leadId: lead.id,
      formId: lead.form_id,
      submittedAt: lead.created_time,
      adId: lead.ad_id,
      adName: lead.ad_name,
      adSetId: lead.adset_id,
      adSetName: lead.adset_name,
      campaignId: lead.campaign_id,
      campaignName: lead.campaign_name,
      platform: lead.platform,
      organic: lead.is_organic,
    },
  };
}
