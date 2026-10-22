"use client";

import { useState } from "react";
import { Clock3, PhoneIncoming, PhoneOutgoing, Trash2, Voicemail } from "lucide-react";
import { OperationForm } from "@/components/dashboard/operation-form";
import { InboxTime } from "@/components/inbox/time";
import { deleteVoicemailAction } from "@/lib/voice/actions";
import type { VoiceCall } from "@/lib/voice/types";
import { CallRecordingPanel } from "./recording-panel";

const labels: Record<string, string> = { reserved: "Call requested", initiated: "Connecting", queued: "Queued", ringing: "Ringing", "in-progress": "Connected", completed: "Completed", busy: "Line busy", "no-answer": "No answer", canceled: "Canceled", failed: "Call failed" };
function duration(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

export function VoiceCallCard({ call, readOnly }: { call: VoiceCall; readOnly: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const voicemail = call.voicemail;
  return <div className="voice-call-card"><div className="voice-call-summary"><span className="voice-history-icon">{call.direction === "inbound" ? <PhoneIncoming size={18} aria-hidden="true" /> : <PhoneOutgoing size={18} aria-hidden="true" />}</span><div><strong>{call.direction === "inbound" ? "Incoming call" : "Outgoing call"}</strong><span>{call.from} → {call.to}</span></div><span className={`voice-call-status is-${call.status}`}>{labels[call.status] || call.status.replaceAll("_", " ")}</span></div>
    {call.duration !== null ? <p className="voice-call-duration"><Clock3 size={14} aria-hidden="true" />Call duration {duration(call.duration)}</p> : null}
    {call.recording?<CallRecordingPanel recording={call.recording} readOnly={readOnly}/>:null}
    {voicemail ? <section className="voice-voicemail" aria-label="Voicemail"><div className="voice-voicemail-heading"><h4><Voicemail size={17} aria-hidden="true" />Voicemail</h4><span>{voicemail.canPlay ? "Ready to play" : voicemail.status === "deleted" ? "Deleted" : voicemail.status === "expired" ? "Expired" : voicemail.status.replaceAll("_", " ")}</span></div>{voicemail.duration !== null ? <p>Message length {duration(voicemail.duration)}</p> : null}
      {voicemail.canPlay ? <audio controls preload="none" src={`/api/dashboard/voice/voicemails/${voicemail.id}`} aria-label="Play voicemail recording">Your browser does not support audio playback.</audio> : null}
      <p className="voice-retention">{voicemail.status === "deleted" ? "This voicemail recording has been deleted." : <>Recording retention ends <InboxTime value={voicemail.expiresAt} />.</>}</p>
      {voicemail.canDelete && !readOnly ? confirming ? <div className="voice-delete-confirmation"><p>Delete this voicemail recording?</p><OperationForm action={deleteVoicemailAction} submitLabel="Confirm voicemail deletion" className="voice-delete-form"><input type="hidden" name="voicemailId" value={voicemail.id} /></OperationForm><button type="button" className="voice-text-button" onClick={() => setConfirming(false)}>Keep recording</button></div> : <button className="voice-text-button" type="button" onClick={() => setConfirming(true)}><Trash2 size={14} aria-hidden="true" />Delete voicemail</button> : null}
    </section> : null}
  </div>;
}
