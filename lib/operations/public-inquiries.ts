import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getDatabasePool, insertAuditLog } from "@/lib/dashboard/db";
import { publicInquiryStorageSchema } from "./validation";
import { measurementSchema, type MeasurementContext } from "@/lib/analytics/measurement";
import { enqueueFactoryLead } from "@/lib/factory/service";

const INTERNAL_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
const CONTACT_RATE_WINDOW_MINUTES = 15;
const CONTACT_RATE_LIMIT = 5;

function requestFingerprint(value: string) {
  const pepper = process.env.BETTER_AUTH_SECRET || process.env.DATABASE_URL || "tailored-agents-public-rate-limit";
  return createHash("sha256").update(`${pepper}|${value}`).digest("hex");
}

export function publicRequestKey(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || headers.get("x-real-ip") || "unknown";
  return requestFingerprint(address);
}

export async function consumeContactRateLimit(keyHash: string) {
  const pool = getDatabasePool();
  const result = await pool.query<{ count: number }>(
    `INSERT INTO request_rate_limits
      (scope, key_hash, count, window_started_at, expires_at)
     VALUES ('public-contact', $1, 1, now(), now() + interval '${CONTACT_RATE_WINDOW_MINUTES} minutes')
     ON CONFLICT (scope, key_hash)
     DO UPDATE SET
       count = CASE
         WHEN request_rate_limits.expires_at <= now() THEN 1
         ELSE request_rate_limits.count + 1
       END,
       window_started_at = CASE
         WHEN request_rate_limits.expires_at <= now() THEN now()
         ELSE request_rate_limits.window_started_at
       END,
       expires_at = CASE
         WHEN request_rate_limits.expires_at <= now() THEN now() + interval '${CONTACT_RATE_WINDOW_MINUTES} minutes'
         ELSE request_rate_limits.expires_at
       END
     RETURNING count`,
    [keyHash],
  );
  void pool.query("DELETE FROM request_rate_limits WHERE expires_at < now() - interval '1 day'").catch(() => undefined);
  return Number(result.rows[0]?.count ?? CONTACT_RATE_LIMIT + 1) > CONTACT_RATE_LIMIT;
}

export async function storePublicInquiry(input: unknown, measurement?: MeasurementContext) {
  const parsed = publicInquiryStorageSchema.safeParse(input);
  if (!parsed.success) throw new Error("Validated inquiry could not be prepared for storage.");
  const data = parsed.data;
  const attribution = measurementSchema.safeParse(measurement);
  const client = await getDatabasePool().connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [data.submissionId]);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [data.fingerprint]);
    const duplicate = await client.query<{ id: string }>(
      `SELECT id FROM leads
       WHERE workspace_id = $1
         AND (submission_id = $2 OR (fingerprint = $3 AND created_at > now() - interval '15 minutes'))
       ORDER BY created_at DESC LIMIT 1`,
      [INTERNAL_WORKSPACE_ID, data.submissionId, data.fingerprint],
    );
    if (duplicate.rows[0]) {
      await client.query("COMMIT");
      return { leadId: duplicate.rows[0].id, duplicate: true };
    }

    const leadId = randomUUID();
    await client.query(
      `INSERT INTO leads
        (id, workspace_id, submission_id, fingerprint, inquiry_type, source, status,
         name, organization, email, phone, interest, website_url, description, delivery_status, measurement_context, measurement_status)
       VALUES ($1, $2, $3, $4, $5, 'website', 'new', $6, $7, $8, $9, $10, $11, $12, 'pending', $13::jsonb, $14)`,
      [leadId, INTERNAL_WORKSPACE_ID, data.submissionId, data.fingerprint,
        data.inquiryType, data.name, data.organization, data.email, data.phone ?? null,
        data.interest ?? null, data.websiteUrl ?? null, data.description ?? null,
        attribution.success ? JSON.stringify(attribution.data) : null, attribution.success ? "pending" : null],
    );
    await insertAuditLog(client, {
      workspaceId: INTERNAL_WORKSPACE_ID,
      action: "lead.received",
      targetType: "lead",
      targetId: leadId,
      metadata: { source: "website", inquiryType: data.inquiryType },
    });
    await enqueueFactoryLead(client, INTERNAL_WORKSPACE_ID, leadId);
    await client.query("COMMIT");
    return { leadId, duplicate: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordInquiryDelivery(
  leadId: string,
  input: { status: "sent" | "failed" | "not_configured"; errorCode?: string },
) {
  await getDatabasePool().query(
    `UPDATE leads
     SET delivery_status = $1, delivery_error_code = $2,
         delivered_at = CASE WHEN $1 = 'sent' THEN now() ELSE NULL END,
         updated_at = now()
     WHERE id = $3 AND workspace_id = $4`,
    [input.status, input.errorCode?.slice(0, 100) ?? null, leadId, INTERNAL_WORKSPACE_ID],
  );
}
