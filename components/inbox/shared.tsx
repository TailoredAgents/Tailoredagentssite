import Link from "next/link";
import { ArrowUpRight, Inbox, LockKeyhole, Mail, Paperclip } from "lucide-react";
import type { InboxConnection, InboxFilters, InboxMessage } from "@/lib/inbox/types";

export function inboxHref(values: InboxFilters, overrides: Record<string, string | undefined> = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...values, ...overrides })) {
    const next = Array.isArray(value) ? value[0] : value;
    if (next) query.set(key, next);
  }
  return `/dashboard/inbox${query.size ? `?${query}` : ""}`;
}

export function InboxEmpty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="inbox-empty"><span><Inbox size={26} aria-hidden="true" /></span><h2>{title}</h2>{children ? <p>{children}</p> : null}</div>;
}

export function InboxConnectionNotice({ connection }: { connection: InboxConnection }) {
  const title = connection.state === "grant_required" ? "Mailbox access is required" : connection.state === "unavailable" ? "Email is temporarily unavailable" : "Connect Tailored Mail";
  return <section className="inbox-connection"><span><LockKeyhole size={27} aria-hidden="true" /></span><div><span className="inbox-eyebrow">Your team’s email, securely connected</span><h2>{title}</h2><p>{connection.message}</p><p>Only addresses explicitly shared with your Tailored Mail account appear in this workspace.</p><a className="inbox-button" href="https://mail.tailoredagents.com" target="_blank" rel="noreferrer"><Mail size={16} aria-hidden="true" />Open Tailored Mail<ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (new tab)</span></a></div></section>;
}

export function deliveryLabel(value: string | null) {
  if (!value) return "";
  const labels: Record<string, string> = { accepted: "Accepted by email service", pending: "Send pending", queued: "Queued", sent: "Sent", delivered: "Delivered", failed: "Delivery failed", bounced: "Bounced", rejected: "Rejected", unknown: "Awaiting confirmation", complained: "Spam complaint" };
  return labels[value] || value.replaceAll("_", " ");
}

export function InboxAttachments({ mailboxId, message }: { mailboxId: string; message: InboxMessage }) {
  return message.attachments.length ? <ul className="inbox-attachments" aria-label="Message attachments">{message.attachments.map((attachment) => <li key={attachment.id}><a href={`/api/dashboard/inbox/attachments?${new URLSearchParams({ mailbox: mailboxId, message: message.id, attachment: attachment.id })}`}><Paperclip size={15} aria-hidden="true" /><span>{attachment.filename}<small>{attachment.size >= 1024 * 1024 ? `${(attachment.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(attachment.size / 1024))} KB`}</small></span><span className="sr-only">Download attachment</span></a></li>)}</ul> : null;
}

export function InboxLinkedBusiness({ id, name, clientId }: { id: string; name: string; clientId: string | null }) {
  return <Link className="inbox-record-link" href={clientId ? `/dashboard/clients/${clientId}` : `/dashboard/sales?${new URLSearchParams({ q: name, view: "table" })}`} data-business-id={id}>{name}<ArrowUpRight size={14} aria-hidden="true" /></Link>;
}
