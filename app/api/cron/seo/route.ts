import { timingSafeEqual } from "node:crypto";
import { runSeoWorkerStep } from "@/lib/seo/worker";
import { privateJson } from "@/lib/reporting/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(request: Request) {
  const expected = Buffer.from(
      (
        process.env.SEO_WORKER_SECRET ||
        process.env.SEARCH_CONSOLE_SYNC_SECRET ||
        ""
      ).trim(),
    ),
    supplied = Buffer.from(
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "",
    );
  if (
    expected.length < 32 ||
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return privateJson({ ok: false }, 401);
  try {
    return privateJson({ ok: true, ...(await runSeoWorkerStep()) });
  } catch {
    return privateJson({ ok: false, error: "seo_worker_unavailable" }, 503);
  }
}
