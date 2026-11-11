import Link from 'next/link';
import {ArrowUpRight,ArrowRightLeft,Clock3} from 'lucide-react';
import {randomUUID} from 'node:crypto';
import type {DashboardContext} from '@/lib/dashboard/data';
import {OperationForm} from '@/components/dashboard/operation-form';
import {DateTimeField,LocalTime} from '@/components/sales/date-time-field';
import {getWorkspaceMembers} from '@/lib/operations/data';
import {handoffAction} from '@/lib/relationships/handoff-actions';
import {getHandoff,listHandoffs,type Handoff} from '@/lib/relationships/handoffs';
import type {RelationshipTarget} from '@/lib/relationships/contract';
import {relationshipHref} from '@/lib/relationships/overview';

export function HandoffCard({item,context,history}:{item:Handoff;context:DashboardContext;history?:Awaited<ReturnType<typeof getHandoff>>['events']}){
 const mutable=context.role!=='viewer',recipient=item.recipient_user_id===context.user.id;
 const open=['pending','accepted'].includes(item.status),overdue=open&&Date.parse(item.due_at)<Date.now();
 const canCancel=mutable&&open&&(recipient||item.created_by===context.user.id||['owner','admin'].includes(context.role));
 const identity=<><input type="hidden" name="handoffId" value={item.id}/><input type="hidden" name="revision" value={item.revision}/></>;
 return <article className={`relationship-handoff${overdue?' is-overdue':''}`}>
  <div className="relationship-handoff-top"><span className={`relationship-pill state-${item.status}`}>{item.status==='pending'?'Awaiting acceptance':item.status}</span>{overdue&&<span className="relationship-overdue">Overdue</span>}</div>
  <h3>{item.next_action}</h3><p className="relationship-customer">{item.relationship_name}</p><p><strong>{item.sender||'Former teammate'}</strong> → <strong>{item.recipient||'Unassigned'}</strong></p>
  <p className="relationship-meta"><Clock3 size={14} aria-hidden="true"/><LocalTime value={item.due_at}/></p>{item.context&&<p className="relationship-context">{item.context}</p>}
  <Link className="relationship-text-link" href={relationshipHref({kind:item.kind,id:item.target_id})}>Open relationship <ArrowUpRight size={14}/></Link>
  <div className="relationship-handoff-actions">
   {mutable&&recipient&&item.status==='pending'&&<OperationForm action={handoffAction} submitLabel="Accept handoff">{identity}<input type="hidden" name="operation" value="accept"/></OperationForm>}
   {mutable&&recipient&&item.status==='accepted'&&<details><summary>Complete handoff</summary><OperationForm action={handoffAction} submitLabel="Mark completed">{identity}<input type="hidden" name="operation" value="complete"/><label className="dashboard-field"><span>What happened?</span><textarea name="note" required minLength={2} maxLength={2000} rows={2}/></label></OperationForm></details>}
   {canCancel&&<details><summary>Cancel handoff</summary><OperationForm action={handoffAction} submitLabel="Cancel handoff">{identity}<input type="hidden" name="operation" value="cancel"/><label className="dashboard-field"><span>Reason for cancellation</span><textarea name="note" required minLength={2} maxLength={2000} rows={2}/></label></OperationForm></details>}
  </div>
  {history&&<details className="relationship-history"><summary>Handoff history</summary>{history.map((e,i)=><p key={i}><strong>{e.actor||'Former teammate'}</strong> · {e.status} · <LocalTime value={e.created_at}/>{e.note&&<span className="relationship-context">{e.note}</span>}</p>)}</details>}
 </article>;
}
export async function RequestHandoff({context,target}:{context:DashboardContext;target:RelationshipTarget}){
 const members=await getWorkspaceMembers(context);
 return <section className="dashboard-panel relationship-request" id="handoff"><div className="dashboard-panel-heading"><div><span>Keep the work moving</span><h2>Hand off the next step</h2></div><ArrowRightLeft size={20}/></div>
  <p>Give one teammate a clear next action. They accept it in My day. This does not change the sales owner, send a message or book calendar time.</p>
  <OperationForm action={handoffAction} submitLabel="Create handoff" resetOnSuccess disabled={context.role==='viewer'}>
   <input type="hidden" name="operation" value="request"/><input type="hidden" name="kind" value={target.kind}/><input type="hidden" name="id" value={target.id}/><input type="hidden" name="requestId" value={randomUUID()}/>
   <div className="dashboard-form-grid dashboard-form-grid-two">
    <label className="dashboard-field dashboard-field-full"><span>Next action</span><input name="nextAction" required minLength={2} maxLength={220} placeholder="Prepare a workflow review with the owner"/></label>
    <label className="dashboard-field dashboard-field-full"><span>Responsible teammate</span><select name="recipientUserId" required defaultValue=""><option value="" disabled>Choose a teammate</option>{members.filter(m=>m.role!=='viewer').map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label>
    <DateTimeField name="dueAt" label="Due by" required/>
    <label className="dashboard-field dashboard-field-full"><span>Context for your teammate</span><textarea name="context" maxLength={4000} rows={3} placeholder="What they need to know, what was agreed, and any open questions"/></label>
   </div>
  </OperationForm>
 </section>;
}
export async function HandoffQueue({context,scope}:{context:DashboardContext;scope:'mine'|'team'}){
 const all=await listHandoffs(context,scope),open=all.filter(h=>['pending','accepted'].includes(h.status));
 return <section className="dashboard-panel relationship-queue"><div className="dashboard-panel-heading"><div><span>{scope==='mine'?'Received & sent':'Team coordination'}</span><h2>Relationship handoffs</h2></div><span className="relationship-pill">{open.length} open</span></div>
  {open.length?<div className="relationship-queue-grid">{open.map(h=><HandoffCard key={h.id} item={h} context={context}/>)}</div>:<div className="relationship-empty">No open handoffs. Open a prospect, opportunity or client relationship to give a teammate the next step.</div>}
  {all.length===100&&<p>Showing the first 100 handoffs. Open a relationship for its history.</p>}
 </section>;
}
