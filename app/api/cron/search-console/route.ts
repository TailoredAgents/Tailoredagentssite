import { timingSafeEqual } from "node:crypto";
import { syncAllSearchConsoleConnections } from "@/lib/search-console/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  const expected = process.env.SEARCH_CONSOLE_SYNC_SECRET?.trim() ?? "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (expected.length < 32 || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false }, { status: 401 });
  const outcomes = await syncAllSearchConsoleConnections();
  return Response.json({
    ok: outcomes.every((outcome) => outcome.status !== "failed"),
    attempted: outcomes.length,
    succeeded: outcomes.filter((outcome) => outcome.status === "succeeded").length,
    failed: outcomes.filter((outcome) => outcome.status === "failed").length,
  }, {
    status: outcomes.some((outcome) => outcome.status === "failed") ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
