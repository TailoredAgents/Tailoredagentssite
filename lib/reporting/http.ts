import "server-only";
import { getOptionalDashboardContext } from "@/lib/dashboard/data";
import {
  requireReportingSite,
  ReportingAccessError,
} from "@/lib/dashboard/site-access";
import { resolveSearchConsoleConfiguration } from "@/lib/search-console/config";

export function privateJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function reportAccess(request: Request, manage = false) {
  if (
    manage &&
    request.method !== "GET" &&
    request.headers.get("origin") !==
      resolveSearchConsoleConfiguration().baseUrl
  ) {
    return { response: privateJson({ error: "origin_not_allowed" }, 403) };
  }
  try {
    const context = await getOptionalDashboardContext();
    if (!context)
      return { response: privateJson({ error: "sign_in_required" }, 401) };
    await requireReportingSite(context, manage);
    return { context };
  } catch (error) {
    return {
      response:
        error instanceof ReportingAccessError
          ? privateJson({ error: "report_access_denied" }, 403)
          : privateJson({ error: "report_unavailable" }, 503),
    };
  }
}
