"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown, LoaderCircle, LockKeyhole, MessageSquareText, Save, UserRound } from "lucide-react";
import { addSmsNoteAction, saveSmsConversationAction } from "@/lib/sms/actions";
import type { InboxLinks, InboxMember } from "@/lib/inbox/types";
import type { SmsActionState, SmsRecord } from "@/lib/sms/types";
import { InboxLinkedBusiness } from "@/components/inbox/shared";
import { InboxTime } from "@/components/inbox/time";

const initial: SmsActionState = { status: "idle", message: "" };

export function SmsContextPanel({ record, members, links, readOnly }: { record: SmsRecord; members: InboxMember[]; links: InboxLinks; readOnly: boolean }) {
  const { conversation } = record;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(conversation.status);
  const [ownerId, setOwnerId] = useState(conversation.ownerId || "");
  const [businessId, setBusinessId] = useState(conversation.businessId || "");
  const [leadId, setLeadId] = useState(conversation.leadId || "");
  const [body, setBody] = useState("");
  const [saved, saveAction, saving] = useActionState(saveSmsConversationAction, initial);
  const [noted, noteAction, noting] = useActionState(addSmsNoteAction, initial);
  useEffect(() => {
    const media = matchMedia("(min-width: 1250px)"); const update = () => setOpen(media.matches);
    update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => { if (noted.status === "success") setBody(""); }, [noted]);
  const business = links.businesses.find((item) => item.id === conversation.businessId);
  const lead = links.leads.find((item) => item.id === conversation.leadId);
  return <aside className="inbox-context-pane"><details className="inbox-context-details" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}><summary><span><UserRound size={17} aria-hidden="true" />Conversation details</span><ChevronDown size={16} aria-hidden="true" /></summary><div className="inbox-context-body">
    <form action={saveAction} aria-label="Save SMS conversation details" aria-busy={saving}><input name="numberId" type="hidden" value={conversation.numberId} /><input name="conversationId" type="hidden" value={conversation.id} /><fieldset disabled={readOnly || saving} className="inbox-context-fields"><label className="inbox-field"><span>Team status</span><select name="status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="open">Open</option><option value="waiting">Waiting for reply</option><option value="done">Done</option></select></label><label className="inbox-field"><span>Assigned teammate</span><select name="ownerId" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">Unassigned</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name || member.email}</option>)}</select></label><label className="inbox-field"><span>Linked business</span><select name="businessId" value={businessId} onChange={(event) => setBusinessId(event.target.value)}><option value="">No linked business</option>{links.businesses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="inbox-field"><span>Linked website inquiry</span><select name="leadId" value={leadId} onChange={(event) => setLeadId(event.target.value)}><option value="">No linked inquiry</option>{links.leads.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></fieldset><p className={`inbox-action-message is-${saved.status}`} role={saved.status === "error" ? "alert" : "status"}>{saved.message}</p><button type="submit" className="inbox-button inbox-context-save" disabled={readOnly || saving}>{saving ? <LoaderCircle className="signin-spinner" size={14} aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}Save SMS details</button></form>
    <div className="inbox-linked-records"><span className="inbox-eyebrow">SMS permission</span><span className={`sms-preference-status is-${conversation.permissionState}`}>{conversation.permissionState === "blocked" ? "Recipient opted out" : conversation.permissionState === "allowed" ? "Permission recorded" : "Permission not recorded"}</span>{business ? <InboxLinkedBusiness {...business} /> : null}{lead ? <Link className="inbox-record-link" href={`/dashboard/leads/${lead.id}`}>{lead.name}<ArrowUpRight size={14} aria-hidden="true" /></Link> : null}</div><p className="inbox-context-help"><LockKeyhole size={13} aria-hidden="true" />Assignment does not grant access to this number.</p>
    <section className="inbox-internal-notes" aria-labelledby="sms-note-heading"><div><h2 id="sms-note-heading"><MessageSquareText size={16} aria-hidden="true" />Internal notes</h2><p>For your team. Never sent as a text.</p></div>{record.notes.length ? <div className="inbox-notes-list">{record.notes.map((note) => <article key={note.id}><div><strong>{note.authorName}</strong><InboxTime value={note.createdAt} /></div><p>{note.body}</p></article>)}</div> : <p className="inbox-notes-empty">Keep the useful customer context with the conversation.</p>}<form action={noteAction} aria-label="Add internal SMS note" aria-busy={noting}><input type="hidden" name="numberId" value={conversation.numberId} /><input type="hidden" name="conversationId" value={conversation.id} /><fieldset disabled={readOnly || noting} className="inbox-context-fields"><label className="inbox-field"><span>New internal note</span><textarea name="body" required maxLength={20000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Useful context, a handoff, or the agreed next step…" /></label></fieldset><p className={`inbox-action-message is-${noted.status}`} role={noted.status === "error" ? "alert" : "status"}>{noted.message}</p><button type="submit" className="inbox-button" disabled={readOnly || noting}>{noting ? <LoaderCircle className="signin-spinner" size={14} aria-hidden="true" /> : <MessageSquareText size={14} aria-hidden="true" />}Add internal note</button></form></section>
  </div></details></aside>;
}
