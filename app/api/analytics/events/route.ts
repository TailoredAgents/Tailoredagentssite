import { NextRequest } from "next/server";
import { publicRequestKey } from "@/lib/operations/public-inquiries";
import {
  consumeAnalyticsRateLimit,
  storeAnalyticsEvent,
} from "@/lib/analytics/store";
import { analyticsEventSchema } from "@/lib/analytics/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 4_000;

function response(status: number) {
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return response(403);
  if (!request.headers.get("content-type")?.includes("application/json")) return response(415);

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_LENGTH) return response(413);

  try {
    if (await consumeAnalyticsRateLimit(publicRequestKey(request.headers))) {
      return response(429);
    }
  } catch {
    return response(503);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_LENGTH) return response(413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return response(400);
  }

  const event = analyticsEventSchema.safeParse(parsed);
  if (!event.success) return response(400);

  try {
    await storeAnalyticsEvent(event.data);
    return response(202);
  } catch {
    return response(503);
  }
}
