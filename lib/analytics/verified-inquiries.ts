import "server-only";
import { getDatabasePool } from "@/lib/dashboard/db";

// A stored inquiry is authoritative. Attribution is recoverable, optional work.
export async function recordPendingInquiryMeasurements(leadId?: string) {
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const pending = await client.query<{ id: string }>(
      `SELECT id FROM leads WHERE measurement_status = 'pending' AND anonymized_at IS NULL
       AND ($1::uuid IS NULL OR id = $1) ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED`,
      [leadId ?? null],
    );
    if (pending.rows.length) {
      const ids = pending.rows.map((row) => row.id);
      await client.query(
        `INSERT INTO analytics_events
         (id, workspace_id, site_id, session_id, event_name, path, landing_path, form_type,
          referrer_host, utm_source, utm_medium, utm_campaign, utm_content, utm_term, occurred_at, verification)
         SELECT id, workspace_id, '00000000-0000-4000-8000-000000000002'::uuid,
          (measurement_context->>'sessionId')::uuid, 'form_success', measurement_context->>'path',
          measurement_context->>'landingPath', inquiry_type, measurement_context->>'referrerHost',
          measurement_context->>'utmSource', measurement_context->>'utmMedium', measurement_context->>'utmCampaign',
          measurement_context->>'utmContent', measurement_context->>'utmTerm', created_at, 'server'
         FROM leads WHERE id = ANY($1::uuid[]) ON CONFLICT (id) DO NOTHING`,
        [ids],
      );
      await client.query(
        `UPDATE leads SET measurement_status = 'recorded', measurement_recorded_at = now(),
        measurement_context = NULL WHERE id = ANY($1::uuid[])`,
        [ids],
      );
    }
    await client.query("COMMIT");
    return pending.rows.length;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
