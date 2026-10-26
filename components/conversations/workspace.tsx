"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, ArrowRight, CalendarClock, Check, ChevronLeft, ChevronRight, Inbox, Mail, MessageSquareText, PanelRightClose, PanelRightOpen, PenSquare, Phone, RefreshCw, Reply, Search, Settings2, ShieldCheck, UserRound, Users } from "lucide-react";
import { markConversationReadAction, saveConversationWorkAction } from "@/lib/conversations/actions";
import type { ConversationSummary, ConversationWorkspace as WorkspaceData } from "@/lib/conversations/types";
import { InboxTime } from "@/components/inbox/time";
import { ConversationActionForm } from "./action-form";
import { PhoneNumbers } from "./phone-numbers";
import { RecipientConversation } from "./recipient-composer";
import { ConversationComposer } from "./composer";
import { ConversationContextPanel } from "./context-panel";
import { ConversationTimeline } from "./timeline";
import { conversationHref, conversationWorkLabel, queueLabels } from "./shared";
import { useBrowserPhone } from "@/components/voice/phone-provider";

const queues = [["mine", UserRound], ["team", Users], ["unassigned", Inbox], ["needs_reply", Reply], ["unread", Mail], ["due", CalendarClock], ["reminders", CalendarClock], ["archived", Archive]] as const;

function ConnectionNotices({ entries }: { entries: WorkspaceData["sync"] }) {
  return <div className="conversation-sync-notices">{entries.map((entry, index) => <div key={`${entry.channel}:${index}:${entry.message}`} className={`conversation-sync-notice is-${entry.state}`}><span>{entry.channel === "email" ? <Mail size={16} aria-hidden="true" /> : entry.channel === "call" ? <Phone size={16} aria-hidden="true" /> : <MessageSquareText size={16} aria-hidden="true" />}<strong>{entry.channel === "email" ? "Email" : entry.channel === "call" ? "Calling" : "SMS"}</strong><span>{entry.message}</span></span><div className="conversation-sync-actions">{entry.channel === "email" ? <Link href="/dashboard/inbox?channel=email">Email workspace</Link> : null}<Link href="/dashboard/settings"><Settings2 size={15} aria-hidden="true" />Settings</Link></div></div>)}</div>;
}

function ConversationRow({ item, selected, view, q, page }: { item: ConversationSummary; selected: boolean; view: string; q: string; page: number }) {
  return <Link className={`conversation-list-item ${selected ? "is-selected" : ""} ${item.unread ? "is-unread" : ""}`} href={conversationHref({ view, q: q || undefined, page: page > 1 ? String(page) : undefined, conversation: item.id })} aria-current={selected ? "page" : undefined}>
    <span className="conversation-avatar" aria-hidden="true">{item.personName.slice(0, 1).toUpperCase()}</span>
    <div className="conversation-list-copy"><div className="conversation-list-topline"><h3>{item.personName}</h3><InboxTime value={item.lastActivityAt} short /></div>
      {item.businessName ? <span className="conversation-list-business">{item.businessName}</span> : null}<p>{item.preview || item.title}</p>
      <div className="conversation-list-meta"><span className={`conversation-state is-${item.status}`}>{conversationWorkLabel(item)}</span><span className="conversation-channel-icons">{item.channels.map((channel) => channel === "email" ? <Mail key={channel} size={14} aria-label="Email" /> : channel === "call" ? <Phone key={channel} size={14} aria-label="Call" /> : <MessageSquareText key={channel} size={14} aria-label="SMS" />)}</span>{item.unread ? <span className="conversation-unread-dot" aria-label="Unread" /> : null}</div>
      <span className="conversation-list-owner">{item.ownerName || "Unassigned"}{item.remindAt ? <><span aria-hidden="true"> · </span><CalendarClock size={12} aria-hidden="true" /><InboxTime value={item.remindAt} short /></> : null}</span>
    </div>
  </Link>;
}

export function ConversationWorkspace({ data, userId, readOnly }: { data: WorkspaceData; userId: string; readOnly: boolean }) {
  const selected = data.selected;
  const router = useRouter();
  const phone = useBrowserPhone();
  const [pane, setPane] = useState<"conversations" | "thread" | "details">(selected || data.recipient ? "thread" : "conversations");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const view = queueLabels[data.view] ? data.view : "team";
  const filters = { ...(data.recipient ? { [data.recipient.kind]: data.recipient.id } : {}), view, q: data.q || undefined, page: data.page > 1 ? String(data.page) : undefined, conversation: selected?.conversation.id, sourcePage: selected && selected.historyPage > 1 ? String(selected.historyPage) : undefined };
  const href = conversationHref({ ...filters, sourcePage: undefined });
  const attention = data.sync.filter((entry) => entry.state !== "ready");
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !navigator.onLine || document.querySelector('[aria-busy="true"]')) return;
      if (document.activeElement?.matches("input, textarea, select, [contenteditable=true]")) return;
      router.refresh();
    }, 20000);
    return () => window.clearInterval(interval);
  }, [router]);

  return <section className="conversation-workspace" aria-label="Customer conversations">
    <header className="conversation-page-header">
      <div><span className="conversation-eyebrow">Tailored Agents · Relationships</span><h1>Conversations</h1><p><strong>{data.counts.needs_reply || 0}</strong> need reply<span aria-hidden="true"> · </span><strong>{data.counts.unread || 0}</strong> unread<span className="conversation-header-reassurance"><ShieldCheck size={13} aria-hidden="true" />Shared work. Permissioned history.</span></p></div>
      <div className="conversation-header-actions"><button className="conversation-icon-button voice-inbox-launcher" type="button" aria-label="Open browser phone" onClick={() => phone.setExpanded(true)}><Phone size={18} aria-hidden="true" /></button><button className="conversation-icon-button" type="button" onClick={() => router.refresh()} aria-label="Refresh conversations"><RefreshCw size={18} aria-hidden="true" /></button><Link className="conversation-button is-primary" href="/dashboard/inbox/new"><PenSquare size={16} aria-hidden="true" /><span>New conversation</span></Link></div>
    </header>

    {attention.length ? <><div className="conversation-sync-desktop"><ConnectionNotices entries={attention} /></div><details className="conversation-sync-mobile"><summary>Channel connections<span>{attention.length} need attention</span></summary><ConnectionNotices entries={attention} /></details></> : null}

    <nav className="conversation-mobile-panes" aria-label="Conversation panes">{([["conversations", "Conversations", Inbox], ["thread", "Thread", MessageSquareText], ["details", "Details", UserRound]] as const).map(([value, label, Icon]) => <button type="button" key={value} disabled={value !== "conversations" && !selected && !data.recipient} aria-current={pane === value ? "page" : undefined} onClick={() => setPane(value)}><Icon size={16} aria-hidden="true" />{label}</button>)}</nav>

    <div className={`conversation-frame ${detailsOpen ? "" : "is-details-closed"}`} data-mobile-pane={pane}>
      <section className="conversation-list-pane" aria-label="Conversation list">
        <nav className="conversation-queues" aria-label="Conversation queues">{queues.map(([value, Icon]) => <Link href={conversationHref({ view: value, q: data.q || undefined })} key={value} className={view === value ? "is-current" : ""} aria-current={view === value ? "page" : undefined}><Icon size={15} aria-hidden="true" /><span>{queueLabels[value]}</span><strong>{(data.counts[value] || 0).toLocaleString()}</strong></Link>)}</nav>
        <form className="conversation-search" method="get" aria-label="Search customer conversations"><input type="hidden" name="view" value={view} /><label><Search size={16} aria-hidden="true" /><input aria-label="Search people, businesses or addresses" type="search" name="q" maxLength={120} defaultValue={data.q} placeholder="Search conversations…" /></label><button type="submit" aria-label="Apply conversation search"><ArrowRight size={17} aria-hidden="true" /></button></form>
        <div className="conversation-list-heading"><h2>{queueLabels[view]}</h2><span>{data.total.toLocaleString()} conversation{data.total === 1 ? "" : "s"}</span></div>
        <div className="conversation-list-scroll">{data.items.length ? data.items.map((item) => <ConversationRow key={item.id} item={item} selected={selected?.conversation.id === item.id} view={view} q={data.q} page={data.page} />) : <div className="conversation-empty is-list"><Inbox size={25} aria-hidden="true" /><h3>{data.q ? "No matching conversations" : view === "needs_reply" ? "All caught up" : "No conversations here"}</h3><p>{data.q ? "Try a customer name, business or email address." : "Connected email and SMS history will appear in your team queues."}</p>{data.q ? <Link href={conversationHref({ view })}>Clear search</Link> : null}</div>}</div>
        <nav className="conversation-pagination" aria-label="Conversation pages">{data.page > 1 ? <Link href={conversationHref({ view, q: data.q || undefined, page: String(data.page - 1) })} aria-label="Previous conversation page"><ChevronLeft size={18} aria-hidden="true" /></Link> : <span />}<span>Page {data.page} of {Math.max(1, data.pages)}</span>{data.page < data.pages ? <Link href={conversationHref({ view, q: data.q || undefined, page: String(data.page + 1) })} aria-label="Next conversation page"><ChevronRight size={18} aria-hidden="true" /></Link> : <span />}</nav>
      </section>

      <section className={`conversation-thread-pane ${data.recipientConversations.length > 1 ? "has-related-histories" : ""}`} aria-label="Selected customer conversation">{selected ? <>
        <header className="conversation-thread-heading"><div className="conversation-thread-identity"><span className="conversation-avatar" aria-hidden="true">{selected.conversation.personName.slice(0, 1).toUpperCase()}</span><div><h2>{data.recipient?.name || selected.conversation.personName}</h2><p>{selected.conversation.businessName || selected.conversation.title}</p></div></div><button className="conversation-icon-button conversation-details-toggle" type="button" aria-label={detailsOpen ? "Hide customer details" : "Show customer details"} aria-expanded={detailsOpen} onClick={() => setDetailsOpen(!detailsOpen)}>{detailsOpen ? <PanelRightClose size={19} aria-hidden="true" /> : <PanelRightOpen size={19} aria-hidden="true" />}</button></header>
        <div className="conversation-work-bar"><div><span className={`conversation-state is-${selected.conversation.status}`}>{conversationWorkLabel(selected.conversation)}</span><span className="conversation-work-owner">{selected.conversation.ownerName || "Unassigned"}</span>{selected.conversation.remindAt ? <span className="conversation-work-reminder"><CalendarClock size={14} aria-hidden="true" /><InboxTime value={selected.conversation.remindAt} /></span> : null}</div><div className="conversation-work-actions">
          {selected.conversation.unread ? <ConversationActionForm action={markConversationReadAction} label="Mark read" className="is-compact"><input type="hidden" name="conversationId" value={selected.conversation.id} /></ConversationActionForm> : <span className="conversation-read-indicator"><Check size={13} aria-hidden="true" />Read</span>}
          <ConversationActionForm action={saveConversationWorkAction} label={selected.conversation.status === "done" ? "Needs reply" : "Done"} className="is-compact" disabled={readOnly}><input type="hidden" name="conversationId" value={selected.conversation.id} /><input type="hidden" name="ownerId" value={selected.conversation.ownerId || ""} /><input type="hidden" name="status" value={selected.conversation.status === "done" ? "needs_reply" : "done"} /><input type="hidden" name="remindAt" value="" /></ConversationActionForm>
        </div></div>
        {data.recipientConversations.length > 1 ? <nav className="conversation-related-histories" aria-label="Other conversations with this person">{data.recipientConversations.map(c => <Link key={c.id} href={`/dashboard/inbox?${data.recipient!.kind}=${data.recipient!.id}&conversation=${c.id}`} aria-current={selected.conversation.id === c.id ? "page" : undefined}>{c.channels.join(" / ")} · <InboxTime value={c.lastActivityAt} short /></Link>)}</nav> : null}<ConversationTimeline key={`${selected.conversation.id}:${selected.historyPage}`} record={selected} filters={filters} readOnly={readOnly} /><ConversationComposer data={data} record={selected} userId={userId} readOnly={readOnly} returnHref={href} />
      </> : data.recipient ? <RecipientConversation recipient={data.recipient} data={data} userId={userId} readOnly={readOnly} /> : <div className="conversation-empty is-thread"><span className="conversation-empty-illustration"><MessageSquareText size={36} aria-hidden="true" /></span><h2>Your customer conversations,<br />connected.</h2><p>Choose a conversation to see its history, reply, and keep the next step moving.</p><span className="conversation-empty-channels"><Mail size={16} aria-hidden="true" />Email<span aria-hidden="true">·</span><MessageSquareText size={16} aria-hidden="true" />SMS<span aria-hidden="true">·</span>Team notes</span></div>}</section>

      <aside className="conversation-details-pane" aria-label="Customer details">{selected ? <><header className="conversation-details-heading"><h2>Customer context</h2><button className="conversation-icon-button" type="button" aria-label="Back to conversation" onClick={() => setPane("thread")}><ArrowLeft size={17} aria-hidden="true" /></button></header><ConversationContextPanel record={selected} data={data} readOnly={readOnly} /></> : data.recipient ? <div className="conversation-recipient-context"><span className="conversation-avatar">{data.recipient.name.slice(0,1)}</span><h2>{data.recipient.name}</h2><p>{data.recipient.businessName}</p><p>{data.recipient.email}</p><PhoneNumbers recipient={data.recipient} readOnly={readOnly}/>{data.recipient.kind === "lead" ? <Link href={`/dashboard/leads/${data.recipient.id}`}>Open lead</Link> : null}</div> : <div className="conversation-empty"><UserRound size={26} aria-hidden="true" /><p>Customer context and next actions appear here.</p></div>}</aside>
    </div>
  </section>;
}
