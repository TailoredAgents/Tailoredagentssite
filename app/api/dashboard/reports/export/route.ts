import { reportAccess, privateJson } from "@/lib/reporting/http";
import {
  getReportingOverview,
  getReportTable,
  reportTables,
} from "@/lib/reporting/data";
import { parseReportSelection } from "@/lib/reporting/dates";
import { csvLine } from "@/lib/reporting/csv";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const access = await reportAccess(request);
  if (access.response) return access.response;
  const context = access.context;
  const selection = parseReportSelection(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  let report: Awaited<ReturnType<typeof getReportingOverview>>;
  try {
    report = await getReportingOverview(access.context, selection);
  } catch {
    return privateJson({ error: "export_unavailable" }, 503);
  }
  const encoder = new TextEncoder();
  async function* lines() {
    yield csvLine([
      "Tailored Agents website report",
      "Generated",
      report.generatedAt,
      "Report days",
      "America/Los_Angeles",
    ]);
    yield csvLine([
      "Source",
      "Start",
      "End",
      "Completeness",
      "Metric / label",
      "Value",
      "Second value",
      "Average position",
    ]);
    const webNote = report.website.complete
      ? "Recorded period; privacy settings and blocked tracking can exclude visits"
      : "Incomplete measurement history";
    const googleNote = report.google.complete
      ? "All days checked; Google withholds some detailed rows"
      : `${report.google.missing.length} days not checked; missing dates are not zero`;
    for (const [label, value] of Object.entries({
      measured_visits: report.website.visits,
      received_inquiries: report.website.inquiries,
      attributed_inquiries: report.website.attributed,
      converting_visits: report.website.convertingVisits,
      inquiry_conversion_percent: report.website.conversionRate,
    }))
      yield csvLine([
        "Website",
        report.website.range.start,
        report.website.range.end,
        webNote,
        label,
        value,
      ]);
    for (const [label, value] of Object.entries({
      clicks: report.google.clicks,
      impressions: report.google.impressions,
      ctr_percent: report.google.ctr,
      average_position: report.google.position,
    }))
      yield csvLine([
        "Google property totals",
        report.google.range.start,
        report.google.range.end,
        googleNote,
        label,
        report.google.available ? value : null,
      ]);
    for (const row of report.website.trend)
      yield csvLine([
        "Website daily",
        row.day,
        row.day,
        webNote,
        "Visits / inquiries",
        row.visits,
        row.inquiries,
      ]);
    for (const row of report.google.trend)
      yield csvLine([
        "Google daily",
        row.day,
        row.day,
        row.clicks === null ? "Not imported" : "Checked",
        "Clicks / appearances",
        row.clicks,
        row.impressions,
      ]);
    for (const table of reportTables) {
      let page = 1;
      while (!request.signal.aborted) {
        const result = await getReportTable(context, selection, {
          table,
          page,
          size: 1000,
        });
        for (const row of result.rows)
          yield csvLine([
            table,
            result.range.start,
            result.range.end,
            table === "queries" || table === "google-pages"
              ? googleNote
              : webNote,
            row.label,
            row.primary,
            row.secondary,
            row.position,
          ]);
        if (page * result.size >= result.total) break;
        page++;
      }
    }
    yield csvLine([
      "Export complete",
      "Details reflect saved data during export; rerun after an active import finishes.",
    ]);
  }
  const iterator = lines();
  return new Response(
    new ReadableStream({
      async pull(controller) {
        try {
          const next = await iterator.next();
          if (next.done) controller.close();
          else controller.enqueue(encoder.encode(next.value));
        } catch {
          controller.error(new Error("Export interrupted; download again."));
        }
      },
      async cancel() {
        await iterator.return();
      },
    }),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="tailored-agents-report.csv"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
