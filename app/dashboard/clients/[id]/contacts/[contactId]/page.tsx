import { PhoneNumbers } from "@/components/conversations/phone-numbers";
import { getConversationRecipient } from "@/lib/conversations/recipients";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { OperationForm } from "@/components/dashboard/operation-form";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { saveContactAction } from "@/lib/operations/actions";
import { getContact } from "@/lib/operations/data";

export const metadata: Metadata = { title: "Edit contact" };

export default async function ContactPage({ params }: { params: Promise<{ id: string; contactId: string }> }) {
  const context = await requireDashboardContext();
  const { id, contactId } = await params;
  const contact = await getContact(context, id, contactId);
  if (!contact) notFound();
  const phoneRecipient = contactId ? await getConversationRecipient(context, "contact", contactId) : null;
  const mutable = context.role !== "viewer";

  return (
    <>
      <header className="dashboard-topbar"><div><span>{contact.client_name}</span><strong>Edit contact</strong></div><span className="dashboard-secure"><ShieldCheck size={15} />Protected session</span></header>
      <div className="dashboard-content dashboard-narrow-content">
        <Link className="dashboard-back-link" href={`/dashboard/clients/${id}`}><ArrowLeft size={14} />Back to client</Link>
        <section className="dashboard-page-heading dashboard-page-heading-compact"><div><span>Contact record</span><h1>{contact.name}</h1><p>Update the relationship details stored for this client contact.</p></div></section>
        <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><span>Contact</span><h2>Profile details</h2></div></div><OperationForm disabled={!mutable} action={saveContactAction} submitLabel="Save contact"><fieldset disabled={!mutable} className="dashboard-form-grid dashboard-form-grid-two"><input type="hidden" name="contactId" value={contact.id} /><input type="hidden" name="clientId" value={contact.client_id} /><label className="dashboard-field"><span>Name</span><input name="name" defaultValue={contact.name} required minLength={2} maxLength={140} /></label><label className="dashboard-field"><span>Title</span><input name="title" defaultValue={contact.title || ""} maxLength={120} /></label><label className="dashboard-field"><span>Email</span><input name="email" type="email" defaultValue={contact.email || ""} maxLength={254} /></label><label className="dashboard-field"><span>Phone</span><input name="phone" type="tel" defaultValue={contact.phone || ""} maxLength={40} /></label><label className="dashboard-check"><input type="checkbox" name="isPrimary" defaultChecked={contact.is_primary} /><span>Primary contact</span></label></fieldset></OperationForm></section>
        {phoneRecipient ? <section className="dashboard-panel dashboard-detail-card"><PhoneNumbers recipient={phoneRecipient} readOnly={!mutable}/></section> : null}
      </div>
    </>
  );
}
