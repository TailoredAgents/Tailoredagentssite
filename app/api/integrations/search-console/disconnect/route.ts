import { NextRequest } from "next/server";
import { getOptionalDashboardContext } from "@/lib/dashboard/data";
import { disconnectSearchConsole } from "@/lib/search-console/connection";
import { resolveSearchConsoleConfiguration } from "@/lib/search-console/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  if (context.role !== "owner" && context.role !== "admin") {
    return Response.redirect(new URL("/dashboard/analytics?integration=forbidden", resolveSearchConsoleConfiguration().baseUrl), 303);
  }
  await disconnectSearchConsole(context);
  return Response.redirect(new URL("/dashboard/analytics?integration=disconnected", resolveSearchConsoleConfiguration().baseUrl), 303);
}
