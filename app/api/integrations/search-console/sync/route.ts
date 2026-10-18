import { NextRequest } from "next/server";
import { getOptionalDashboardContext } from "@/lib/dashboard/data";
import { resolveSearchConsoleConfiguration } from "@/lib/search-console/config";
import { syncWorkspaceSearchConsole } from "@/lib/search-console/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(status: string) {
  return Response.redirect(new URL(`/dashboard/analytics?integration=${status}`, resolveSearchConsoleConfiguration().baseUrl), 303);
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(resolveSearchConsoleConfiguration().baseUrl).origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const context = await getOptionalDashboardContext();
  if (!context) return Response.redirect(new URL("/sign-in?status=unauthorized", resolveSearchConsoleConfiguration().baseUrl), 303);
  if (context.role !== "owner" && context.role !== "admin") return redirect("forbidden");
  if (!resolveSearchConsoleConfiguration().configured) return redirect("not_configured");

  const result = await syncWorkspaceSearchConsole(context.workspace.id, "manual");
  return redirect(result.status === "succeeded" ? "synced" : result.status === "skipped" ? "not_connected" : "sync_error");
}
