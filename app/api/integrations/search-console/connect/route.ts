import { getOptionalDashboardContext } from "@/lib/dashboard/data";
import { createSearchConsoleOAuthState } from "@/lib/search-console/connection";
import { resolveSearchConsoleConfiguration } from "@/lib/search-console/config";
import { buildAuthorizationUrl } from "@/lib/search-console/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dashboardRedirect(status: string) {
  return Response.redirect(new URL(`/dashboard/analytics?integration=${status}`, resolveSearchConsoleConfiguration().baseUrl), 302);
}

export async function GET() {
  const context = await getOptionalDashboardContext();
  if (!context) return Response.redirect(new URL("/sign-in?status=unauthorized", resolveSearchConsoleConfiguration().baseUrl), 302);
  if (context.role !== "owner" && context.role !== "admin") return dashboardRedirect("forbidden");

  const configuration = resolveSearchConsoleConfiguration();
  if (!configuration.configured) return dashboardRedirect("not_configured");

  const state = await createSearchConsoleOAuthState(context);
  return Response.redirect(buildAuthorizationUrl({
    clientId: configuration.clientId,
    redirectUri: configuration.redirectUri,
    state,
  }), 302);
}
