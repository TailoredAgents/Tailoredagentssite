import "server-only";
import { getDatabasePool } from "@/lib/dashboard/db";
import type { AnalyticsEventInput } from "./validation";

const INTERNAL_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
const PRODUCTION_SITE_ID = "00000000-0000-4000-8000-000000000002";
const ANALYTICS_RATE_WINDOW_MINUTES = 10;
const ANALYTICS_RATE_LIMIT = 180;

export async function consumeAnalyticsRateLimit(keyHash: string) {
  const result = await getDatabasePool().query<{ count: number }>(
    `INSERT INTO request_rate_limits
      (scope, key_hash, count, window_started_at, expires_at)
     VALUES ('public-analytics', $1, 1, now(), now() + make_interval(mins => $2))
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
         WHEN request_rate_limits.expires_at <= now() THEN now() + make_interval(mins => $2)
         ELSE request_rate_limits.expires_at
       END
     RETURNING count`,
    [keyHash, ANALYTICS_RATE_WINDOW_MINUTES],
  );

  return Number(result.rows[0]?.count ?? ANALYTICS_RATE_LIMIT + 1) > ANALYTICS_RATE_LIMIT;
}

export async function storeAnalyticsEvent(event: AnalyticsEventInput) {
  const result = await getDatabasePool().query(
    `INSERT INTO analytics_events
      (id, workspace_id, site_id, session_id, event_name, path, landing_path,
       target, target_path, form_type, referrer_host, utm_source, utm_medium,
       utm_campaign, utm_content, utm_term)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT (id) DO NOTHING`,
    [
      event.id,
      INTERNAL_WORKSPACE_ID,
      PRODUCTION_SITE_ID,
      event.sessionId,
      event.eventName,
      event.path,
      event.landingPath,
      event.target ?? null,
      event.targetPath ?? null,
      event.formType ?? null,
      event.referrerHost ?? null,
      event.utmSource ?? null,
      event.utmMedium ?? null,
      event.utmCampaign ?? null,
      event.utmContent ?? null,
      event.utmTerm ?? null,
    ],
  );

  return { stored: (result.rowCount ?? 0) > 0 };
}
