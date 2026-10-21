"use client";

import { useActionState, useState } from "react";
import { Check, KeyRound, LoaderCircle, LockKeyhole, MessageSquareText, Pause, Play, ShieldCheck, UserRoundPlus, X } from "lucide-react";
import { connectSmsNumberAction, saveSmsGrantAction, setSmsNumberStatusAction } from "@/lib/sms/actions";
import type { SmsActionState, SmsGrant, SmsNumber, SmsSettings } from "@/lib/sms/types";
import "@/app/dashboard/inbox/inbox.css";
import "@/app/dashboard/inbox/sms.css";

const initial: SmsActionState = { status: "idle", message: "" };

function Message({ state }: { state: SmsActionState }) {
  return <p className={`inbox-action-message is-${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>;
}

function NumberStatus({ number }: { number: SmsNumber }) {
  const [state, action, pending] = useActionState(setSmsNumberStatusAction, initial);
  return <form action={action} aria-label={`Change SMS status for ${number.phone}`} aria-busy={pending}><input name="numberId" type="hidden" value={number.id} /><input name="status" type="hidden" value={number.status === "paused" ? "active" : "paused"} /><button className="inbox-button" type="submit" disabled={pending}>{pending ? <LoaderCircle className="signin-spinner" size={15} aria-hidden="true" /> : number.status === "paused" ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}{number.status === "paused" ? "Resume number" : "Pause number"}</button><Message state={state} /></form>;
}

function RevokeGrant({ numberId, grant }: { numberId: string; grant: SmsGrant }) {
  const [state, action, pending] = useActionState(saveSmsGrantAction, initial);
  return <form action={action} aria-label={`Revoke SMS access for ${grant.name || grant.email}`} aria-busy={pending}><input name="numberId" type="hidden" value={numberId} /><input name="userId" type="hidden" value={grant.userId} /><input name="canRead" type="hidden" value="false" /><input name="canSend" type="hidden" value="false" /><button className="inbox-button" type="submit" disabled={pending} aria-label={`Revoke access for ${grant.name || grant.email}`}>{pending ? <LoaderCircle className="signin-spinner" size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}Revoke</button><Message state={state} /></form>;
}

function GrantNumberAccess({ number, members }: { number: SmsSettings["numbers"][number]; members: SmsSettings["members"] }) {
  const [state, action, pending] = useActionState(saveSmsGrantAction, initial);
  const [userId, setUserId] = useState("");
  const [canRead, setCanRead] = useState(true);
  const [canSend, setCanSend] = useState(false);
  return <form action={action} aria-label={`Grant SMS number access for ${number.phone}`} aria-busy={pending}><input type="hidden" name="numberId" value={number.id} /><fieldset className="inbox-context-fields" disabled={pending}><label className="inbox-field inbox-field-full"><span>Teammate *</span><select name="userId" value={userId} required onChange={(event) => {
    setUserId(event.target.value); const grant = number.grants.find((item) => item.userId === event.target.value); setCanRead(true); setCanSend(grant?.canSend || false);
  }}><option value="" disabled>Select a teammate</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}</select></label><label className="sms-settings-check"><input type="checkbox" name="canRead" checked={canRead} onChange={(event) => { setCanRead(event.target.checked); if (!event.target.checked) setCanSend(false); }} /><span>Allow reading conversations</span></label><label className="sms-settings-check"><input type="checkbox" name="canSend" checked={canSend} disabled={!canRead || pending} onChange={(event) => setCanSend(event.target.checked)} /><span>Allow sending texts</span></label></fieldset><p className="sms-settings-help">Dashboard viewers remain read-only even when a send grant is recorded. Removing read access revokes the number grant.</p><Message state={state} /><button className="inbox-button sms-settings-submit" type="submit" disabled={pending}>{pending ? <LoaderCircle className="signin-spinner" size={15} aria-hidden="true" /> : <UserRoundPlus size={15} aria-hidden="true" />}Save number access</button></form>;
}

export function SmsSettingsPanel({ settings }: { settings: SmsSettings }) {
  const [state, action, pending] = useActionState(connectSmsNumberAction, initial);
  return <section id="sms" className="dashboard-panel sms-settings-panel inbox-workspace"><div className="dashboard-panel-heading"><div><span>Business messaging</span><h2>Twilio SMS</h2></div><MessageSquareText size={21} aria-hidden="true" /></div><div className="sms-settings-body"><p>{settings.connection.message}</p>{!settings.canManage ? <p className="inbox-form-help"><LockKeyhole size={15} aria-hidden="true" />An owner or administrator manages number setup and teammate grants.</p> : <>
    <div className="sms-settings-security"><KeyRound size={18} aria-hidden="true" /><p>Provider credentials belong in the approved server secret store. This panel connects the configured number and manages access; it never accepts or displays Twilio secrets.</p></div>
    {!settings.numbers.length ? <form action={action} aria-label="Connect configured SMS number" aria-busy={pending}><fieldset className="inbox-context-fields" disabled={pending}><label className="inbox-field inbox-field-full"><span>Configured business number</span><input type="tel" name="phone" value={settings.configuredPhone || ""} readOnly required placeholder="Set the approved number in server configuration" /><small>The number is verified against the configured Twilio account before connecting.</small></label></fieldset><Message state={state} /><button className="inbox-button inbox-button-primary sms-settings-submit" type="submit" disabled={pending || !settings.configuredPhone}>{pending ? <LoaderCircle className="signin-spinner" size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}Connect configured number</button></form> : null}
    {settings.numbers.map((number) => <section className="sms-settings-number" key={number.id}><header><div><h3>{number.phone}</h3><p><ShieldCheck size={14} aria-hidden="true" />{number.status === "paused" ? "Paused" : "Connected"}{number.canSend ? " · Sending enabled" : " · Sending is paused or disabled"}</p></div><NumberStatus number={number} /></header><div className="sms-settings-grants" aria-label={`Approved teammates for ${number.phone}`}>{number.grants.length ? number.grants.map((grant) => <div key={grant.userId}><span><strong>{grant.name || grant.email}</strong><small>{grant.email} · {grant.canSend ? "Read and send" : "Read only"}</small></span><RevokeGrant numberId={number.id} grant={grant} /></div>) : <div><span><strong>No teammate access has been granted</strong><small>Grant access below before using this number in the Inbox.</small></span></div>}</div><GrantNumberAccess number={number} members={settings.members} /></section>)}
    <details className="sms-webhook-details"><summary>Incoming messages & delivery callbacks</summary><p>Set the incoming-message address as the number Messaging webhook in Twilio, using HTTP POST. The server verifies incoming requests.</p><label className="inbox-field"><span>Incoming message webhook</span><input readOnly value={settings.incomingUrl} onFocus={(event) => event.currentTarget.select()} /></label><label className="inbox-field"><span>Delivery callbacks (set automatically)</span><input readOnly value={settings.statusUrl} onFocus={(event) => event.currentTarget.select()} /></label><p>The server attaches a unique delivery callback to each outbound message. Do not paste the callback template into Twilio Console. Account messaging registration and provider readiness are confirmed by the account owner before sending is enabled.</p></details>
  </>}</div></section>;
}
