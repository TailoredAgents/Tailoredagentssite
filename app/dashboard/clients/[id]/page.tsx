import { RecordFacts } from "@/components/dashboard/record-facts";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, Globe2, Mail, Pencil, Phone, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { OperationForm } from "@/components/dashboard/operation-form";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { saveClientAction, saveContactAction } from "@/lib/operations/actions";
import { getClient } from "@/lib/operations/data";
import { formatOperationalDate, statusLabel } from "@/lib/operations/format";
import { clientStatuses } from "@/lib/operations/validation";

export const metadata: Metadata = { title: "Client workspace" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireDashboardContext();
  const { id } = await params;
  const client = await getClient(context, id);
  if (!client) notFound();
  const mutable = context.role !== "viewer";

  return (
    <>
      <header className="dashboard-topbar"><div><span>Clients</span><strong>{client.name}</strong></div><span className="dashboard-secure"><ShieldCheck size={15} />Protected session</span></header>
      <div className="dashboard-content">
        <Link className="dashboard-back-link" href="/dashboard/clients"><ArrowLeft size={14} />Back to clients</Link>
        <section className="dashboard-page-heading dashboard-page-heading-compact dashboard-record-heading"><div><span>Client workspace</span><h1>{client.name}</h1><p>Created {formatOperationalDate(client.createdAt)} · Last updated {formatOperationalDate(client.updatedAt)}</p></div><em className={`dashboard-status status-${client.status}`}>{statusLabel(client.status)}</em></section>
        <RecordFacts facts={[{label:"Contacts",value:client.contacts.length},{label:"Managed sites",value:client.sites.length},{label:"Projects",value:client.projects.length}]} />
        <nav className="workspace-section-links" aria-label="Client sections"><a href="#client-contacts">Contacts</a><a href="#client-assets">Sites & projects</a><a href="#client-settings">Account details</a></nav>
        <div className="dashboard-record-grid">
          <div className="dashboard-record-main">
            <section id="client-contacts" className="dashboard-panel">
              <div className="dashboard-panel-heading"><div><span>People</span><h2>Contacts</h2></div><small>{client.contacts.length}</small></div>
              <div className="dashboard-card-list">
                {client.contacts.length ? client.contacts.map((contact) => <article key={contact.id}><span><UserRound size={16} /></span><div><strong>{contact.name}{contact.isPrimary ? " · Primary" : ""}</strong><small>{contact.title || "Contact"}</small></div><div className="dashboard-card-actions">{contact.email ? <a href={`mailto:${contact.email}`} aria-label={`Email ${contact.name}`}><Mail size={14} /></a> : null}{contact.phone ? <a href={`tel:${contact.phone}`} aria-label={`Call ${contact.name}`}><Phone size={14} /></a> : null}<Link href={`/dashboard/clients/${client.id}/contacts/${contact.id}`} aria-label={`Edit ${contact.name}`}><Pencil size={14} /></Link></div></article>) : <div className="dashboard-empty"><UsersRound size={21} /><strong>No contacts yet</strong></div>}
              </div>
              <OperationForm disabled={!mutable} action={saveContactAction} submitLabel="Add contact" resetOnSuccess>
                <fieldset disabled={!mutable} className="dashboard-form-grid dashboard-form-grid-two">
                  <input type="hidden" name="clientId" value={client.id} />
                  <label className="dashboard-field"><span>Name</span><input name="name" required minLength={2} maxLength={140} /></label>
                  <label className="dashboard-field"><span>Title</span><input name="title" maxLength={120} /></label>
                  <label className="dashboard-field"><span>Email</span><input name="email" type="email" maxLength={254} /></label>
                  <label className="dashboard-field"><span>Phone</span><input name="phone" type="tel" maxLength={40} /></label>
                  <label className="dashboard-check"><input type="checkbox" name="isPrimary" /><span>Primary contact</span></label>
                </fieldset>
              </OperationForm>
            </section>

            <div id="client-assets" className="dashboard-secondary-grid dashboard-client-assets">
              <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><span>Digital footprint</span><h2>Sites</h2></div>{mutable ? <Link href={`/dashboard/sites?client=${client.id}#create-site`}>Add site</Link> : null}</div><div className="dashboard-card-list">{client.sites.length ? client.sites.map((site) => <Link href={`/dashboard/sites/${site.id}`} key={site.id}><span><Globe2 size={16} /></span><div><strong>{site.name}</strong><small>{site.url}</small></div><em className={`dashboard-status status-${site.status}`}>{statusLabel(site.status)}</em></Link>) : <div className="dashboard-empty"><Globe2 size={20} /><strong>No managed sites</strong></div>}</div></section>
              <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><span>Delivery</span><h2>Projects</h2></div>{mutable ? <Link href={`/dashboard/projects?client=${client.id}#create-project`}>Add project</Link> : null}</div><div className="dashboard-card-list">{client.projects.length ? client.projects.map((project) => <Link href={`/dashboard/projects/${project.id}`} key={project.id}><span><Building2 size={16} /></span><div><strong>{project.name}</strong><small>{project.dueAt ? `Due ${formatOperationalDate(project.dueAt, { dateOnly: true })}` : "No due date"}</small></div><em className={`dashboard-status status-${project.status}`}>{statusLabel(project.status)}</em></Link>) : <div className="dashboard-empty"><Building2 size={20} /><strong>No projects</strong></div>}</div></section>
            </div>
          </div>

          <aside id="client-settings" className="dashboard-record-aside">
            <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><span>Account</span><h2>Client settings</h2></div></div><OperationForm disabled={!mutable} action={saveClientAction} submitLabel="Save client"><fieldset disabled={!mutable} className="dashboard-form-grid"><input type="hidden" name="clientId" value={client.id} /><label className="dashboard-field dashboard-field-full"><span>Client name</span><input name="name" defaultValue={client.name} required minLength={2} maxLength={160} /></label><label className="dashboard-field dashboard-field-full"><span>Status</span><select name="status" defaultValue={client.status}>{clientStatuses.map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label><label className="dashboard-field dashboard-field-full"><span>Internal notes</span><textarea name="notes" defaultValue={client.notes || ""} maxLength={4000} /></label></fieldset></OperationForm></section>
          </aside>
        </div>
      </div>
    </>
  );
}
