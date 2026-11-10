import type {Metadata} from 'next';
import Link from 'next/link';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {resourceUri,scopeLabels,isWriteScope,type AssistantScope} from '@/lib/assistant/config';
import {listGoals} from '@/lib/assistant/goals';
import {findChange} from '@/lib/assistant/tools/changes';
import {assistantControl} from './actions';
import './assistant.css';
import './workspace.css';
import {AssistantWorkspace, type AssistantSection} from '@/components/assistant-workspace';
import {CheckCheck, ClipboardCheck, Link2, ShieldCheck, Target} from 'lucide-react';
export const metadata:Metadata={title:'Assistant',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
const date=(v:Date)=>v.toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'})+' Eastern';
const statuses:Record<string,string>={awaiting_approval:'Waiting for you',running:'Started — check the record before retrying',succeeded:'Completed',failed:'Not completed',outcome_unknown:'Outcome needs checking — do not retry',cancelled:'Cancelled'};
function control(operation:string,label:string,id?:string){return <form action={assistantControl}><input type="hidden" name="operation" value={operation}/><input type="hidden" name="view" value={operation==='approve'||operation==='reject'?'work':'settings'}/>{id&&<input type="hidden" name="id" value={id}/>}<button className={operation==='approve'?'dashboard-primary-button':'dashboard-secondary-button'} type="submit">{label}</button></form>;}
function Details({value}:{value:unknown}){
 if(value===null||value===undefined)return <span>None</span>;
 if(typeof value!=='object')return <span style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{String(value)}</span>;
 return <dl className="assistant-details">{Object.entries(value).map(([key,item])=><div key={key}><dt>{key.replace(/([A-Z])/g,' $1').replace(/_/g,' ')}</dt><dd><Details value={item}/></dd></div>)}</dl>;
}
type ActionRow={id:string;tool:string;execution_authority:'dashboard'|'delegated';input:unknown;review_context:unknown;status:string;result:unknown;error_code:string|null;created_at:Date;expires_at:Date;writes_paused:boolean;revoked_at:Date|null;grant_expires:Date};
const actionSelect=`SELECT a.id,a.tool,a.execution_authority,a.input,a.review_context,a.status,a.result,a.error_code,a.created_at,a.expires_at,g.writes_paused,g.revoked_at,g.expires_at grant_expires FROM assistant_actions a JOIN assistant_grants g ON g.id=a.grant_id WHERE a.user_id=$1 AND a.workspace_id=$2`;
export default async function AssistantPage({searchParams}:{searchParams:Promise<{action?:string;result?:string;page?:string;view?:string}>}){
 const context=await requireDashboardContext(),params=await searchParams;
 const page=Math.min(500,Math.max(1,Number.parseInt(params.page??'1')||1));
 const scope=[context.user.id,context.workspace.id];const db=getDatabasePool();
 const [connections,actions,goals,activity,pending]=await Promise.all([
 db.query<{id:string;name:string;scopes:AssistantScope[];expires_at:Date;revoked_at:Date|null;writes_paused:boolean;direct_actions:boolean;session_active:boolean}>(`SELECT g.id,c.name,g.scopes,g.expires_at,g.revoked_at,g.writes_paused,g.direct_actions,CASE WHEN g.authority='background' THEN g.expires_at>now() ELSE COALESCE(s."expiresAt">now(),false) END session_active FROM assistant_grants g JOIN assistant_clients c ON c.id=g.client_id LEFT JOIN "session" s ON s.id=g.session_id WHERE g.user_id=$1 AND g.workspace_id=$2 ORDER BY g.created_at DESC LIMIT 30`,scope),
 db.query<ActionRow>(`${actionSelect} ORDER BY (a.id::text=$3) DESC,a.created_at DESC,a.id LIMIT 31 OFFSET $4`,[...scope,params.action??'',(page-1)*30]),
 listGoals(context),
 db.query<{id:string;tool:string;outcome:string;created_at:Date}>(`SELECT a.id,a.tool,a.outcome,a.created_at FROM assistant_activity a JOIN assistant_grants g ON g.id=a.grant_id WHERE g.user_id=$1 AND g.workspace_id=$2 ORDER BY a.created_at DESC LIMIT 30`,scope),
 db.query<ActionRow>(`${actionSelect} AND a.status='awaiting_approval' ORDER BY (a.id::text=$3) DESC,a.created_at DESC,a.id LIMIT 51`,[...scope,params.action??'']),
 ]);
 const notice=params.result==='direct'?'Direct actions are enabled for this connection. Your bot can perform permitted work without dashboard approval.':params.result==='reviewed'?'Direct actions are off. Future changes require your review.':params.result==='unavailable'?'This change could not be completed. The proposal may have expired, changed, or lost permission. Refresh the affected record before trying again.':params.result?(statuses[params.result]??'Your connection controls were updated.'):null;
 const selectedAction=actions.rows.find(a=>a.id===params.action);
 const initialSection:AssistantSection=params.action?(selectedAction?.status==='awaiting_approval'?'work':'activity'):params.page?'activity':params.result?'settings':'chat';
 function actionCard(a:ActionRow,location:string){
  const canApprove=a.status==='awaiting_approval'&&a.expires_at>new Date()&&!a.revoked_at&&!a.writes_paused&&a.grant_expires>new Date()&&context.role!=='viewer';
  return <article className="assistant-item assistant-action-card" id={(location==='activity'?'action-':'review-')+a.id} key={a.id}>
   <div className="assistant-heading"><h3>{findChange(a.tool)?.title??a.tool}</h3><span className="assistant-status" data-tone={a.status==='succeeded'?'success':a.status==='awaiting_approval'?'warning':'neutral'}>{statuses[a.status]??a.status}</span></div>
   <p className="assistant-chat-meta">{a.execution_authority==='delegated'?'Direct action':'Reviewed proposal'} · {date(a.created_at)}</p>
   {a.status==='awaiting_approval'?<><Details value={a.review_context}/><Details value={a.input}/></>:<details><summary>Action details</summary><Details value={a.review_context}/><Details value={a.input}/></details>}
   {a.result!=null&&<details><summary>Saved result</summary><Details value={a.result}/></details>}
   {a.error_code&&<p>Receipt: {a.error_code.replace(/_/g,' ')}. Check the affected record before preparing anything again.</p>}
   {a.status==='awaiting_approval'&&<><p>Review by {date(a.expires_at)}. {a.writes_paused?'Changes are paused for this connection.':''}</p><div className="assistant-controls">{canApprove&&control('approve','Approve this change',a.id)}{control('reject','Reject',a.id)}</div></>}
  </article>;
 }
 const work={reviews:<>
  <section className="assistant-panel assistant-review-panel" aria-labelledby="assistant-review-title">
   <div className="assistant-heading"><div className="assistant-section-title"><ClipboardCheck size={20} aria-hidden="true"/><h2 id="assistant-review-title">Needs your review</h2></div><span className="assistant-status" data-tone={pending.rows.length?'warning':'success'}>{pending.rows.length?`${Math.min(50,pending.rows.length)}${pending.rows.length>50?'+':''} waiting`:'Up to date'}</span></div>
   {pending.rows.length===0?<div className="assistant-empty-inline"><CheckCheck size={22} aria-hidden="true"/><div><h3>Nothing waiting on you</h3><p>When an assignment needs approval, review its exact changes here.</p></div></div>:<><p>Check the person, record, dates, and wording before approving.</p>{pending.rows.slice(0,50).map(a=>actionCard(a,'work'))}{pending.rows.length>50&&<p>Showing the latest 50 proposals. <Link href="?view=activity">Browse all actions</Link> to see earlier proposals.</p>}</>}
  </section></>,goals:<>
  <section className="assistant-panel" aria-labelledby="assistant-goals-title"><div className="assistant-section-title"><Target size={20} aria-hidden="true"/><h2 id="assistant-goals-title">Your private goals</h2></div><p className="assistant-chat-meta">Ask your assistant to save a goal or update your progress. Only your account and authorized assistant can see it.</p>{goals.items.length===0?<p>No goals saved yet.</p>:<div className="assistant-card-grid">{goals.items.map(g=><article className="assistant-item" key={g.id}><h3>{g.title}</h3><p><span className="assistant-status">{g.status}</span>{g.dueDate?' · Due '+g.dueDate:''}</p><p>{g.notes}</p><p>{g.progress}</p></article>)}</div>}{goals.pages>1&&<p>Showing the 30 most recently updated goals. Your assistant can read additional pages.</p>}</section>
 </>};
 const activityPanel=<>
  <section className="assistant-panel"><div className="assistant-heading"><div><h2>Actions & results</h2><p className="assistant-chat-meta">A record of proposed changes and work performed through your connections.</p></div></div>{actions.rows.length===0?<div className="assistant-empty-inline"><CheckCheck size={24} aria-hidden="true"/><div><h3>Your work will leave a trail here</h3><p>Completed actions, results, and items needing attention stay available for review.</p></div></div>:actions.rows.slice(0,30).map(a=>actionCard(a,'activity'))}<nav className="assistant-controls" aria-label="Assistant activity pages">{page>1&&<Link href={'?view=activity&page='+(page-1)}>Previous</Link>}{actions.rows.length>30&&<Link href={'?view=activity&page='+(page+1)}>Next</Link>}</nav></section>
  <details className="assistant-panel assistant-access-log"><summary>Technical access log <span>Latest {activity.rows.length} calls</span></summary><p className="assistant-chat-meta">The tool and result, without copying customer messages.</p>{activity.rows.length===0?<p>No calls yet.</p>:<ul>{activity.rows.map(a=><li key={a.id}><strong>{a.tool.replace(/_/g,' ')}</strong><span>{a.outcome==='succeeded'?'Returned a result':'Unavailable'}</span><time dateTime={a.created_at.toISOString()}>{date(a.created_at)}</time></li>)}</ul>}</details>
 </>;
 const settingsPanel=<>
  <section className="assistant-panel" aria-labelledby="assistant-connections-title"><div className="assistant-heading"><div className="assistant-section-title"><ShieldCheck size={20} aria-hidden="true"/><h2 id="assistant-connections-title">Connections & permissions</h2></div>{control('stop','Pause all assistant changes')}</div><p className="assistant-chat-meta">Each connection has its own access. Pausing stops future changes; work already started may finish. Disconnecting also stops reading.</p>{connections.rows.length===0?<p>No Operations connections yet.</p>:<div className="assistant-card-grid">{connections.rows.map(c=><article className="assistant-item assistant-connection-card" key={c.id}><div className="assistant-heading"><h3>{c.name}</h3><span className="assistant-status" data-tone={c.revoked_at||!c.session_active||c.expires_at<=new Date()?'neutral':c.writes_paused?'warning':'success'}>{c.revoked_at?'Revoked':!c.session_active||c.expires_at<=new Date()?'Expired':c.writes_paused?'Changes paused':'Connected'}</span></div><p>{c.direct_actions?'Direct actions enabled':'Changes require your review'}</p><p className="assistant-chat-meta">Expires {date(c.expires_at)}</p><details><summary>View {c.scopes.length} permissions</summary><ul>{c.scopes.map(s=><li key={s}>{scopeLabels[s]??s}</li>)}</ul></details>{!c.revoked_at&&<div className="assistant-controls">{control(c.writes_paused?'resume':'pause',c.writes_paused?'Resume reviewed changes':'Pause changes',c.id)}{context.role!=='viewer'&&c.session_active&&c.expires_at>new Date()&&c.scopes.some(isWriteScope)&&control(c.direct_actions?'reviewed':'direct',c.direct_actions?'Require my review':'Enable direct actions',c.id)}{control('revoke','Disconnect',c.id)}</div>}</article>)}</div>}{connections.rows.length===30&&<p>Showing the 30 most recent connections.</p>}</section>
  <details className="assistant-panel assistant-connect-help"><summary><Link2 size={18} aria-hidden="true"/> Use the assistant through ChatGPT</summary><h2>Connect ChatGPT</h2><p>Add a separate connection named <strong>Tailored Agents Operations</strong> using this address:</p><code className="assistant-url">{resourceUri()}</code><p>Keep your existing Tailored Agents Mail connection for sending mail. Sign in with your own account and choose what Operations may access. Each connection expires with its authorizing sign-in, currently up to 14 days.</p><p>Direct actions allow permitted work without dashboard approval. Connecting alone does not activate routines. Texts and calls require separate permissions and normal usage charges apply. Built-in chat includes private memory, recurring work, research, reviewed email, and employee-connected calls through the access settings above. Paid builds and publishing are not enabled by chat.</p></details>
 </>;
 return <><header className="dashboard-topbar"><div><span>Daily work</span><strong>Assistant</strong></div></header><div className="dashboard-content assistant-page">{notice&&<p role="status" className="assistant-notice">{notice}</p>}<AssistantWorkspace name={context.user.name??'there'} initialSection={initialSection} pendingCount={pending.rows.length} work={work} activity={activityPanel} settings={settingsPanel}/></div></>;
}
