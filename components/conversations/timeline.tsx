"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { History, LoaderCircle, Mail, MessageSquareText, Phone, StickyNote } from "lucide-react";
import type { ConversationFilters, ConversationRecord, ConversationTimelineItem } from "@/lib/conversations/types";
import { loadConversationSourceHistoryAction } from "@/lib/conversations/actions";
import { InboxAttachments, deliveryLabel } from "@/components/inbox/shared";
import { InboxTime } from "@/components/inbox/time";
import { smsStatusLabel } from "@/components/sms/shared";
import { conversationHref } from "./shared";
import { VoiceCallCard } from "@/components/voice/call-card";

function MessageBody({ text, email }: { text: string; email: boolean }) {
  const quoteIndex = email ? text.search(/\n(?:On [^\n]{8,}wrote:|_{5,}|-{3,}\s*Original Message)/i) : -1;
  if (quoteIndex < 1) return <div className="conversation-message-text">{text || "No text content was provided for this message."}</div>;
  return <><div className="conversation-message-text">{text.slice(0, quoteIndex)}</div><details className="conversation-quoted-email"><summary>Show quoted email history</summary><div className="conversation-message-text">{text.slice(quoteIndex)}</div></details></>;
}

function TimelineEvent({ item, record, readOnly }: { item: ConversationTimelineItem; record: ConversationRecord; readOnly: boolean }) {
  const source = record.sources.find((entry) => entry.id === item.sourceId);
  const note = item.channel === "note";
  const label = note ? "Internal note" : item.channel === "email" ? "Email" : item.channel === "call" ? "Call" : "SMS";
  const author = item.authorName || (note ? "Teammate" : item.direction === "inbound" ? record.conversation.personName : "Your team");
  return <article className={`conversation-event is-${note ? "note" : item.direction || "inbound"}`} data-channel={item.channel} aria-label={`${label} ${note ? "by" : "from"} ${author}`}>
    <header><span className="conversation-event-icon" aria-hidden="true">{note ? <StickyNote size={15} /> : item.channel === "email" ? <Mail size={15} /> : item.channel === "call" ? <Phone size={15} /> : <MessageSquareText size={15} />}</span><div><strong>{author}</strong><span>{label}{!note ? item.emailMessage?.teamOutreach ? " · Team outreach · Copied to this mailbox" : ` · ${item.direction === "outbound" ? "Outgoing" : "Incoming"}` : " · Team only"}</span></div><InboxTime value={item.createdAt} /></header>
    {item.emailMessage ? <details className="conversation-quoted-email conversation-email-addresses"><summary>To: {item.emailMessage.to}{item.emailMessage.cc ? ` · Cc: ${item.emailMessage.cc}` : ""}</summary><p>From: {item.emailMessage.from}</p><p>Mailbox: {source?.label}</p></details> : null}
    {item.subject ? <h3>{item.subject}</h3> : null}{item.voiceCall ? <VoiceCallCard call={item.voiceCall} readOnly={readOnly} /> : <MessageBody text={item.text} email={item.channel === "email"} />}
    {item.emailMessage && source?.mailboxId ? <InboxAttachments mailboxId={source.mailboxId} message={item.emailMessage} /> : null}
    {item.mediaCount ? <p className="conversation-media-notice">{item.mediaCount} media attachment{item.mediaCount === 1 ? "" : "s"} received. Media preview is unavailable in this workspace.</p> : null}
    <footer>{note ? <span>Access: {source?.label || "Source permissions apply"}</span> : <span>{source?.label || label}</span>}{item.status && item.channel !== "call" ? <span className={`conversation-delivery is-${item.status}`}>{item.channel === "sms" ? smsStatusLabel(item.status) : deliveryLabel(item.status)}</span> : null}{item.emailMessage?.deliveryDetail ? <p>{item.emailMessage.deliveryDetail}</p> : null}</footer>
  </article>;
}

export function ConversationTimeline({ record, filters, readOnly = false }: { record: ConversationRecord; filters: ConversationFilters; readOnly?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [older, setOlder] = useState<ConversationTimelineItem[]>([]);
  const [cursors, setCursors] = useState<Record<string, { before: string | null; hasOlder: boolean }>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const scrollAnchor = useRef<{ height: number; top: number } | null>(null);
  const pinned = useRef(true);
  const allowed = new Set(record.sources.map((source) => source.id));
  const items = [...new Map([...older, ...record.timeline].filter((item) => allowed.has(item.sourceId)).map((item) => [item.id, item])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (scrollAnchor.current) { node.scrollTop = scrollAnchor.current.top + node.scrollHeight - scrollAnchor.current.height; scrollAnchor.current = null; }
    else if (pinned.current) node.scrollTop = node.scrollHeight;
  }, [items.length, record.conversation.id, cursors]);
  async function loadEarlier(sourceId: string) {
    if (loading) return;
    const source = record.sources.find((item) => item.id === sourceId);
    if (!source) return;
    setLoading(sourceId); setError("");
    try {
      const result = await loadConversationSourceHistoryAction({ sourceId, before: (cursors[sourceId]?.before ?? source.before) || undefined });
      const node = ref.current;
      if (node) scrollAnchor.current = { height: node.scrollHeight, top: node.scrollTop };
      setOlder((previous) => [...previous, ...result.items]);
      setCursors((previous) => ({ ...previous, [sourceId]: { before: result.before, hasOlder: result.hasOlder } }));
    } catch { setError("Earlier history could not be loaded. Refresh to check your source access and try again."); }
    finally { setLoading(null); }
  }
  const historySources = record.sources.filter((source) => (cursors[source.id] || source).hasOlder);
  const firstHistory = (record.historyPage - 1) * 20 + 1;
  return <div className="conversation-history-region">
    {record.historyPages > 1 ? <nav className="conversation-history-pages" aria-label="Connected history pages"><div><strong>Connected histories {firstHistory}–{Math.min(record.historyPage * 20, record.historyTotal)} of {record.historyTotal}</strong><small>Replies use channels on this page. Save a private draft before changing pages.</small></div><div>{record.historyPage > 1 ? <Link href={conversationHref(filters, { sourcePage: String(record.historyPage - 1) })}>Previous histories</Link> : null}{record.historyPage < record.historyPages ? <Link href={conversationHref(filters, { sourcePage: String(record.historyPage + 1) })}>Next histories</Link> : null}</div></nav> : null}
    <div ref={ref} className="conversation-timeline" role="region" aria-label="Conversation timeline" tabIndex={0} onScroll={() => { const node = ref.current; if (node) pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100; }}>
    {historySources.length ? <div className="conversation-history-controls"><p>Load earlier history from a connected channel.</p>{historySources.map((source) => <button type="button" key={source.id} className="conversation-button" onClick={() => void loadEarlier(source.id)} disabled={Boolean(loading)} aria-busy={loading === source.id}>{loading === source.id ? <LoaderCircle className="signin-spinner" size={15} aria-hidden="true" /> : <History size={15} aria-hidden="true" />}Load earlier {source.channel === "call" ? "calls" : source.channel === "email" ? "email messages" : "SMS messages"}<span className="sr-only"> · {source.label}</span></button>)}</div> : null}
    {error ? <p className="conversation-feedback is-error" role="alert">{error}</p> : null}
    {items.length ? items.map((item) => <TimelineEvent key={item.id} item={item} record={record} readOnly={readOnly} />) : <div className="conversation-empty"><MessageSquareText size={28} aria-hidden="true" /><h3>No history to show</h3><p>History from your permitted email, SMS and calling sources will appear here.</p></div>}
  </div></div>;
}
