import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { OperationForm } from "@/components/dashboard/operation-form";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { saveSiteAction } from "@/lib/operations/actions";
import { clientOptions, getSite } from "@/lib/operations/data";
import { statusLabel } from "@/lib/operations/format";
import { siteStatuses } from "@/lib/operations/validation";

export const metadata: Metadata = { title: "Site workspace" };

export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireDashboardContext();
  const { id } = await params;
  const [site, clients] = await Promise.all([getSite(context, id), clientOptions(context)]);
  if (!site) notFound();
  const mutable = context.role !== "viewer";
  return (
    <>
      <header className="dashboard-topbar"><div><span>Sites</span><strong>{site.name}</strong></div><span className="dashboard-secure"><ShieldCheck size={15} />Protected session</span></header>
      <div className="dashboard-content dashboard-narrow-content">
        <Link className="dashboard-back-link" href="/dashboard/sites"><ArrowLeft size={14} />Back to sites</Link>
        <section className="dashboard-page-heading dashboard-page-heading-compact dashboard-record-heading"><div><span>{statusLabel(site.environment)} environment</span><h1>{site.name}</h1><p>{site.client_name || "Internal or unassigned site"}</p></div><a className="dashboard-secondary-button" href={site.url} target="_blank" rel="noreferrer">Open site<ExternalLink size={14} /></a></section>
        <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><span>Configuration</span><h2>Site record</h2></div><em className={`dashboard-status status-${site.status}`}>{statusLabel(site.status)}</em></div><OperationForm disabled={!mutable} action={saveSiteAction} submitLabel="Save site"><fieldset disabled={!mutable} className="dashboard-form-grid dashboard-form-grid-two"><input type="hidden" name="siteId" value={site.id} /><label className="dashboard-field"><span>Client</span><select name="clientId" defaultValue={site.client_id || ""}><option value="">Internal / unassigned</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label><label className="dashboard-field"><span>Site name</span><input name="name" defaultValue={site.name} required minLength={2} maxLength={160} /></label><label className="dashboard-field dashboard-field-full"><span>URL</span><input name="url" type="url" defaultValue={site.url} required /></label><label className="dashboard-field"><span>Environment</span><select name="environment" defaultValue={site.environment}><option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option></select></label><label className="dashboard-field"><span>Status</span><select name="status" defaultValue={site.status}>{siteStatuses.map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label><label className="dashboard-field dashboard-field-full"><span>Operational notes</span><textarea name="notes" defaultValue={site.notes || ""} maxLength={4000} /></label></fieldset></OperationForm></section>
      </div>
    </>
  );
}
