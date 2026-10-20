import type { Metadata } from "next";
import { requireDashboardContext } from "@/lib/dashboard/data";
import {
  requireReportingSite,
  ReportingAccessError,
} from "@/lib/dashboard/site-access";
import { getReportingOverview } from "@/lib/reporting/data";
import { parseReportSelection } from "@/lib/reporting/dates";
import { getReportingStatus } from "@/lib/reporting/status";
import { ReportingDashboard } from "@/components/dashboard/reporting-dashboard";
import "./reporting.css";
export const metadata: Metadata = { title: "Website reports" };
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireDashboardContext();
  try {
    await requireReportingSite(context);
  } catch (error) {
    return (
      <main className="reporting">
        <h1>
          {error instanceof ReportingAccessError
            ? "Reports are unavailable for this account"
            : "Reports are temporarily unavailable"}
        </h1>
        <p>
          {error instanceof ReportingAccessError
            ? "Ask your workspace owner to check your access."
            : "Please try loading this page again. Your saved reports have not been removed."}
        </p>
      </main>
    );
  }
  const parameters = await searchParams;
  const selection = parseReportSelection(parameters);
  let report, status;
  try {
    [report, status] = await Promise.all([
      getReportingOverview(context, selection),
      getReportingStatus(context),
    ]);
  } catch {
    return (
      <main className="reporting">
        <h1>Reports are temporarily unavailable</h1>
        <p>
          Your saved reports have not been removed. Please try loading this page
          again.
        </p>
        <a className="report-button" href="/dashboard/analytics">
          Retry loading reports
        </a>
      </main>
    );
  }
  return (
    <ReportingDashboard
      report={report}
      initialStatus={status}
      invalidDates={
        parameters.range === "custom" && selection.range !== "custom"
      }
      connectionResult={
        typeof parameters.integration === "string"
          ? parameters.integration
          : undefined
      }
    />
  );
}
