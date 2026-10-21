"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown, LoaderCircle, LockKeyhole, MessageSquareText, Save, UserRound } from "lucide-react";
import { addInboxNoteAction, saveConversationAction } from "@/lib/inbox/actions";
import type { InboxLinks, InboxMember, InboxRecord } from "@/lib/inbox/types";
import type { InboxActionState } from "@/lib/inbox/validation";
import { InboxLinkedBusiness } from "./shared";
import { InboxTime } from "./time";

const initial: InboxActionState = { status: "idle", message: "" };

export function InboxContextPanel({ record, members, links, readOnly }: { record: InboxRecord; members: InboxMember[]; links: InboxLinks; readOnly: boolean }) {
  const { conversation } = record;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(conversation.status);
  const [ownerId, setOwnerId] = useState(conversation.ownerId || "");
  const [businessId, setBusinessId] = useState(conversation.businessId || "");
  const [leadId, setLeadId] = useState(conversation.leadId || "");
  const [body, setBody] = useState("");
  const [saveState, saveAction, saving] = useActionState(saveConversationAction, initial);
  const [noteState, noteAction, noting] = useActionState(addInboxNoteAction, initial);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1250px)");
    const update = () => setOpen(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => { if (noteState.status === "success") setBody(""); }, [noteState]);
  const linkedBusiness = links.businesses.find((item) => item.id === conversation.businessId);
  const linkedLead = links.leads.find((item) => item.id === conversation.leadId);
  return <aside className="inbox-context-pane"><details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="inbox-context-details"><summary><span><UserRound size={17} aria-hidden="true" />Conversation details</span><ChevronDown size={16} aria-hidden="true" /></summary><div className="inbox-context-body">
    <form action={saveAction} aria-label="Save conversation details" aria-busy={saving}><input name="mailboxId" type="hidden" value={conversation.mailboxId} /><input name="threadId" type="hidden" value={conversation.id} /><fieldset disabled={readOnly || saving} className="inbox-context-fields"><label className="inbox-field"><span>Team status</span><select name="status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="open">Open</option><option value="waiting">Waiting for reply</option><option value="done">Done</option></select></label><label className="inbox-field"><span>Assigned teammate</span><select name="ownerId" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}</select></label><label className="inbox-field"><span>Linked business</span><select name="businessId" value={businessId} onChange={(event) => setBusinessId(event.target.value)}><option value="">No linked business</option>{links.businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label><label className="inbox-field"><span>Linked website inquiry</span><select name="leadId" value={leadId} onChange={(event) => setLeadId(event.target.value)}><option value="">No linked inquiry</option>{links.leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></label></fieldset><p className={`inbox-action-message is-${saveState.status}`} role={saveState.status === "error" ? "alert" : "status"}>{saveState.message}</p><button className="inbox-button inbox-context-save" disabled={readOnly || saving} type="submit">{saving ? <LoaderCircle className="signin-spinner" size={14} aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}Save details</button></form>
    {(linkedBusiness || linkedLead) ? <div className="inbox-linked-records"><span className="inbox-eyebrow">Connected records</span>{linkedBusiness ? <InboxLinkedBusiness {...linkedBusiness} /> : null}{linkedLead ? <Link className="inbox-record-link" href={`/dashboard/leads/${linkedLead.id}`}>{linkedLead.name}<ArrowUpRight size={14} aria-hidden="true" /></Link> : null}</div> : null}
    <p className="inbox-context-help"><LockKeyhole size={13} aria-hidden="true" />Assignment does not grant access to this mailbox.</p>
    <section className="inbox-internal-notes" aria-labelledby="inbox-note-heading"><div><h2 id="inbox-note-heading"><MessageSquareText size={16} aria-hidden="true" />Internal notes</h2><p>For your team. Never sent by email.</p></div>{record.notes.length ? <div className="inbox-notes-list">{record.notes.map((note) => <article key={note.id}><div><strong>{note.authorName}</strong><InboxTime value={note.createdAt} /></div><p>{note.body}</p></article>)}</div> : <p className="inbox-notes-empty">Add context for the next teammate who picks up this conversation.</p>}
      <form action={noteAction} aria-label="Add internal note" aria-busy={noting}><input name="mailboxId" type="hidden" value={conversation.mailboxId} /><input name="threadId" type="hidden" value={conversation.id} /><fieldset disabled={readOnly || noting} className="inbox-context-fields"><label className="inbox-field"><span>New internal note</span><textarea name="body" required maxLength={20000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Useful context, a handoff, or an agreed next step…" /></label></fieldset><p className={`inbox-action-message is-${noteState.status}`} role={noteState.status === "error" ? "alert" : "status"}>{noteState.message}</p><button className="inbox-button" type="submit" disabled={readOnly || noting}>{noting ? <LoaderCircle size={14} className="signin-spinner" aria-hidden="true" /> : <MessageSquareText size={14} aria-hidden="true" />}Add internal note</button></form>
    </section>
  </div></details></aside>;
}
