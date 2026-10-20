import { reportAccess, privateJson } from "@/lib/reporting/http";
import {
  getReportTable,
  reportTables,
  type ReportTable,
} from "@/lib/reporting/data";
import { parseReportSelection } from "@/lib/reporting/dates";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const access = await reportAccess(request);
  if (access.response) return access.response;
  const p = new URL(request.url).searchParams,
    table = p.get("table") as ReportTable;
  if (!reportTables.includes(table))
    return privateJson({ error: "invalid_table" }, 400);
  try {
    return privateJson(
      await getReportTable(
        access.context,
        parseReportSelection(Object.fromEntries(p)),
        {
          table,
          search: p.get("search") ?? "",
          sort: p.get("sort") ?? "",
          direction: p.get("direction") ?? "",
          page: Math.max(1, Number.parseInt(p.get("page") ?? "1") || 1),
        },
      ),
    );
  } catch {
    return privateJson({ error: "report_unavailable" }, 503);
  }
}
