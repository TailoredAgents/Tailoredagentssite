"use client";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { CalendarPlus, Check, LoaderCircle, X } from "lucide-react";
import { DateTimeField } from "@/components/sales/date-time-field";
import { createCallFollowUpTaskAction, loadCallFollowUpOptionsAction, type FollowUpTaskState } from "@/lib/voice/follow-up-actions";
type Options=Awaited<ReturnType<typeof loadCallFollowUpOptionsAction>>;
const initial:FollowUpTaskState={status:"idle",message:""};
export function FollowUpTaskForm({recordingId,suggestionIndex,text,existing,readOnly}:{recordingId:string;suggestionIndex:number;text:string;existing?:{taskId:string;status:string};readOnly:boolean}) {
  const [options,setOptions]=useState<Options|null>(null),[loading,setLoading]=useState(false),[open,setOpen]=useState(false),[error,setError]=useState("");
  const [state,action,pending]=useActionState(createCallFollowUpTaskAction,initial);
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const titleId=useId(),descriptionId=useId();
  useEffect(()=>{if(open && dialog.current && !dialog.current.open)dialog.current.showModal();},[open]);
  const taskId=existing?.taskId||state.taskId||options?.taskId;
  if(taskId)return <Link className="voice-follow-up-saved" href={`/dashboard/tasks/${taskId}`}><Check size={15} aria-hidden="true"/>{existing?.status==='completed'?"Completed task":existing?.status==='cancelled'?"Cancelled task":"View scheduled task"}</Link>;
  if(readOnly)return null;
  return <div className="voice-follow-up-scheduler">
    <button ref={trigger} type="button" className="voice-text-button" disabled={loading} onClick={async()=>{setLoading(true);setError("");try{setOptions(await loadCallFollowUpOptionsAction(recordingId,suggestionIndex));setOpen(true);}catch{setError("Task options could not be loaded. Refresh to check your call access.");}finally{setLoading(false);}}}>{loading?<LoaderCircle size={15} className="signin-spinner" aria-hidden="true"/>:<CalendarPlus size={15} aria-hidden="true"/>}Create task</button>
    {open && options?<dialog ref={dialog} className="voice-follow-up-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event=>{if(pending)event.preventDefault();}} onClose={()=>{setOpen(false);trigger.current?.focus();}}>
      <header><div><span>From this call</span><h2 id={titleId}>Schedule a follow-up</h2><p id={descriptionId}>Give the next step an owner and a due date.</p></div><button type="button" className="voice-icon-button" aria-label="Close follow-up scheduler" disabled={pending} onClick={()=>dialog.current?.close()}><X size={18} aria-hidden="true"/></button></header>
      <form action={action} aria-label={`Schedule follow-up ${suggestionIndex+1}`} className="voice-follow-up-task-form" aria-busy={pending}><fieldset disabled={pending}>
      <legend className="sr-only">Follow-up details</legend><input type="hidden" name="recordingId" value={recordingId}/><input type="hidden" name="suggestionIndex" value={suggestionIndex}/>
      <label className="voice-field"><span>Task title *</span><input name="title" required minLength={2} maxLength={300} defaultValue={text.slice(0,300)}/></label>
      <label className="voice-field"><span>Assign to *</span><select name="ownerUserId" defaultValue={options.defaultOwnerId} required>{options.members.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
      <DateTimeField name="dueAt" label="Due date & time *" required/>
      <label className="voice-field"><span>Task notes (optional)</span><textarea name="notes" maxLength={4000} defaultValue={text.length>300?text:""} rows={2}/></label>
      <p className="voice-phone-help">Only teammates with access to this call are listed. Saving creates a task; it does not contact the customer.</p>
      <div className="voice-follow-up-form-actions"><button className="voice-button is-primary" type="submit">{pending?<LoaderCircle size={15} className="signin-spinner" aria-hidden="true"/>:null}{pending?"Scheduling…":"Save follow-up task"}</button><button type="button" className="voice-text-button" onClick={()=>dialog.current?.close()}>Cancel</button></div>
    </fieldset><p className={state.status==='error'?"voice-phone-error":"voice-phone-help"} role={state.status==='error'?"alert":"status"}>{state.message}</p></form></dialog>:null}
    {error?<p className="voice-phone-error" role="alert">{error}</p>:null}
  </div>;
}
