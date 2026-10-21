import type { Metadata } from "next";
import Link from "next/link";
import { Globe2, Search, ShieldCheck } from "lucide-react";
import { OperationForm } from "@/components/dashboard/operation-form";
import { DashboardPagination } from "@/components/dashboard/pagination";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { saveSiteAction } from "@/lib/operations/actions";
import { clientOptions, listSites } from "@/lib/operations/data";
import { formatOperationalDate, statusLabel } from "@/lib/operations/format";
import { siteStatuses } from "@/lib/operations/validation";

export const metadata: Metadata = { title: "Sites" };

export default async function SitesPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[]; client?: string }> }) {
  const context = await requireDashboardContext();
  const params = await searchParams;
  const [sites, clients] = await Promise.all([listSites(context, params), clientOptions(context)]);
  const selectedClient = clients.some((client) => client.id === params.client) ? params.client : "";
  const mutable = context.role !== "viewer";

  return (
    <>
      <header className="dashboard-topbar"><div><span>Operations</span><strong>Sites</strong></div><span className="dashboard-secure"><ShieldCheck size={15} />Protected session</span></header>
      <div className="dashboard-content">
        <section className="dashboard-page-heading dashboard-page-heading-compact"><div><span>Managed footprint</span><h1>Sites</h1><p>Track the production, staging, and development properties connected to each client.</p></div>{mutable ? <Link className="dashboard-primary-button" href="#create-site">Add site</Link> : null}</section>
        <div className="dashboard-list-create-grid">
          <div>
            <form className="dashboard-filter-bar" method="get"><label><Search size={15} /><input type="search" aria-label="Search sites" name="q" defaultValue={sites.q} placeholder="Search site, URL, or client" /></label><button type="submit">Search</button>{sites.q ? <Link href="/dashboard/sites">Clear</Link> : null}</form>
            <section className="dashboard-panel dashboard-table-panel"><div className="dashboard-table-summary"><span><Globe2 size={15} />{sites.total} site{sites.total === 1 ? "" : "s"}</span><small>All environments</small></div><div className="dashboard-data-table dashboard-sites-table"><div className="dashboard-data-head"><span>Site</span><span>Client</span><span>Environment</span><span>Status</span><span>Updated</span></div>{sites.items.length ? sites.items.map((site) => <Link className="dashboard-data-row" href={`/dashboard/sites/${site.id}`} key={site.id}><span data-label="Site"><strong>{site.name}</strong><small>{site.url}</small></span><span data-label="Client"><strong>{site.client_name || "Internal / unassigned"}</strong></span><span data-label="Environment"><strong>{statusLabel(site.environment)}</strong></span><span data-label="Status"><em className={`dashboard-status status-${site.status}`}>{statusLabel(site.status)}</em></span><time data-label="Updated" dateTime={site.updatedAt}>{formatOperationalDate(site.updatedAt)}</time></Link>) : <div className="dashboard-empty"><Globe2 size={21} /><strong>No sites match this view</strong></div>}</div><DashboardPagination basePath="/dashboard/sites" page={sites.page} pages={sites.pages} values={{ q: sites.q }} /></section>
          </div>
          <aside id="create-site" className="dashboard-panel dashboard-create-panel"><div className="dashboard-panel-heading"><div><span>Inventory</span><h2>Add site</h2></div></div><OperationForm disabled={!mutable} action={saveSiteAction} submitLabel="Create site" pendingLabel="Creating"><fieldset disabled={!mutable} className="dashboard-form-grid"><label className="dashboard-field dashboard-field-full"><span>Client</span><select name="clientId" defaultValue={selectedClient}><option value="">Internal / unassigned</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label><label className="dashboard-field dashboard-field-full"><span>Site name</span><input name="name" required minLength={2} maxLength={160} /></label><label className="dashboard-field dashboard-field-full"><span>URL</span><input name="url" type="url" required placeholder="https://example.com" /></label><label className="dashboard-field"><span>Environment</span><select name="environment" defaultValue="production"><option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option></select></label><label className="dashboard-field"><span>Status</span><select name="status" defaultValue="active">{siteStatuses.map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label><label className="dashboard-field dashboard-field-full"><span>Notes</span><textarea name="notes" maxLength={4000} /></label></fieldset></OperationForm></aside>
        </div>
      </div>
    </>
  );
}
