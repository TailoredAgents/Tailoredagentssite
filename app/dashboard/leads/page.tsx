import { leadDisplayName, leadCompanyName } from "@/lib/operations/format";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Download,
  Filter,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { DashboardPagination } from "@/components/dashboard/pagination";
import { ManualLeadForm } from "@/components/dashboard/manual-lead-form";
import { LeadStatusSelect } from "@/components/dashboard/lead-status-select";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { listLeads } from "@/lib/operations/data";
import { formatOperationalDate, statusLabel } from "@/lib/operations/format";
import { leadStatuses } from "@/lib/operations/validation";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    page?: string | string[];
    source?: string | string[];
  }>;
}) {
  const context = await requireDashboardContext();
  const leads = await listLeads(context, await searchParams);

  return (
    <>
      <header className="dashboard-topbar">
        <div>
          <span>Operations</span>
          <strong>Leads</strong>
        </div>
        <span className="dashboard-secure">
          <ShieldCheck size={15} />
          Protected session
        </span>
      </header>
      <div className="dashboard-content">
        <section className="dashboard-page-heading dashboard-page-heading-compact">
          <div>
            <span>Lead pipeline</span>
            <h1>Leads</h1>
            <p>
              Keep website inquiries, Facebook and Instagram leads, and manually added prospects
              together, ready for your next conversation.
            </p>
          </div>
          <a
            className="dashboard-secondary-button"
            href="/dashboard/leads/export"
          >
            <Download size={15} />
            Export all leads
          </a>
        </section>

        {context.role !== "viewer" ? <ManualLeadForm /> : null}

        <form className="dashboard-filter-bar" method="get">
          <label>
            <Search size={15} />
            <input
              type="search"
              aria-label="Search leads"
              name="q"
              defaultValue={leads.q}
              placeholder="Search name, company, phone, or email"
            />
          </label>
          <label>
            <Filter size={15} />
            <select
              aria-label="Filter leads by status"
              name="status"
              defaultValue={leads.status}
            >
              <option value="all">All statuses</option>
              {leadStatuses.map((status) => (
                <option value={status} key={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label><Filter size={15} /><select aria-label="Filter leads by source" name="source" defaultValue={leads.source}><option value="all">All sources</option><option value="facebook">Facebook / Instagram</option><option value="website">Website</option><option value="manual">Added manually</option></select></label>
          <button type="submit">Apply filters</button>
          {leads.q || leads.status !== "all" || leads.source !== "all" ? (
            <Link href="/dashboard/leads">Clear</Link>
          ) : null}
        </form>

        <section className="dashboard-panel dashboard-table-panel">
          <div className="dashboard-table-summary">
            <span>
              <UsersRound size={15} />
              {leads.total} lead{leads.total === 1 ? "" : "s"}
            </span>
            <small>Newest first</small>
          </div>
          <div className="dashboard-data-table dashboard-leads-table">
            <div className="dashboard-data-head">
              <span>Lead</span>
              <span>Interest</span>
              <span>Status</span>
              <span>Owner / next action</span>
              <span>Received</span>
            </div>
            {leads.items.length ? (
              leads.items.map((lead) => (
                <div
                  className="dashboard-data-row dashboard-lead-row"
                  key={lead.id}
                >
                  <span data-label="Lead">
                    <Link className="dashboard-lead-link" href={`/dashboard/leads/${lead.id}`}>
                      <strong>{leadDisplayName(lead)}</strong>
                      {leadCompanyName(lead) && <small>{leadCompanyName(lead)}</small>}
                      <small>
                        {lead.email || lead.phone || "No contact details"}
                      </small>
                    </Link>
                  </span>
                  <span data-label="Interest">
                    <strong>
                      {lead.inquiryType === "website-review"
                        ? "Website review"
                        : lead.interest || "Project inquiry"}
                    </strong>
                    {lead.source === "facebook" ? <small>Facebook / Instagram</small> : lead.source === "manual" ? (
                      <small>Added manually</small>
                    ) : (
                      <small className={`delivery-${lead.deliveryStatus}`}>
                        Notification: {statusLabel(lead.deliveryStatus)}
                      </small>
                    )}
                  </span>
                  <span data-label="Status">
                    {context.role === "viewer" ? <em className={`dashboard-status status-${lead.status}`}>
                      {statusLabel(lead.status)}
                    </em> : <LeadStatusSelect leadId={lead.id} name={leadDisplayName(lead)} status={lead.status} />}
                  </span>
                  <span data-label="Owner / next action">
                    <strong>{lead.ownerName || "Unassigned"}</strong>
                    <small>
                      {lead.nextAction || "No next action"}
                      {lead.nextActionAt
                        ? ` · ${formatOperationalDate(lead.nextActionAt, { dateOnly: true })}`
                        : ""}
                    </small>
                  </span>
                  <time data-label="Received" dateTime={lead.createdAt}>
                    {formatOperationalDate(lead.createdAt)}
                  </time>
                </div>
              ))
            ) : (
              <div className="dashboard-empty">
                <UsersRound size={21} />
                <strong>No leads match this view</strong>
                <p>
                  {context.role === "viewer"
                    ? "New leads and website inquiries will appear here."
                    : "Add a lead above or wait for your next website inquiry."}
                </p>
              </div>
            )}
          </div>
          <DashboardPagination
            basePath="/dashboard/leads"
            page={leads.page}
            pages={leads.pages}
            values={{ q: leads.q, status: leads.status, source: leads.source }}
          />
        </section>
      </div>
    </>
  );
}
