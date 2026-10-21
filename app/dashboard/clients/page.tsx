import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Search, ShieldCheck } from "lucide-react";
import { OperationForm } from "@/components/dashboard/operation-form";
import { DashboardPagination } from "@/components/dashboard/pagination";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { saveClientAction } from "@/lib/operations/actions";
import { listClients } from "@/lib/operations/data";
import { formatOperationalDate, statusLabel } from "@/lib/operations/format";
import { clientStatuses } from "@/lib/operations/validation";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> }) {
  const context = await requireDashboardContext();
  const clients = await listClients(context, await searchParams);
  const mutable = context.role !== "viewer";

  return (
    <>
      <header className="dashboard-topbar"><div><span>Operations</span><strong>Clients</strong></div><span className="dashboard-secure"><ShieldCheck size={15} />Protected session</span></header>
      <div className="dashboard-content">
        <section className="dashboard-page-heading dashboard-page-heading-compact"><div><span>Relationships</span><h1>Clients</h1><p>Keep contacts, managed sites, and active engagements connected to one place.</p></div>{mutable ? <Link className="dashboard-primary-button" href="#create-client">Add client</Link> : null}</section>
        <div className="dashboard-list-create-grid">
          <div>
            <form className="dashboard-filter-bar" method="get"><label><Search size={15} /><input type="search" aria-label="Search clients" name="q" defaultValue={clients.q} placeholder="Search clients" /></label><button type="submit">Search</button>{clients.q ? <Link href="/dashboard/clients">Clear</Link> : null}</form>
            <section className="dashboard-panel dashboard-table-panel">
              <div className="dashboard-table-summary"><span><Building2 size={15} />{clients.total} client{clients.total === 1 ? "" : "s"}</span><small>Updated recently</small></div>
              <div className="dashboard-data-table dashboard-clients-table">
                <div className="dashboard-data-head"><span>Client</span><span>Primary contact</span><span>Sites / projects</span><span>Status</span><span>Updated</span></div>
                {clients.items.length ? clients.items.map((client) => <Link className="dashboard-data-row" href={`/dashboard/clients/${client.id}`} key={client.id}><span data-label="Client"><strong>{client.name}</strong></span><span data-label="Primary contact"><strong>{client.primary_name || "No contact"}</strong><small>{client.primary_email || "Add a primary contact"}</small></span><span data-label="Sites / projects"><strong>{client.sites} site{client.sites === 1 ? "" : "s"}</strong><small>{client.projects} project{client.projects === 1 ? "" : "s"}</small></span><span data-label="Status"><em className={`dashboard-status status-${client.status}`}>{statusLabel(client.status)}</em></span><time data-label="Updated" dateTime={client.updatedAt}>{formatOperationalDate(client.updatedAt)}</time></Link>) : <div className="dashboard-empty"><Building2 size={21} /><strong>{clients.q ? "No matching clients" : "No clients yet"}</strong><p>{clients.q ? "Try a different name or clear your search." : "Convert a qualified lead or create your first client below."}</p></div>}
              </div>
              <DashboardPagination basePath="/dashboard/clients" page={clients.page} pages={clients.pages} values={{ q: clients.q }} />
            </section>
          </div>
          <aside id="create-client" className="dashboard-panel dashboard-create-panel">
            <div className="dashboard-panel-heading"><div><span>Manual entry</span><h2>Create client</h2></div></div>
            <OperationForm disabled={!mutable} action={saveClientAction} submitLabel="Create client" pendingLabel="Creating">
              <fieldset disabled={!mutable} className="dashboard-form-grid">
                <label className="dashboard-field dashboard-field-full"><span>Client name</span><input name="name" required minLength={2} maxLength={160} /></label>
                <label className="dashboard-field dashboard-field-full"><span>Status</span><select name="status" defaultValue="active">{clientStatuses.map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label>
                <label className="dashboard-field dashboard-field-full"><span>Internal notes</span><textarea name="notes" maxLength={4000} placeholder="Relationship context, scope, or operating constraints" /></label>
              </fieldset>
            </OperationForm>
          </aside>
        </div>
      </div>
    </>
  );
}
