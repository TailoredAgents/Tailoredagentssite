import { requireDashboardContext } from "@/lib/dashboard/data";
import { exportLeads } from "@/lib/operations/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const context = await requireDashboardContext();
  const leads = await exportLeads(context);
  const headers = ["Organization", "Contact", "Email", "Phone", "Inquiry type", "Interest", "Website", "Status", "Owner", "Next action", "Next action date", "Outcome", "Received"];
  const lines = [headers, ...leads.map((lead) => [
    lead.organization, lead.name, lead.email, lead.phone, lead.inquiry_type,
    lead.interest, lead.website_url, lead.status, lead.owner_name,
    lead.next_action, lead.next_action_at?.toISOString(), lead.outcome_summary,
    lead.created_at.toISOString(),
  ])].map((row) => row.map(csvCell).join(","));
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tailored-agents-leads-${date}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
