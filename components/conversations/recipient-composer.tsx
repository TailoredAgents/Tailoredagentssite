"use client";
import Link from "next/link";
import { useState } from "react";
import { Mail, MessageSquareText, Phone } from "lucide-react";
import { InboxComposer } from "@/components/inbox/composer";
import { SmsComposer } from "@/components/sms/composer";
import { VoiceCallComposer } from "@/components/voice/call-composer";
import type { ConversationRecord, ConversationRecipient, ConversationWorkspace } from "@/lib/conversations/types";

type Props = { recipient: ConversationRecipient; data: ConversationWorkspace; userId: string; readOnly: boolean; record?: ConversationRecord };
export function RecipientChannelComposer({ channel, recipient, data, userId, readOnly, record }: Props & { channel: "email" | "sms" | "call" }) {
  const [mailboxId, setMailboxId] = useState(data.mailboxes.find(m => m.canSend)?.id || data.mailboxes[0]?.id || "");
  const [numberId, setNumberId] = useState(data.numbers.find(n => n.canSend)?.id || data.numbers[0]?.id || "");
  const mailbox = data.mailboxes.find(m => m.id === mailboxId);
  const number = data.numbers.find(n => n.id === numberId);
  const href = `/dashboard/inbox?${recipient.kind}=${recipient.id}`;
  const common = { recipient, userId, readOnly, conversationHref: href, crmConversationId: record?.conversation.id };
  if ((channel === "email" && !recipient.email) || (channel !== "email" && !recipient.phone)) return <div className="conversation-channel-empty"><p>No {channel === "email" ? "email address" : "phone number"} is saved for {recipient.name}.</p><span>Add their contact details to use this channel.</span></div>;
  if (channel === "call") return <VoiceCallComposer record={record} recipient={recipient} />;
  if (channel === "email" && mailbox) return <>
    {data.mailboxes.length > 1 ? <label className="conversation-source-picker"><span>Send from</span><select value={mailboxId} onChange={e => setMailboxId(e.target.value)}>{data.mailboxes.map(m => <option key={m.id} value={m.id}>{m.email}{m.canSend ? "" : " · Read only"}</option>)}</select></label> : null}
    <InboxComposer key={`${recipient.id}:${mailbox.id}`} mailbox={mailbox} draft={data.recipientDrafts.email[mailbox.id]} {...common} />
  </>;
  if (channel === "sms" && number) return <>
    {data.numbers.length > 1 ? <label className="conversation-source-picker"><span>Send from</span><select value={numberId} onChange={e => setNumberId(e.target.value)}>{data.numbers.map(n => <option key={n.id} value={n.id}>{n.phone}{n.canSend ? "" : " · Read only"}</option>)}</select></label> : null}
    <SmsComposer key={`${recipient.id}:${number.id}`} number={number} phone={recipient.phone || undefined} draft={data.recipientDrafts.sms[number.id]} {...common} />
  </>;
  return <div className="conversation-channel-empty"><p>{channel === "email" ? "No shared mailbox is connected for your account yet." : "No business texting number is available for your account."}</p><Link href={channel === "email" ? "/dashboard/settings" : "/dashboard/settings#sms"}>Review {channel === "email" ? "email" : "SMS"} settings</Link></div>;
}

export function RecipientConversation(props: Props) {
  const { recipient } = props;
  const [channel, setChannel] = useState<"email" | "sms" | "call">(recipient.phone ? "sms" : "email");
  return <div className="conversation-recipient-start">
    <header className="conversation-thread-heading"><div><span className="conversation-eyebrow">{recipient.kind === "lead" ? "Lead" : "Contact"}</span><h2>{recipient.name}</h2><p>{recipient.businessName || recipient.email || recipient.phone}</p></div><Link href="/dashboard/inbox/new">Change person</Link></header>
    <div className="conversation-recipient-intro"><MessageSquareText size={26} aria-hidden="true" /><h3>Start the conversation</h3><p>Choose how to reach {recipient.name}. Their details are ready below.</p></div>
    <div className="conversation-composer-shell"><div className="conversation-composer-tabs" role="tablist" aria-label="Communication channel">{([["email","Email",Mail],["sms","SMS",MessageSquareText],["call","Call",Phone]] as const).map(([value,label,Icon],index) => <button key={value} type="button" role="tab" id={`recipient-tab-${value}`} aria-controls={`recipient-compose-${value}`} aria-selected={value === channel} tabIndex={value === channel ? 0 : -1} onClick={() => setChannel(value)} onKeyDown={e => {
      if (!["ArrowLeft","ArrowRight","Home","End"].includes(e.key)) return;
      e.preventDefault(); const tabs = ["email","sms","call"] as const; const next = tabs[e.key === "Home" ? 0 : e.key === "End" ? 2 : (index + (e.key === "ArrowRight" ? 1 : 2)) % 3]; setChannel(next); document.getElementById(`recipient-tab-${next}`)?.focus();
    }}><Icon size={16} aria-hidden="true" />{label}</button>)}</div>
      {(["email","sms","call"] as const).map(value => <div key={value} className="conversation-composer-slot" id={`recipient-compose-${value}`} role="tabpanel" aria-labelledby={`recipient-tab-${value}`} hidden={channel !== value}><RecipientChannelComposer channel={value} {...props} /></div>)}
    </div>
  </div>;
}
