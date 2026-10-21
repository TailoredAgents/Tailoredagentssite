import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Inbox, LockKeyhole, Mail, Paperclip, PenSquare, RefreshCw, Search } from "lucide-react";
import { OperationForm } from "@/components/dashboard/operation-form";
import { InboxComposer } from "@/components/inbox/composer";
import { InboxContextPanel } from "@/components/inbox/context-panel";
import { InboxAttachments, InboxConnectionNotice, InboxEmpty, deliveryLabel, inboxHref } from "@/components/inbox/shared";
import { InboxTime } from "@/components/inbox/time";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { markInboxReadAction } from "@/lib/inbox/actions";
import { listInboxWorkspace } from "@/lib/inbox/data";
import type { InboxFilters } from "@/lib/inbox/types";
import type { SmsFilters } from "@/lib/sms/types";
import { InboxChannelSwitch } from "@/components/sms/channel-switch";
import { SmsWorkspacePage } from "@/components/sms/workspace";
import "./sms.css";

export const metadata: Metadata = { title: "Team inbox" };

export default async function InboxPage({ searchParams }: { searchParams: Promise<InboxFilters & SmsFilters & { channel?: string | string[] }> }) {
  const context = await requireDashboardContext();
  const params = await searchParams;
  if ((Array.isArray(params.channel) ? params.channel[0] : params.channel) === "sms") return <SmsWorkspacePage filters={params} />;
  const data = await listInboxWorkspace(context, params);
  const composing = (Array.isArray(params.compose) ? params.compose[0] : params.compose) === "1";
  const readOnly = context.role === "viewer";
  const selected = composing ? null : data.selected;
  const base: InboxFilters = { mailbox: data.mailbox?.id, view: data.view, q: data.q || undefined, page: data.page > 1 ? String(data.page) : undefined, unread: data.unreadOnly ? "1" : undefined };
  const listHref = inboxHref(base);
  const ready = data.connection.state === "ready" && Boolean(data.mailbox);
  return <>
    <header className="dashboard-topbar"><div><span>Tailored Agents / Relationships</span><strong>Inbox</strong></div><span className="dashboard-secure"><LockKeyhole size={14} aria-hidden="true" />Private workspace</span></header>
    <div className="inbox-page-heading"><div><span className="inbox-eyebrow">Good conversations become great relationships</span><h1>Team inbox</h1><p>Shared email, clear ownership, and the customer context behind every conversation.</p></div><div>{ready ? <Link className="inbox-button" href={inboxHref(base, { thread: selected?.conversation.id, compose: composing ? "1" : undefined })}><RefreshCw size={16} aria-hidden="true" />Refresh</Link> : null}{ready && !readOnly ? <Link className="inbox-button inbox-button-primary" href={inboxHref({ mailbox: data.mailbox?.id }, { compose: "1" })}><PenSquare size={16} aria-hidden="true" />New email</Link> : null}</div></div>
    <InboxChannelSwitch active="email" />
    <div className="inbox-page-body">
      {!ready ? <InboxConnectionNotice connection={data.connection} /> : data.mailbox ? <>
        <div className="inbox-mailbox-bar"><form method="get" aria-label="Choose email mailbox"><Mail size={17} aria-hidden="true" /><label><span className="sr-only">Mailbox</span><select name="mailbox" aria-label="Mailbox" defaultValue={data.mailbox.id}>{data.mailboxes.map((mailbox) => <option key={mailbox.id} value={mailbox.id}>{mailbox.name} · {mailbox.email}</option>)}</select></label><button className="inbox-button" type="submit">Open</button></form><span className="inbox-connected"><i />Connected to Tailored Mail</span></div>
        <div className={`inbox-layout ${selected || composing ? "has-selection" : ""} ${composing ? "is-composing" : ""}`}>
          <section className="inbox-list-pane" aria-label="Email conversations"><nav className="inbox-folders" aria-label="Email folders">{([ ["inbox", "Inbox"], ["sent", "Sent"], ["archive", "Archive"] ] as const).map(([view, label]) => <Link key={view} href={inboxHref(base, { view, page: undefined, thread: undefined })} className={data.view === view ? "is-current" : ""} aria-current={data.view === view ? "page" : undefined}>{view === "inbox" ? <Inbox size={15} aria-hidden="true" /> : null}{label}</Link>)}</nav>
            <form className="inbox-search" method="get" aria-label="Filter email conversations"><input type="hidden" name="mailbox" value={data.mailbox.id} /><input type="hidden" name="view" value={data.view} /><div><label><Search size={15} aria-hidden="true" /><input type="search" name="q" aria-label="Search email conversations" maxLength={120} defaultValue={data.q} placeholder="Search email…" /></label><button type="submit" aria-label="Apply email filters"><ArrowRight size={17} aria-hidden="true" /></button></div><label className="inbox-unread-filter"><input type="checkbox" name="unread" value="1" defaultChecked={data.unreadOnly} />Unread on this page</label></form>
            <div className="inbox-list-count"><span>{data.total.toLocaleString()} conversation{data.total === 1 ? "" : "s"}</span><span>{data.unreadOnly ? `${data.items.length} unread shown` : `Page ${data.page} of ${data.pages}`}</span></div>
            <div className="inbox-thread-list">{data.items.length ? data.items.map((thread) => <Link className={`inbox-thread-link ${!thread.isRead ? "is-unread" : ""} ${selected?.conversation.id === thread.id ? "is-selected" : ""}`} href={inboxHref(base, { thread: thread.id })} key={thread.id} aria-current={selected?.conversation.id === thread.id ? "page" : undefined}><div className="inbox-thread-link-top"><span>{!thread.isRead ? <i aria-label="Unread" /> : null}{thread.participants.filter((value) => value.toLowerCase() !== data.mailbox?.email.toLowerCase()).join(", ") || thread.participants.join(", ") || "Email conversation"}</span><InboxTime value={thread.updatedAt} short /></div><h2>{thread.subject || "(No subject)"}{thread.messageCount > 1 ? <small>{thread.messageCount}</small> : null}</h2><p>{thread.preview || "Open conversation"}</p><div className="inbox-thread-link-footer"><span className={`inbox-thread-status is-${thread.status}`}>{thread.status === "waiting" ? "Waiting" : thread.status === "done" ? "Done" : "Open"}</span><span>{thread.ownerName || "Unassigned"}{thread.hasAttachments ? <Paperclip size={13} aria-label="Has attachments" /> : null}</span></div></Link>) : <InboxEmpty title={data.unreadOnly ? "No unread messages on this page" : data.q ? "No matching conversations" : "A clear inbox"}>{data.q ? "Try a different search or clear the filter." : "Email conversations from this mailbox will appear here."}</InboxEmpty>}</div>
            {data.pages > 1 ? <nav className="inbox-pagination" aria-label="Email conversation pages">{data.page > 1 ? <Link href={inboxHref(base, { page: String(data.page - 1) })}><ChevronLeft size={16} aria-hidden="true" />Previous</Link> : <span />}{data.page < data.pages ? <Link href={inboxHref(base, { page: String(data.page + 1) })}>Next<ChevronRight size={16} aria-hidden="true" /></Link> : <span />}</nav> : null}
          </section>
          <section className="inbox-thread-pane" aria-label={composing ? "New email workspace" : "Selected email conversation"}>
            {selected ? <><header className="inbox-conversation-heading"><div><Link className="inbox-mobile-back" href={listHref}><ArrowLeft size={16} aria-hidden="true" />All conversations</Link><span className="inbox-eyebrow">{data.mailbox.email}</span><h2>{selected.conversation.subject || "(No subject)"}</h2><p>{selected.messages.length} message{selected.messages.length === 1 ? "" : "s"} · {selected.conversation.ownerName ? `Assigned to ${selected.conversation.ownerName}` : "Unassigned"}</p></div>{!selected.conversation.isRead ? <OperationForm action={markInboxReadAction} submitLabel="Mark read" className="inbox-mark-read"><input type="hidden" name="mailboxId" value={data.mailbox.id} /><input type="hidden" name="threadId" value={selected.conversation.id} /></OperationForm> : <span className="inbox-read-status"><Check size={14} aria-hidden="true" />Read</span>}</header>
              <div className="inbox-messages" aria-label="Email message history">{selected.messages.map((message) => <article className={`inbox-message is-${message.direction}`} key={message.id} aria-label={`Email from ${message.fromName || message.from}`}><header><span className="inbox-sender-avatar" aria-hidden="true">{(message.fromName || message.from).trim().slice(0, 1).toUpperCase()}</span><div><h3>{message.fromName || message.from}</h3>{message.fromName ? <p>{message.from}</p> : null}<p>To: {message.to}{message.cc ? <> · Cc: {message.cc}</> : null}</p></div><InboxTime value={message.createdAt} /></header><div className="inbox-message-text">{message.text || "No text content was provided for this message."}</div><InboxAttachments mailboxId={data.mailbox!.id} message={message} />{message.direction === "outbound" && message.deliveryStatus ? <div className={`inbox-delivery is-${message.deliveryStatus}`}><span>{deliveryLabel(message.deliveryStatus)}</span>{message.deliveryDetail ? <p>{message.deliveryDetail}</p> : null}</div> : null}</article>)}</div>
              <InboxComposer key={`${data.mailbox.id}:${selected.conversation.id}`} mailbox={data.mailbox} threadId={selected.conversation.id} subject={selected.conversation.subject} messages={selected.messages} draft={selected.draft} userId={context.user.id} readOnly={readOnly} />
            </> : composing ? <><header className="inbox-conversation-heading"><div><Link className="inbox-mobile-back" href={listHref}><ArrowLeft size={16} aria-hidden="true" />All conversations</Link><span className="inbox-eyebrow">{data.mailbox.email}</span><h2>Start a conversation</h2><p>Send a personal email from your shared business address.</p></div><Link className="inbox-button" href={listHref}>Close</Link></header><InboxComposer key={`${data.mailbox.id}:compose`} mailbox={data.mailbox} draft={data.composeDraft} userId={context.user.id} readOnly={readOnly} /></> : <InboxEmpty title={params.thread ? "Conversation not available" : "Choose a conversation"}>{params.thread ? "The conversation may have moved or your mailbox access may have changed. Choose another email from the list." : "Read the history, reply from your shared address, and keep your team’s next steps connected."}</InboxEmpty>}
          </section>
          {selected ? <InboxContextPanel key={`${data.mailbox.id}:${selected.conversation.id}`} record={selected} members={data.members} links={data.links} readOnly={readOnly} /> : null}
        </div>
      </> : null}
    </div>
  </>;
}
