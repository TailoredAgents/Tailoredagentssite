import Link from "next/link";
import { ArrowLeft, ArrowRight, Search, UserRound } from "lucide-react";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { listConversationRecipients } from "@/lib/conversations/recipients";
import "../conversations.css";

export const metadata = { title: "New conversation" };
export default async function NewConversationPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const context = await requireDashboardContext();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 120) : "";
  const recipients = await listConversationRecipients(context, q);
  return <section className="conversation-recipient-picker">
    <Link href="/dashboard/inbox" className="conversation-legacy-back"><ArrowLeft size={16} />Back to conversations</Link>
    <header><span className="conversation-eyebrow">Start with a person</span><h1>New conversation</h1><p>Choose a contact or lead. Their history and contact options will open in the Inbox.</p></header>
    <form method="get" className="conversation-recipient-search" role="search"><label><Search size={18} aria-hidden="true" /><input type="search" name="q" aria-label="Find a contact or lead" placeholder="Search name, business, email or phone…" defaultValue={q} maxLength={120} autoFocus /></label><button className="conversation-button is-primary" type="submit">Search</button></form>
    <div className="conversation-recipient-results" aria-label="Contacts and leads">
      {recipients.map(person => <Link key={`${person.kind}:${person.id}`} href={`/dashboard/inbox?${person.kind}=${person.id}`} className="conversation-recipient-result"><span className="conversation-avatar" aria-hidden="true"><UserRound size={18} /></span><div><strong>{person.name}</strong><span>{[person.businessName, person.email, person.phone].filter(Boolean).join(" · ") || "No contact details yet"}</span></div><small>{person.kind === "lead" ? "Lead" : "Contact"}</small><ArrowRight size={16} aria-hidden="true" /></Link>)}
      {!recipients.length ? <div className="conversation-empty"><h2>No matching people</h2><p>Try another name, email address or phone number.</p><Link href="/dashboard/leads">Add a lead</Link></div> : null}
    </div>
    <footer><p>{recipients.length === 50 ? "Showing the first 50 matches. Search to narrow the list." : "Looking for someone new?"}</p><Link href="/dashboard/leads">Go to leads</Link><div><Link href="/dashboard/inbox?channel=email&compose=1">Use an email address</Link><Link href="/dashboard/inbox?channel=sms&compose=1">Use a phone number</Link></div></footer>
  </section>;
}
