import { timingSafeEqual } from "node:crypto";
import { syncAllSearchConsoleConnections } from "@/lib/search-console/sync";
import { runReportingMaintenance } from "@/lib/reporting/maintenance";
import { getDatabasePool } from "@/lib/dashboard/db";
import { privateJson } from "@/lib/reporting/http";
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
    const outcomes = await syncAllSearchConsoleConnections();
    const due = await getDatabasePool()
      .query(`SELECT 1 FROM integration_sync_runs WHERE
      status IN ('queued','retry_wait','running') AND next_attempt_at <= now()
      AND (lease_expires_at IS NULL OR lease_expires_at < now()) LIMIT 1`);
    return privateJson({
      ok: true,
      more: Boolean(due.rowCount),
      checked: outcomes.length,
      failed: outcomes.filter((outcome) => outcome.status === "failed").length,
    });
  } catch {
    console.error("reporting_worker_failed");
    return privateJson({ ok: false, error: "worker_unavailable" }, 503);
  }
}
