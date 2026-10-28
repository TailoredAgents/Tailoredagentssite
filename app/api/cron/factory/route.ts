import { timingSafeEqual } from "node:crypto";
import { runFactoryWorkerStep } from "@/lib/factory/worker";
import { syncFactoryWorkNotices } from "@/lib/factory/work-notices";
import { privateJson } from "@/lib/reporting/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const expected = Buffer.from((process.env.FACTORY_WORKER_SECRET || process.env.SEARCH_CONSOLE_SYNC_SECRET || "").trim());
  const supplied = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "");
  if (expected.length < 32 || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return privateJson({ ok: false }, 401);
  }
  try {
    const result = await runFactoryWorkerStep();
    // Notification catch-up must not turn a completed paid job into a failed
    // cron response. Dashboard reads and the next worker reconcile it again.
    try { await syncFactoryWorkNotices(); } catch { console.warn("Website planning updates will be reconciled on the next check."); }
    return privateJson({ ok: true, ...result });
  } catch {
    return privateJson({ ok: false, error: "factory_worker_unavailable" }, 503);
  }
}
