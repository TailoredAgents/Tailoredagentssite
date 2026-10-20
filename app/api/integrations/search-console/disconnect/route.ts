import { reportAccess, privateJson } from "@/lib/reporting/http";
import { disconnectSearchConsole } from "@/lib/search-console/connection";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const access = await reportAccess(request, true);
  if (access.response) return access.response;
  try {
    await disconnectSearchConsole(access.context);
    return privateJson({ status: "disconnected" });
  } catch {
    return privateJson({ error: "disconnect_unavailable" }, 503);
  }
}
