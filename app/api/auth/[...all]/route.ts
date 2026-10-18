import { toNextJsHandler } from "better-auth/next-js";
import { getDashboardAuth } from "@/lib/dashboard/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() {
  return Response.json(
    { error: "Dashboard authentication is not configured." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  const auth = getDashboardAuth();
  if (!auth) return unavailable();
  return toNextJsHandler(auth).GET(request);
}

export async function POST(request: Request) {
  const auth = getDashboardAuth();
  if (!auth) return unavailable();

  // Account creation is available only through the private bootstrap route.
  // Better Auth keeps this endpoint enabled internally so the first owner can
  // be created without a separate provisioning service.
  if (new URL(request.url).pathname.endsWith("/sign-up/email")) {
    return Response.json(
      { error: "Not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return toNextJsHandler(auth).POST(request);
}
