import { NextRequest } from "next/server";
import { getOptionalDashboardContext } from "@/lib/dashboard/data";
import {
  consumeSearchConsoleOAuthState,
  getSearchConsoleTarget,
  saveSearchConsoleConnection,
} from "@/lib/search-console/connection";
import {
  SEARCH_CONSOLE_SCOPE,
  resolveSearchConsoleConfiguration,
} from "@/lib/search-console/config";
import {
  exchangeAuthorizationCode,
  listSearchConsoleProperties,
  selectMatchingProperty,
} from "@/lib/search-console/google";
import { syncSearchConsoleConnection } from "@/lib/search-console/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dashboardRedirect(status: string) {
  return Response.redirect(new URL(`/dashboard/analytics?integration=${status}`, resolveSearchConsoleConfiguration().baseUrl), 302);
}

export async function GET(request: NextRequest) {
  const context = await getOptionalDashboardContext();
  if (!context) return Response.redirect(new URL("/sign-in?status=unauthorized", resolveSearchConsoleConfiguration().baseUrl), 302);
  if (context.role !== "owner" && context.role !== "admin") return dashboardRedirect("forbidden");

  const state = request.nextUrl.searchParams.get("state") ?? "";
  if (!await consumeSearchConsoleOAuthState(state, context)) {
    return dashboardRedirect("invalid_state");
  }
  if (request.nextUrl.searchParams.has("error")) return dashboardRedirect("denied");

  const code = request.nextUrl.searchParams.get("code");
  const configuration = resolveSearchConsoleConfiguration();
  if (!configuration.configured) return dashboardRedirect("not_configured");
  if (!code) return dashboardRedirect("connection_error");

  try {
    const targetSite = await getSearchConsoleTarget(context);
    if (!targetSite) return dashboardRedirect("site_missing");
    const tokens = await exchangeAuthorizationCode({
      code,
      clientId: configuration.clientId,
      clientSecret: configuration.clientSecret,
      redirectUri: configuration.redirectUri,
    });
    if (tokens.scope.length && !tokens.scope.includes(SEARCH_CONSOLE_SCOPE)) {
      return dashboardRedirect("scope_missing");
    }
    const properties = await listSearchConsoleProperties(tokens.accessToken);
    const selectedProperty = selectMatchingProperty(properties, targetSite.url);
    const saved = await saveSearchConsoleConnection({
      context,
      targetSite,
      tokens,
      selectedProperty,
    });
    if (saved.status !== "active") {
      return dashboardRedirect(saved.error ?? "connection_error");
    }
    const sync = await syncSearchConsoleConnection(saved.id, "oauth");
    return dashboardRedirect(sync.status === "succeeded" ? "connected" : "sync_error");
  } catch {
    return dashboardRedirect("connection_error");
  }
}
