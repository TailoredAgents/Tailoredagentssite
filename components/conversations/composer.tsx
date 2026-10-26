"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MessageSquareText, Phone, StickyNote } from "lucide-react";
import { InboxComposer } from "@/components/inbox/composer";
import { SmsComposer } from "@/components/sms/composer";
import type { ConversationRecord, ConversationWorkspace } from "@/lib/conversations/types";
import { RecipientSmsComposer } from "./recipient-sms-composer";
import { RecipientChannelComposer } from "./recipient-composer";
import { ConversationNoteComposer } from "./note-composer";
import { conversationHref } from "./shared";
import { VoiceCallComposer } from "@/components/voice/call-composer";

export function ConversationComposer({ record, userId, readOnly, returnHref, data }: { record: ConversationRecord; userId: string; readOnly: boolean; returnHref?: string; data?: ConversationWorkspace }) {
  const emailSources = record.sources.filter((source) => source.channel === "email" && source.mailbox && source.mailRecord);
  const smsSources = record.sources.filter((source) => source.channel === "sms" && source.number && source.smsRecord);
  const [channel, setChannel] = useState<"email" | "sms" | "call" | "note">(emailSources.length ? "email" : smsSources.length ? "sms" : record.sources.some(source => source.channel === "call") ? "call" : "note");
  const [emailId, setEmailId] = useState(emailSources[0]?.id || "");
  const [smsId, setSmsId] = useState(smsSources[0]?.id || "");
  const email = emailSources.find((source) => source.id === emailId) || emailSources[0];
  const sms = smsSources.find((source) => source.id === smsId) || smsSources[0];
  const href = returnHref || conversationHref({ conversation: record.conversation.id });
  return <div className="conversation-composer-shell"><div className="conversation-composer-tabs" role="tablist" aria-label="Communication channel">{([ ["email", "Email", Mail], ["sms", "SMS", MessageSquareText], ["call", "Call", Phone], ["note", "Note", StickyNote] ] as const).map(([value, label, Icon]) => <button key={value} type="button" role="tab" id={`conversation-tab-${value}`} aria-selected={channel === value} aria-controls={`conversation-compose-${value}`} onClick={() => setChannel(value)} tabIndex={channel === value ? 0 : -1} onKeyDown={(event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); const tabs = ["email", "sms", "call", "note"] as const; const index = tabs.indexOf(channel); const next = event.key === "Home" ? "email" : event.key === "End" ? "note" : tabs[(index + (event.key === "ArrowRight" ? 1 : 3)) % 4]; setChannel(next); document.getElementById(`conversation-tab-${next}`)?.focus();
  }}><Icon size={16} aria-hidden="true" />{label}</button>)}</div>
    <div className="conversation-composer-slot" id="conversation-compose-email" role="tabpanel" aria-labelledby="conversation-tab-email" hidden={channel !== "email"}>
      {email?.mailbox && email.mailRecord ? <>{emailSources.length > 1 ? <label className="conversation-source-picker"><span>Reply to email thread</span><select aria-label="Reply to email thread" value={email.id} onChange={(event) => setEmailId(event.target.value)}>{emailSources.map((source) => <option key={source.id} value={source.id}>{source.mailRecord?.conversation.subject || "No subject"} · {source.label}</option>)}</select><small>Save a private draft before changing threads.</small></label> : null}<InboxComposer key={email.id} mailbox={email.mailbox} threadId={email.threadId || email.mailRecord.conversation.id} subject={email.mailRecord.conversation.subject} messages={email.mailRecord.messages} draft={email.mailRecord.draft} recipient={record.recipient} crmConversationId={record.conversation.id} userId={userId} readOnly={readOnly} conversationHref={href} compact /></> : record.recipient && data ? <RecipientChannelComposer channel="email" recipient={record.recipient} data={data} record={record} userId={userId} readOnly={readOnly} /> : <div className="conversation-channel-empty"><Mail size={22} aria-hidden="true" /><p>No readable email thread is connected to this relationship yet.</p><Link href="/dashboard/inbox?channel=email&compose=1" className="conversation-button">Start a new email</Link><small>Connect the resulting conversation to this customer after it appears.</small></div>}
    </div>
    <div className="conversation-composer-slot" id="conversation-compose-sms" role="tabpanel" aria-labelledby="conversation-tab-sms" hidden={channel !== "sms"}>
      {record.recipient && data ? <RecipientSmsComposer recipient={record.recipient} record={record} data={data} userId={userId} readOnly={readOnly} href={href}/> : sms?.number && sms.smsRecord ? <>{smsSources.length > 1 ? <label className="conversation-source-picker"><span>Text conversation</span><select aria-label="Text conversation" value={sms.id} onChange={(event) => setSmsId(event.target.value)}>{smsSources.map((source) => <option key={source.id} value={source.id}>{source.externalAddresses.join(", ")} · {source.label}</option>)}</select><small>Save a private draft before changing conversations.</small></label> : null}<SmsComposer key={sms.id} number={sms.number} conversationId={sms.smsConversationId || sms.smsRecord.conversation.id} phone={sms.smsRecord.conversation.phone} blocked={sms.smsRecord.conversation.blocked} draft={sms.smsRecord.draft} recipient={record.recipient} crmConversationId={record.conversation.id} userId={userId} readOnly={readOnly} conversationHref={href} compact /></> : record.recipient && data ? <RecipientChannelComposer channel="sms" recipient={record.recipient} data={data} record={record} userId={userId} readOnly={readOnly} /> : <div className="conversation-channel-empty"><MessageSquareText size={22} aria-hidden="true" /><p>No readable SMS conversation is connected to this relationship yet.</p><Link href="/dashboard/inbox?channel=sms&compose=1" className="conversation-button">Start a new text</Link><small>Number access and recipient opt-outs are checked before sending.</small></div>}
    </div>
    <div className="conversation-composer-slot" id="conversation-compose-call" role="tabpanel" aria-labelledby="conversation-tab-call" hidden={channel !== "call"}><VoiceCallComposer record={record} recipient={record.recipient} /></div>
    <div className="conversation-composer-slot" id="conversation-compose-note" role="tabpanel" aria-labelledby="conversation-tab-note" hidden={channel !== "note"}><ConversationNoteComposer conversationId={record.conversation.id} sources={record.sources} readOnly={readOnly} /></div>
  </div>;
}
