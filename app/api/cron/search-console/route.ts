import { runLeadIntroductionStep } from "@/lib/lead-intro/worker";
import { runIncomingSmsAlertWorker } from "@/lib/sms/alerts";
import { runLeadAlertWorker } from "@/lib/meta/lead-alerts";
import { timingSafeEqual } from "node:crypto";
import { syncAllSearchConsoleConnections } from "@/lib/search-console/sync";
import { runReportingMaintenance } from "@/lib/reporting/maintenance";
import { getDatabasePool } from "@/lib/dashboard/db";
import { privateJson } from "@/lib/reporting/http";
import { runVoiceMaintenance } from "@/lib/voice/maintenance";
import { runCallRecordingWorker } from "@/lib/voice/recording-worker";
import { runMetaLeadWorker } from "@/lib/meta/service";
import { runMetaConversionWorker } from "@/lib/meta/conversions";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(request: Request) {
  const expected = Buffer.from(
    process.env.SEARCH_CONSOLE_SYNC_SECRET?.trim() ?? "",
  );
  const supplied = Buffer.from(
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "",
  );
  if (
    expected.length < 32 ||
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return privateJson({ ok: false }, 401);
  try {
    await runReportingMaintenance();
    // A single leased recording deletion keeps this shared worker bounded.
    // Voice outages must not prevent the reporting queue from advancing.
    let voice = { checked: 0, failed: 0 };
    try {
      voice = await runVoiceMaintenance();
    } catch {
      voice = { checked: 0, failed: 1 };
      console.error("voice_retention_worker_failed");
    }
    const [outcomes,callRecordings,metaLeads,metaConversions] = await Promise.all([
      syncAllSearchConsoleConnections(),
      runCallRecordingWorker().catch(()=>{console.error("call_recording_worker_failed");return {checked:0,failed:1,more:false};}),
      runMetaLeadWorker().catch(()=>{console.error("meta_lead_worker_failed");return {checked:0,failed:1,more:false};}),
      runMetaConversionWorker().catch(()=>{console.error("meta_conversion_worker_failed");return {checked:0,failed:1,more:false};}),
    ]);
    const textAlerts = await runIncomingSmsAlertWorker().catch(() => ({ checked: 0, failed: 1, more: false }));
    const leadAlerts = await runLeadAlertWorker().catch(() => ({ checked: 0, failed: 1, more: false }));
    const introductions = await runLeadIntroductionStep().catch(() => ({ checked: 0, failed: 1, more: false }));
    const due = await getDatabasePool()
      .query(`SELECT 1 FROM integration_sync_runs WHERE
      status IN ('queued','retry_wait','running') AND next_attempt_at <= now()
      AND (lease_expires_at IS NULL OR lease_expires_at < now()) LIMIT 1`);
    return privateJson({
      ok: true,
      more: introductions.more || Boolean(due.rowCount) || callRecordings.more || metaLeads.more || metaConversions.more || leadAlerts.more || textAlerts.more,
      checked: outcomes.length,
      failed: outcomes.filter((outcome) => outcome.status === "failed").length,
      voice,
      callRecordings,
      metaLeads,
      metaConversions,
      leadAlerts,
      textAlerts,
      introductions,
    });
  } catch {
    console.error("reporting_worker_failed");
    return privateJson({ ok: false, error: "worker_unavailable" }, 503);
  }
}
