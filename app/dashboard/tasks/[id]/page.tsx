import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, MessageSquareText } from "lucide-react";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getCallFollowUpTask } from "@/lib/voice/follow-up-tasks";
import { VoiceAccessError, VoiceInputError } from "@/lib/voice/data";
import { updateCallFollowUpTaskAction, completeCallFollowUpTaskAction } from "@/lib/voice/follow-up-actions";
import { OperationForm } from "@/components/dashboard/operation-form";
import { DateTimeField, LocalTime } from "@/components/sales/date-time-field";
import { SalesHeader, SalesPanel, SalesStatus } from "@/components/sales/workspace";
import "@/app/dashboard/sales/sales.css";
export const metadata:Metadata={title:"Call follow-up task"};
export default async function CallFollowUpPage({params}:{params:Promise<{id:string}>}) {
  const context=await requireDashboardContext(),{id}=await params;
  let task;
  try{task=await getCallFollowUpTask(context,id);}catch(error){if(error instanceof VoiceAccessError || error instanceof VoiceInputError)notFound();throw error;}
  const mutable=task.canEdit && task.status==='open';
  return <div className="sales-workspace"><SalesHeader title={task.title} active="today" subtitle={`Follow-up for ${task.customer}`}><Link className="sales-button" href="/dashboard/sales/today">My day</Link><Link className="sales-button" href={`/dashboard/inbox?conversation=${task.conversationId}`}><MessageSquareText size={15} aria-hidden="true"/>Open conversation</Link></SalesHeader><div className="sales-body">
    <SalesPanel title="Scheduled follow-up" eyebrow="Created from a reviewed call suggestion" action={<CalendarClock size={20} aria-hidden="true"/>}><div className="voice-task-facts"><SalesStatus value={task.status}>{task.status==='open'?"Open":task.status==='completed'?"Completed":"Cancelled"}</SalesStatus><p>Assigned to <strong>{task.ownerName}</strong></p><p>Due <LocalTime value={task.dueAt}/></p>{task.notes?<p>{task.notes}</p>:null}{task.outcome?<p><strong>Outcome:</strong> {task.outcome}</p>:null}</div></SalesPanel>
    {task.canEdit && task.status==='open'?<div className="sales-split voice-task-work"><SalesPanel title="Edit or reschedule" eyebrow="Keep the next step accurate"><OperationForm action={updateCallFollowUpTaskAction} submitLabel="Save task changes" disabled={!mutable}><input type="hidden" name="taskId" value={task.id}/><div className="dashboard-form-grid" key={[task.title,task.ownerId,task.dueAt,task.notes].join(":")}><label className="dashboard-field dashboard-field-full"><span>Task title *</span><input name="title" required minLength={2} maxLength={300} defaultValue={task.title}/></label><label className="dashboard-field dashboard-field-full"><span>Assign to *</span><select name="ownerUserId" required defaultValue={task.ownerId}>{!task.members.some(m=>m.id===task.ownerId)?<option value={task.ownerId} disabled>{task.ownerName} (access changed)</option>:null}{task.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><DateTimeField name="dueAt" label="Due date & time *" required defaultValue={task.dueAt}/><label className="dashboard-field dashboard-field-full"><span>Task notes</span><textarea name="notes" maxLength={4000} defaultValue={task.notes}/></label></div></OperationForm></SalesPanel><SalesPanel title="Save the outcome" eyebrow="Close the loop"><OperationForm action={completeCallFollowUpTaskAction} submitLabel="Save task outcome" disabled={!mutable}><input type="hidden" name="taskId" value={task.id}/><label className="dashboard-field"><span>Result</span><select name="status" defaultValue="completed"><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label className="dashboard-field"><span>Outcome *</span><textarea name="outcome" required minLength={2} maxLength={2000} placeholder="What happened?"/></label></OperationForm></SalesPanel></div>:null}
    {!task.canEdit?<p className="voice-phone-help">Your dashboard access is read-only.</p>:null}
  </div></div>;
}
