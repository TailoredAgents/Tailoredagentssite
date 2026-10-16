import type { Metadata } from "next";
import Link from "next/link";
import { Download, Filter, Search, ShieldCheck, UsersRound } from "lucide-react";
import { DashboardPagination } from "@/components/dashboard/pagination";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { listLeads } from "@/lib/operations/data";
import { formatOperationalDate, statusLabel } from "@/lib/operations/format";
import { leadStatuses } from "@/lib/operations/validation";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; status?: string | string[]; page?: string | string[] }>;
}) {
  const context = await requireDashboardContext();
  const leads = await listLeads(context, await searchParams);

  return (
    <>
      <header className="dashboard-topbar"><div><span>Operations</span><strong>Leads</strong></div><span className="dashboard-secure"><ShieldCheck size={15} />Protected session</span></header>
      <div className="dashboard-content">
        <section className="dashboard-page-heading dashboard-page-heading-compact">
          <div><span>Inquiry pipeline</span><h1>Leads</h1><p>Every accepted website inquiry is retained here whether or not notification email is configured.</p></div>
          <a className="dashboard-secondary-button" href="/dashboard/leads/export"><Download size={15} />Export CSV</a>
        </section>

        <form className="dashboard-filter-bar" method="get">
          <label><Search size={15} /><input name="q" defaultValue={leads.q} placeholder="Search name, company, or email" /></label>
          <label><Filter size={15} /><select name="status" defaultValue={leads.status}><option value="all">All statuses</option>{leadStatuses.map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label>
          <button type="submit">Apply filters</button>
          {(leads.q || leads.status !== "all") ? <Link href="/dashboard/leads">Clear</Link> : null}
        </form>

        <section className="dashboard-panel dashboard-table-panel">
          <div className="dashboard-table-summary"><span><UsersRound size={15} />{leads.total} lead{leads.total === 1 ? "" : "s"}</span><small>Newest first</small></div>
          <div className="dashboard-data-table dashboard-leads-table">
            <div className="dashboard-data-head"><span>Lead</span><span>Interest</span><span>Status</span><span>Owner / next action</span><span>Received</span></div>
            {leads.items.length ? leads.items.map((lead) => (
              <Link className="dashboard-data-row" href={`/dashboard/leads/${lead.id}`} key={lead.id}>
                <span><strong>{lead.organization}</strong><small>{lead.name} · {lead.email}</small></span>
                <span><strong>{lead.inquiryType === "website-review" ? "Website review" : lead.interest || "Project inquiry"}</strong><small className={`delivery-${lead.deliveryStatus}`}>Notification: {statusLabel(lead.deliveryStatus)}</small></span>
                <span><em className={`dashboard-status status-${lead.status}`}>{statusLabel(lead.status)}</em></span>
                <span><strong>{lead.ownerName || "Unassigned"}</strong><small>{lead.nextAction || "No next action"}{lead.nextActionAt ? ` · ${formatOperationalDate(lead.nextActionAt, { dateOnly: true })}` : ""}</small></span>
                <time dateTime={lead.createdAt}>{formatOperationalDate(lead.createdAt)}</time>
              </Link>
            )) : <div className="dashboard-empty"><UsersRound size={21} /><strong>No leads match this view</strong><p>New website inquiries will appear here immediately, even before email delivery is connected.</p></div>}
          </div>
          <DashboardPagination basePath="/dashboard/leads" page={leads.page} pages={leads.pages} values={{ q: leads.q, status: leads.status }} />
        </section>
      </div>
    </>
  );
}
