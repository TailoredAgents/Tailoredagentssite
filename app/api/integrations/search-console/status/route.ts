import { reportAccess, privateJson } from "@/lib/reporting/http";
import { getReportingStatus } from "@/lib/reporting/status";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const access = await reportAccess(request);
  if (access.response) return access.response;
  try {
    return privateJson(await getReportingStatus(access.context));
  } catch {
    return privateJson({ error: "status_unavailable" }, 503);
  }
}
