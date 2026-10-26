"use client";
import { useState } from "react";
import { SmsComposer } from "@/components/sms/composer";
import { displayPhone, recipientPhones } from "@/lib/conversations/phone-options";
import { normalizePhone } from "@/lib/sales/import";
import type { ConversationRecipient, ConversationRecord, ConversationWorkspace, ConversationSource } from "@/lib/conversations/types";
import type { SmsNumber } from "@/lib/sms/types";

export function RecipientSmsComposer({ recipient, record, data, userId, readOnly, href }: {
  recipient: ConversationRecipient; record?: ConversationRecord; data: ConversationWorkspace;
  userId: string; readOnly: boolean; href: string;
}) {
  const saved = recipientPhones(recipient);
  const options: { key: string; phone: string; label: string; number: SmsNumber; source?: ConversationSource }[] = [];
  for (const source of record?.sources || []) {
    if (source.channel !== "sms" || !source.number || !source.smsRecord) continue;
    const phone = source.smsRecord.conversation.phone;
    options.push({ key: `${source.number.id}:${phone}`, phone, label: saved.find(p => p.phone === normalizePhone(phone))?.label || "Conversation number", number: source.number, source });
  }
  for (const number of data.numbers) for (const item of saved) {
    const key = `${number.id}:${item.phone}`;
    if (!options.some(o => o.key === key)) options.push({ key, phone: item.phone, label: item.label, number });
  }
  const [selected, setSelected] = useState(options[0]?.key || "");
  const [visited, setVisited] = useState<string[]>([]);
  const active = options.find(o => o.key === selected)?.key || options[0]?.key;
  if (!options.length) return <div className="conversation-channel-empty"><p>{saved.length ? "No business texting number is available for your account." : "Add a phone number to reach this person by text."}</p></div>;
  return <>
    <label className="conversation-source-picker"><span>Text to</span><select aria-label="Text to" value={active} onChange={e => { setVisited(previous => [...new Set([...previous, active!, e.target.value])]); setSelected(e.target.value); }}>
      {options.map(option => <option key={option.key} value={option.key}>{option.label} · {displayPhone(option.phone)}{data.numbers.length > 1 ? ` · from ${displayPhone(option.number.phone)}` : ""}</option>)}
    </select></label>
    {options.filter(o => o.key === active || visited.includes(o.key)).map(option => {
      const source = option.source;
      const primary = normalizePhone(recipient.phone || "") === normalizePhone(option.phone);
      const draft = source?.smsRecord?.draft || data.recipientDrafts.sms[primary ? option.number.id : option.key];
      return <div key={option.key} hidden={option.key !== active}><SmsComposer number={option.number}
        conversationId={source?.smsConversationId || source?.smsRecord?.conversation.id} phone={option.phone}
        blocked={source?.smsRecord?.conversation.blocked} draft={draft?.to && normalizePhone(draft.to) !== normalizePhone(option.phone) ? undefined : draft}
        recipient={recipient} crmConversationId={record?.conversation.id} userId={userId} readOnly={readOnly}
        conversationHref={href} compact lockRecipient /></div>;
    })}
  </>;
}
