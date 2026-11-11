import { leadDisplayName, leadCompanyName } from "@/lib/operations/format";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Download,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { DashboardPagination } from "@/components/dashboard/pagination";
import { ManualLeadForm } from "@/components/dashboard/manual-lead-form";
import { LeadStatusSelect } from "@/components/dashboard/lead-status-select";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { listLeads } from "@/lib/operations/data";
import { formatOperationalDate, statusLabel } from "@/lib/operations/format";
import { ProspectFilters } from "@/components/dashboard/prospect-filters";
import styles from "./prospects.module.css";

export const metadata: Metadata = { title: "Prospects" };

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
  const filters = await searchParams;
  const leads = await listLeads(context, { ...filters, status: filters.status ?? "active" });
  const exportLink = <a className="dashboard-secondary-button" href="/dashboard/leads/export"><Download size={16} aria-hidden="true" />Export all prospects</a>;

  return (
    <>
      <header className="dashboard-topbar">
        <div>
          <span>Operations</span>
          <strong>Prospects</strong>
        </div>
        <span className="dashboard-secure">
          <ShieldCheck size={15} />
          Protected session
        </span>
      </header>
      <div className={`dashboard-content ${styles.prospects}`}>
        <section className="dashboard-page-heading dashboard-page-heading-compact">
          <div>
            <span>Prospect pipeline</span>
            <h1>Prospects</h1>
            <p>
              Every connection, referral, and inquiry. One clear next step.
            </p>
          </div>
        </section>

        {context.role !== "viewer" ? <ManualLeadForm toolbarEnd={exportLink} /> : <div className={styles.viewerActions}>{exportLink}</div>}

        <ProspectFilters key={`${leads.q}:${leads.status}:${leads.source}`} q={leads.q} status={leads.status} source={leads.source} />

        <section className="dashboard-panel dashboard-table-panel">
          <div className="dashboard-table-summary">
            <span>
              <UsersRound size={15} />
              {leads.total} prospect{leads.total === 1 ? "" : "s"}
            </span>
            <small>{leads.status === "active" ? "New, Qualified, and Proposal · Newest first" : "Newest first"}</small>
          </div>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span>Prospect</span>
              <span>Interest</span>
              <span>Status</span>
              <span>Owner / next action</span>
              <span>Added</span>
            </div>
            {leads.items.length ? (
              leads.items.map((lead) => (
                <div
                  className={`${styles.row} dashboard-lead-row`}
                  key={lead.id}
                >
                  <span className={styles.identity} data-label="Prospect">
                    <Link className="dashboard-lead-link" href={`/dashboard/leads/${lead.id}`}>
                      <strong>{leadDisplayName(lead)}</strong>
                      {leadCompanyName(lead) && <small>{leadCompanyName(lead)}</small>}
                      <small>
                        {lead.email || lead.phone || "No contact details"}
                      </small>
                    </Link>
                  </span>
                  <span className={styles.interest} data-label="Interest">
                    <strong>
                      {lead.inquiryType === "website-review"
                        ? "Website review"
                        : lead.interest || "Project inquiry"}
                    </strong>
                    {lead.source === "smart_card" ? <small>Smart Card inquiry</small> : lead.source === "facebook" ? <small>Facebook / Instagram</small> : lead.source === "manual" ? (
                      <small>Added manually</small>
                    ) : (
                      <small className={`delivery-${lead.deliveryStatus}`}>
                        Notification: {statusLabel(lead.deliveryStatus)}
                      </small>
                    )}
                  </span>
                  <span className={styles.status} data-label="Status">
                    {context.role === "viewer" ? <em className={`dashboard-status status-${lead.status}`}>
                      {statusLabel(lead.status)}
                    </em> : <LeadStatusSelect leadId={lead.id} name={leadDisplayName(lead)} status={lead.status} />}
                  </span>
                  <span className={styles.nextAction} data-label="Owner / next action">
                    <strong>{lead.ownerName || "Unassigned"}</strong>
                    <small>
                      {lead.nextAction || "No next action"}
                      {lead.nextActionAt
                        ? ` · ${formatOperationalDate(lead.nextActionAt, { dateOnly: true })}`
                        : ""}
                    </small>
                  </span>
                  <time className={styles.date} data-label="Added" dateTime={lead.createdAt} title={formatOperationalDate(lead.createdAt)}>
                    {formatOperationalDate(lead.createdAt, { dateOnly: true })}
                  </time>
                </div>
              ))
            ) : (
              <div className="dashboard-empty">
                <UsersRound size={21} />
                <strong>No prospects match this view</strong>
                <p>
                  {leads.status === "active"
                    ? "Choose All statuses to include Won, Lost, and Archived records."
                    : context.role === "viewer"
                    ? "Prospects from referrals, connections, outreach, and inquiries will appear here."
                    : "Add a prospect above, whether you met them through a connection, referral, or inquiry."}
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
