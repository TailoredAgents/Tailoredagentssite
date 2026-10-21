import { toNextJsHandler } from "better-auth/next-js";
import { getDashboardAuth } from "@/lib/dashboard/auth";
import { resolveDashboardConfiguration } from "@/lib/dashboard/config";
import { getOptionalDashboardContext } from "@/lib/dashboard/data";
import { readSmallJson, revokeMailDashboardSession } from "@/lib/dashboard/mail-identity";

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
  if (resolveDashboardConfiguration().authMode === "mail") {
    if (new URL(request.url).pathname !== "/api/auth/get-session") return Response.json({ error: "Not found." }, { status: 404 });
    try { if (!await getOptionalDashboardContext()) return Response.json(null, { headers: { "Cache-Control": "no-store" } }); }
    catch { return unavailable(); }
  }
  return toNextJsHandler(auth).GET(request);
}

export async function POST(request: Request) {
  const auth = getDashboardAuth();
  if (!auth) return unavailable();
  const config = resolveDashboardConfiguration();
  if (config.authMode === "mail") {
    const path = new URL(request.url).pathname;
    if (!["/api/auth/sign-in/team", "/api/auth/sign-out"].includes(path)) return Response.json({ error: "Not found." }, { status: 404 });
    if (request.headers.get("origin") !== config.baseUrl) return Response.json({ error: "Please use this website." }, { status: 403 });
    if (path === "/api/auth/sign-out") {
      const current = await auth.api.getSession({ headers: request.headers });
      if (current) await revokeMailDashboardSession(current.session.id);
    }
    if (path === "/api/auth/sign-in/team") {
      try {
        const body = await readSmallJson(request.body, 4096);
        request = new Request(request, { method: "POST", body: JSON.stringify(body) });
      } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
    }
  }

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
