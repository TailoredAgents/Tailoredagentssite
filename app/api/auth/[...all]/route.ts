import { toNextJsHandler } from "better-auth/next-js";
import { getDashboardAuth } from "@/lib/dashboard/auth";
import { isAllowedDashboardEmail } from "@/lib/dashboard/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() {
  return Response.json(
    { error: "Dashboard authentication is not configured." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

async function shouldSilentlyIgnoreMagicLink(request: Request) {
  if (!new URL(request.url).pathname.endsWith("/sign-in/magic-link")) {
    return false;
  }

  try {
    const body = (await request.clone().json()) as { email?: unknown };
    return (
      typeof body.email === "string" &&
      !isAllowedDashboardEmail(body.email)
    );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const auth = getDashboardAuth();
  if (!auth) return unavailable();
  return toNextJsHandler(auth).GET(request);
}

export async function POST(request: Request) {
  const auth = getDashboardAuth();
  if (!auth) return unavailable();

  // Keep the public response indistinguishable while preventing unapproved
  // addresses from being emailed or persisted in verification records.
  if (await shouldSilentlyIgnoreMagicLink(request)) {
    return Response.json(
      { status: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return toNextJsHandler(auth).POST(request);
}
