"use client";

import { useState } from "react";
import { Headphones, LockKeyhole, Phone, ShieldCheck } from "lucide-react";
import { OperationForm } from "@/components/dashboard/operation-form";
import { connectVoiceLineAction, saveVoiceGrantAction, saveVoiceRoutingAction, saveRecordingPreferencesAction } from "@/lib/voice/actions";
import type { VoiceLine, VoiceWorkspace } from "@/lib/voice/types";
import "@/app/dashboard/inbox/voice.css";

function GrantEditor({ line, workspace }: { line: VoiceLine; workspace: VoiceWorkspace }) {
  const [userId, setUserId] = useState("");
  const [read, setRead] = useState(true);
  const [call, setCall] = useState(false);
  const [receive, setReceive] = useState(false);
  const [manage, setManage] = useState(false);
  return <OperationForm action={saveVoiceGrantAction} submitLabel="Save calling access" className="voice-settings-form">
    <input type="hidden" name="lineId" value={line.id} />
    <label className="voice-field"><span>Calling teammate *</span><select name="userId" required value={userId} onChange={(event) => {
      const id = event.target.value; setUserId(id); const grant = workspace.grants.find((item) => item.lineId === line.id && item.userId === id);
      setRead(grant?.canRead ?? true); setCall(grant?.canCall ?? false); setReceive(grant?.canReceive ?? false); setManage(grant?.canManageVoicemail ?? false);
    }}><option value="" disabled>Choose a teammate</option>{workspace.members.map((member) => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}</select></label>
    <div className="voice-grant-options"><label className="voice-checkbox"><input type="checkbox" name="canRead" checked={read} onChange={(event) => { setRead(event.target.checked); if (!event.target.checked) { setCall(false); setReceive(false); setManage(false); } }} /><span>Read call history, recordings and transcripts</span></label><label className="voice-checkbox"><input type="checkbox" name="canCall" checked={call} disabled={!read} onChange={(event) => setCall(event.target.checked)} /><span>Start outbound calls</span></label><label className="voice-checkbox"><input type="checkbox" name="canReceive" checked={receive} disabled={!read} onChange={(event) => setReceive(event.target.checked)} /><span>Receive calls in a connected browser</span></label><label className="voice-checkbox"><input type="checkbox" name="canManageVoicemail" checked={manage} disabled={!read} onChange={(event) => setManage(event.target.checked)} /><span>Delete call recordings and voicemail</span></label></div><p className="voice-phone-help">Dashboard viewers can read permitted history and voicemail. A calling grant does not override view-only dashboard access.</p>
  </OperationForm>;
}

function RoutingEditor({ line }: { line: VoiceLine }) {
  const [days, setDays] = useState(line.businessHours.days);
  return <OperationForm action={saveVoiceRoutingAction} submitLabel="Save call routing" className="voice-settings-form"><input type="hidden" name="lineId" value={line.id} /><input type="hidden" name="days" value={days.join(",")} />
    <div className="voice-settings-grid"><label className="voice-field"><span>Voice line status</span><select name="status" defaultValue={line.status}><option value="active">Active</option><option value="paused">Paused</option></select></label><label className="voice-field"><span>Business timezone *</span><input name="timezone" defaultValue={line.timezone} required maxLength={100} placeholder="America/New_York" /></label><label className="voice-field"><span>Business hours start *</span><input type="time" name="start" required defaultValue={line.businessHours.start} /></label><label className="voice-field"><span>Business hours end *</span><input type="time" name="end" required defaultValue={line.businessHours.end} /></label></div>
    <fieldset className="voice-business-days"><legend>Ring teammates on</legend>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((name, index) => <label key={name} className="voice-checkbox"><input type="checkbox" checked={days.includes(index)} onChange={(event) => setDays((previous) => event.target.checked ? [...previous, index].sort() : previous.filter((day) => day !== index))} /><span>{name}</span></label>)}</fieldset>
    <label className="voice-field"><span>Ring connected teammates for</span><select name="ringSeconds" defaultValue={String(line.ringSeconds)}>{[10, 15, 20, 25, 30].map((seconds) => <option value={seconds} key={seconds}>{seconds} seconds</option>)}</select></label>
    <label className="voice-field"><span>Voicemail greeting *</span><textarea name="greeting" required minLength={10} maxLength={1500} defaultValue={line.greeting} rows={4} /><small>The greeting is spoken when the caller reaches voicemail.</small></label><p className="voice-phone-help">During these hours, incoming calls ring approved teammates who have connected their browser phone. Unanswered calls and calls outside business hours go to voicemail.</p>
  </OperationForm>;
}
function RecordingEditor({line}:{line:VoiceLine}) {
  return <OperationForm action={saveRecordingPreferencesAction} submitLabel="Save recording preferences" className="voice-settings-form voice-recording-settings">
    <input type="hidden" name="lineId" value={line.id}/><h4>Recordings & transcripts</h4>
    <label className="voice-checkbox"><input type="checkbox" name="recordCalls" defaultChecked={line.recordCalls}/><span>Automatically record answered calls</span></label>
    <label className="voice-checkbox"><input type="checkbox" name="recordingAnnouncement" defaultChecked={line.recordingAnnouncement}/><span>Play a recording announcement before connecting</span></label>
    <label className="voice-checkbox"><input type="checkbox" name="autoTranscribe" defaultChecked={line.autoTranscribe}/><span>Automatically generate a transcript and summary</span></label>
    <p className="voice-phone-help">Applies to new incoming and outgoing calls. Audio, transcripts and summaries stay with the call for 90 days. Automatic analysis requires the OpenAI connection and the scheduled worker.</p>
  </OperationForm>;
}

export function VoiceSettingsPanel({ workspace }: { workspace: VoiceWorkspace }) {
  return <section id="calling" className="dashboard-panel voice-settings-panel"><div className="dashboard-panel-heading"><div><span>Business calling</span><h2>Voice & voicemail</h2></div><Headphones size={21} aria-hidden="true" /></div><div className="voice-settings-body"><p>{workspace.message}</p>
    {!workspace.canManage ? <p className="voice-phone-help"><LockKeyhole size={16} aria-hidden="true" />An owner or administrator verifies the calling line and manages teammate access and routing.</p> : <>
      <p className="voice-settings-security"><ShieldCheck size={18} aria-hidden="true" /><span>Twilio credentials and application secrets stay in the server secret store. This panel verifies the configured business number and controls its team access.</span></p>
      {!workspace.lines.length ? <OperationForm action={connectVoiceLineAction} submitLabel="Verify configured calling line" className="voice-settings-form" disabled={!workspace.configuredPhone}><label className="voice-field"><span>Configured calling number</span><input name="phone" type="tel" readOnly required value={workspace.configuredPhone || ""} placeholder="Set the approved business number in server configuration" /><small>The number must belong to the configured Twilio account and support voice.</small></label></OperationForm> : null}
      {workspace.lines.map((line) => <section className="voice-settings-line" key={line.id}><header><span className="voice-line-icon"><Phone size={19} aria-hidden="true" /></span><div><h3>{line.phone}</h3><p>{line.status === "active" ? "Verified calling line" : "Calling paused"}</p></div></header><div className="voice-line-columns"><div><h4>Teammate access</h4><div className="voice-grant-list" aria-label={`Calling access for ${line.phone}`}>{workspace.grants.filter((grant) => grant.lineId === line.id).map((grant) => <div key={grant.userId}><span><strong>{grant.name || grant.email}</strong><small>{[grant.canRead ? "Read" : "", grant.canCall ? "Call" : "", grant.canReceive ? "Receive" : "", grant.canManageVoicemail ? "Manage recordings" : ""].filter(Boolean).join(" · ")}</small></span><OperationForm action={saveVoiceGrantAction} submitLabel={`Revoke calling access for ${grant.name || grant.email}`} className="voice-revoke-form"><input type="hidden" name="lineId" value={line.id} /><input type="hidden" name="userId" value={grant.userId} /><input type="hidden" name="canRead" value="false" /><input type="hidden" name="canCall" value="false" /><input type="hidden" name="canReceive" value="false" /><input type="hidden" name="canManageVoicemail" value="false" /></OperationForm></div>)}</div><GrantEditor line={line} workspace={workspace} /></div><div><h4>Routing & voicemail</h4><RoutingEditor line={line} /></div></div></section>)}
      {workspace.lines.map(line=><RecordingEditor key={`recording:${line.id}`} line={line}/>)}
    </>}
  </div></section>;
}
