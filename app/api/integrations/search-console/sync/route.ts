import { reportAccess, privateJson } from "@/lib/reporting/http";
import { resolveSearchConsoleConfiguration } from "@/lib/search-console/config";
import { syncWorkspaceSearchConsole } from "@/lib/search-console/sync";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const access = await reportAccess(request, true);
  if (access.response) return access.response;
  if (!resolveSearchConsoleConfiguration().configured)
    return privateJson({ error: "review_setup" }, 409);
  try {
    const result = await syncWorkspaceSearchConsole(
      access.context.workspace.id,
      "manual",
    );
    return privateJson(result, result.status === "queued" ? 202 : 409);
  } catch {
    return privateJson({ error: "update_unavailable" }, 503);
  }
}
