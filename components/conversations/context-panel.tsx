"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarClock, ChevronDown, CircleCheck, ExternalLink, FolderKanban, Link2, Mail, MessageSquareText, Phone, UserRound } from "lucide-react";
import { linkConversationContextAction, mergeConversationsAction, saveConversationWorkAction } from "@/lib/conversations/actions";
import type { ConversationWorkspace, ConversationRecord } from "@/lib/conversations/types";
import { ConversationReminderField } from "./reminder-field";
import { InboxTime } from "@/components/inbox/time";
import { ConversationActionForm } from "./action-form";
import { safeExternalUrl, statusLabels } from "./shared";

export function ConversationContextPanel({ record, data, readOnly }: { record: ConversationRecord; data: ConversationWorkspace; readOnly: boolean }) {
  const { conversation, context, sources } = record;
  const addresses = [...new Set(sources.flatMap((source) => source.externalAddresses))];
  const personName = record.recipient?.name || conversation.personName;
  const linked = Boolean(conversation.contactId || conversation.businessId || conversation.leadId);
  const previewUrl = safeExternalUrl(context.mockup?.previewUrl);
  const formKey = [conversation.status, conversation.ownerId, conversation.remindAt, conversation.contactId, conversation.businessId, conversation.leadId].join(":");
  return <div className="conversation-context-content">
    <section className="conversation-context-person"><span className="conversation-avatar is-large" aria-hidden="true">{personName.slice(0, 1).toUpperCase()}</span><h2>{personName}</h2>{conversation.businessName ? <p>{conversation.businessName}</p> : null}<span className={`conversation-state is-${conversation.status}`}>{statusLabels[conversation.status]}</span>
      {addresses.length ? <div className="conversation-contact-methods">{addresses.map((address) => <span key={address}>{address.includes("@") ? <Mail size={14} aria-hidden="true" /> : <MessageSquareText size={14} aria-hidden="true" />}{address}</span>)}</div> : null}
    </section>

    <section className="conversation-context-section"><h3><CalendarClock size={16} aria-hidden="true" />Next action</h3>
      {context.nextTask ? <div className="conversation-next-action"><span>{context.nextTask.kind === "appointment" ? "Appointment" : "Follow-up"}</span><strong>{context.nextTask.title}</strong><InboxTime value={context.nextTask.dueAt} /></div> : <p className="conversation-muted">No scheduled follow-up or appointment.</p>}
      {conversation.remindAt ? <div className="conversation-reminder"><CalendarClock size={14} aria-hidden="true" /><span>Inbox reminder<br /><InboxTime value={conversation.remindAt} /></span></div> : null}
      {context.nextTask?.href ? <Link className="conversation-text-link" href={context.nextTask.href}>Manage follow-up<ArrowUpRight size={15} aria-hidden="true"/></Link> : context.opportunityId ? <Link className="conversation-text-link" href={`/dashboard/sales/${context.opportunityId}`}>Manage follow-ups<ArrowUpRight size={15} aria-hidden="true" /></Link> : null}
    </section>

    {(context.opportunityId || context.clientId || context.projectId || context.mockup) ? <section className="conversation-context-section"><h3><FolderKanban size={16} aria-hidden="true" />Relationship</h3>
      {context.stage ? <div className="conversation-context-pair"><span>Sales stage</span><strong>{context.stage.replaceAll("_", " ")}</strong></div> : null}
      {context.serviceInterest ? <div className="conversation-context-pair"><span>Service</span><strong>{context.serviceInterest.replaceAll("_", " ")}</strong></div> : null}
      {context.mockup ? <div className="conversation-context-pair"><span>Mockup</span><strong>{context.mockup.status.replaceAll("_", " ")}</strong></div> : null}
      <div className="conversation-record-links">{context.opportunityId ? <Link href={`/dashboard/sales/${context.opportunityId}`}>Sales record<ArrowUpRight size={14} aria-hidden="true" /></Link> : null}{context.clientId ? <Link href={`/dashboard/clients/${context.clientId}`}>Client<ArrowUpRight size={14} aria-hidden="true" /></Link> : null}{context.projectId ? <Link href={`/dashboard/projects/${context.projectId}`}>Project<ArrowUpRight size={14} aria-hidden="true" /></Link> : null}{previewUrl ? <a href={previewUrl} target="_blank" rel="noreferrer">Mockup preview<ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (new tab)</span></a> : null}</div>
    </section> : null}

    <details className="conversation-context-section conversation-disclosure" open><summary><span><UserRound size={16} aria-hidden="true" />Ownership & follow-up</span><ChevronDown size={15} aria-hidden="true" /></summary>
      <ConversationActionForm action={saveConversationWorkAction} label="Save ownership and follow-up" disabled={readOnly}>
        <div key={formKey} className="conversation-fields"><input type="hidden" name="conversationId" value={conversation.id} /><label className="conversation-field"><span>Assigned teammate</span><select name="ownerId" defaultValue={conversation.ownerId || ""}><option value="">Unassigned</option>{data.members.map((member) => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}</select></label><label className="conversation-field"><span>Work status</span><select name="status" defaultValue={conversation.status}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><ConversationReminderField defaultValue={conversation.remindAt} /></div>
      </ConversationActionForm><p className="conversation-muted">Assignment helps your team coordinate. Access still follows each email address, SMS number or calling line.</p>
    </details>

    <details className="conversation-context-section conversation-disclosure" open={!linked}><summary><span><Link2 size={16} aria-hidden="true" />{linked ? "Connected CRM records" : "Connect this conversation"}</span><ChevronDown size={15} aria-hidden="true" /></summary>
      <p className="conversation-muted">{linked ? "Keep this history connected to the correct customer." : "Choose a contact or business so your team can see the relationship behind these messages."}</p>
      <ConversationActionForm action={linkConversationContextAction} label="Save connected records" disabled={readOnly}>
        <div key={formKey} className="conversation-fields"><input type="hidden" name="conversationId" value={conversation.id} /><label className="conversation-field"><span>Contact</span><select name="contactId" defaultValue={conversation.contactId || ""}><option value="">No linked contact</option>{data.links.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label><label className="conversation-field"><span>Business</span><select name="businessId" defaultValue={conversation.businessId || ""}><option value="">No linked business</option>{data.links.businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label><label className="conversation-field"><span>Website inquiry</span><select name="leadId" defaultValue={conversation.leadId || ""}><option value="">No linked inquiry</option>{data.links.leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></label></div>
      </ConversationActionForm>{!linked ? <Link className="conversation-text-link" href="/dashboard/sales?create=1">Create a sales record<ArrowUpRight size={15} aria-hidden="true" /></Link> : null}
    </details>

    <details className="conversation-context-section conversation-disclosure"><summary><span><Mail size={16} aria-hidden="true" />Connected histories<span className="conversation-count">{record.historyTotal}</span></span><ChevronDown size={15} aria-hidden="true" /></summary>{record.historyPages > 1 ? <p className="conversation-muted">Showing page {record.historyPage} of {record.historyPages}. Use the history navigation above the timeline to open other connected threads.</p> : null}<ul className="conversation-source-list">{sources.map((source) => <li key={source.id}>{source.channel === "email" ? <Mail size={16} aria-hidden="true" /> : source.channel === "call" ? <Phone size={16} aria-hidden="true" /> : <MessageSquareText size={16} aria-hidden="true" />}<div><strong>{source.label}</strong><span>{source.externalAddresses.join(", ")}</span><small>{source.canSend ? source.channel === "call" ? "Read and call" : "Read and reply" : "Read access"}</small></div></li>)}</ul></details>

    {data.mergeTargets.some((target) => target.id !== conversation.id) ? <details className="conversation-context-section conversation-disclosure"><summary><span><Link2 size={16} aria-hidden="true" />Combine conversations</span><ChevronDown size={15} aria-hidden="true" /></summary><p className="conversation-muted">Bring another thread into the same customer conversation. Email and SMS access permissions remain in place.</p><ConversationActionForm action={mergeConversationsAction} label="Combine conversation histories" disabled={readOnly} followConversation><input type="hidden" name="conversationId" value={conversation.id} /><label className="conversation-field"><span>Move this history into</span><select name="targetConversationId" required defaultValue=""><option value="" disabled>Choose the same customer relationship</option>{data.mergeTargets.filter((target) => target.id !== conversation.id).map((target) => <option key={target.id} value={target.id}>{target.title}</option>)}</select></label><label className="conversation-checkbox"><input type="checkbox" name="confirmConflict" required /><span>I reviewed the relationship and want to combine these conversation histories.</span></label></ConversationActionForm></details> : null}
    {readOnly ? <p className="conversation-readonly"><CircleCheck size={15} aria-hidden="true" />View-only dashboard access</p> : null}
  </div>;
}
