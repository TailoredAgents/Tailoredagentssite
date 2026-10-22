"use client";
import { useId, useState } from "react";
import { AudioLines, FileText, Sparkles, Trash2, Copy } from "lucide-react";
import { OperationForm } from "@/components/dashboard/operation-form";
import { InboxTime } from "@/components/inbox/time";
import { deleteCallRecordingAction, requestCallAnalysisAction } from "@/lib/voice/actions";
import type { CallRecording } from "@/lib/voice/types";
import { FollowUpTaskForm } from "./follow-up-task-form";

function FollowUp({text,index,recording,readOnly}:{text:string;index:number;recording:CallRecording;readOnly:boolean}) {
  const [value,setValue]=useState(text),[notice,setNotice]=useState("");
  const id=useId();
  return <div className="voice-suggested-follow-up"><label htmlFor={id}>Suggested follow-up {index+1}</label><textarea id={id} value={value} onChange={event=>setValue(event.target.value)} maxLength={1000} rows={2}/><button className="voice-text-button" type="button" onClick={async()=>{try{await navigator.clipboard.writeText(value);setNotice("Copied. Paste it into your task or reply.");}catch{setNotice("Select and copy the text above.");}}}><Copy size={14} aria-hidden="true"/>Copy follow-up</button><FollowUpTaskForm recordingId={recording.id} suggestionIndex={index} text={value} existing={recording.followUpTasks?.find(task=>task.suggestionIndex===index)} readOnly={readOnly}/><span role="status">{notice}</span></div>;
}
export function CallRecordingPanel({recording:r,readOnly}:{recording:CallRecording;readOnly:boolean}) {
  const [confirm,setConfirm]=useState(false);
  const unavailable=["deleted","deleting","expired"].includes(r.status);
  const status=r.canPlay?"Ready to play":r.status==="pending"?"Waiting for Twilio":r.status==="absent"?"No recording returned":r.status.replaceAll("_"," ");
  return <section className="voice-recording" aria-label="Call recording"><header><h4><AudioLines size={17} aria-hidden="true"/>Call recording</h4><span>{status}</span></header>
    {r.canPlay?<audio controls preload="none" src={`/api/dashboard/voice/recordings/${r.id}`} aria-label="Play call recording">Your browser does not support audio playback.</audio>:null}
    {!unavailable?<p className="voice-retention">Audio and analysis retained until <InboxTime value={r.expiresAt}/>.</p>:<p className="voice-retention">{r.status==="deleting"?"Deletion is pending. Playback and analysis are hidden.":"Audio and analysis are no longer available."}</p>}
    {r.canPlay?<details className="voice-analysis-disclosure"><summary><FileText size={15} aria-hidden="true"/>Transcript, summary & follow-ups</summary><div className="voice-call-analysis">
      {r.summary?<div className="voice-analysis-summary"><h4><Sparkles size={16} aria-hidden="true"/>Call summary</h4><p>{r.summary.summary}</p>{r.summary.highlights.map((item,i)=><details key={i}><summary>{item.text}</summary><blockquote>{item.quote}</blockquote></details>)}
        {r.summary.followUps.length?<h4>Suggested follow-ups</h4>:null}{r.summary.followUps.map((item,i)=><div key={i}><FollowUp text={item.text} index={i} recording={r} readOnly={readOnly}/><details><summary>Transcript evidence</summary><blockquote>{item.quote}</blockquote></details></div>)}<small>AI-generated. Review against the recording before using.</small></div>:null}
      {r.transcript?<details className="voice-transcript"><summary><FileText size={15} aria-hidden="true"/>Full transcript</summary><div>{r.transcript}</div></details>:null}
      {["queued","running"].includes(r.analysisStatus)?<p className="voice-phone-help" role="status">{r.analysisStatus==="running"?"Processing":"Queued for processing"} · {r.transcript?"Preparing the summary":"Preparing the transcript"}.</p>:null}
      {r.analysisError?<p className="voice-phone-error" role="status">{r.analysisError}</p>:null}
      {!["ready","queued","running"].includes(r.analysisStatus) && !readOnly?<OperationForm action={requestCallAnalysisAction} submitLabel={r.transcript?"Generate call summary":"Generate transcript & summary"} className="voice-analysis-form" disabled={!r.analysisAvailable}><input type="hidden" name="recordingId" value={r.id}/></OperationForm>:null}
      {!r.analysisAvailable && !r.summary?<p className="voice-phone-help">Connect OpenAI in Render to enable transcripts and summaries.</p>:null}
    </div></details>:null}
    {r.canDelete && !readOnly?confirm?<div className="voice-delete-confirmation"><p>Delete this recording, transcript and summary?</p><OperationForm action={deleteCallRecordingAction} submitLabel="Confirm recording deletion" className="voice-delete-form"><input type="hidden" name="recordingId" value={r.id}/></OperationForm><button className="voice-text-button" type="button" onClick={()=>setConfirm(false)}>Keep recording</button></div>:<button className="voice-text-button" type="button" onClick={()=>setConfirm(true)}><Trash2 size={14} aria-hidden="true"/>Delete recording & analysis</button>:null}
  </section>;
}
