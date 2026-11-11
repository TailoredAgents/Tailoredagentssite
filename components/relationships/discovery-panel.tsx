import type {DashboardContext} from '@/lib/dashboard/data';
import {OperationForm} from '@/components/dashboard/operation-form';
import {getWorkspaceMembers} from '@/lib/operations/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {formatOperationalDate} from '@/lib/operations/format';
import {readRelationship} from '@/lib/relationships/service';
import {discoveryFields,type RelationshipTarget} from '@/lib/relationships/contract';
import {relationshipAction} from '@/lib/relationships/actions';
import Link from 'next/link';
import {relationshipHref} from '@/lib/relationships/overview';
export async function DiscoveryPanel({context,target,showOverview=true}:{context:DashboardContext;target:RelationshipTarget;showOverview?:boolean}){
 const data=await readRelationship(context,target),mutable=context.role!=='viewer';
 const ids=data.related.map(r=>r.id);
 const meetings=(await getDatabasePool().query(`SELECT id,title FROM meetings WHERE workspace_id=$1 AND (owner_user_id=$2 OR visibility='team') AND status NOT IN ('deleting','deleted') AND expires_at>now() AND (lead_id=ANY($3::uuid[]) OR business_id=ANY($3::uuid[]) OR opportunity_id=ANY($3::uuid[]) OR client_id=ANY($3::uuid[]) OR contact_id=ANY($3::uuid[])) ORDER BY created_at DESC LIMIT 20`,[context.workspace.id,context.user.id,ids])).rows;
 const members=target.kind==='client'?await getWorkspaceMembers(context):[];
 const client=target.kind==='client'?(await getDatabasePool().query('SELECT account_manager_user_id,updated_at FROM clients WHERE id=$1 AND workspace_id=$2',[target.id,context.workspace.id])).rows[0]:null;
 const manager=client?.account_manager_user_id;
 const identity=<><input type="hidden" name="kind" value={target.kind}/><input type="hidden" name="id" value={target.id}/></>;
 return <section className="dashboard-panel relationship-panel" id="business-discovery">
 {showOverview&&<Link className="relationship-open-link" href={relationshipHref(target)}>Open relationship overview <span>People, next steps, handoffs & delivery →</span></Link>}
 <div className="dashboard-panel-heading"><div><span>Relationships & discovery</span><h2>Understand the business</h2></div></div>
 <div className="relationship-content"><p>Keep what you learned, the people who introduced you, and the next conversation connected. Existing notes stay where they are.</p>
 {meetings.length>0&&<details open><summary>Linked meetings you can access · {meetings.length}</summary>{meetings.map(m=><p key={m.id}><Link href={`/dashboard/meetings/${m.id}`}>{m.title} → Review recording & findings</Link></p>)}</details>}
 <details><summary>Record a discovery conversation</summary><OperationForm action={relationshipAction} submitLabel="Save discovery notes" resetOnSuccess disabled={!mutable}>{identity}<input type="hidden" name="operation" value="discovery"/>
 <p>Record information you learned directly. Keep possible automations in the ideas field; a suggestion is not a confirmed requirement.</p><div className="dashboard-form-grid dashboard-form-grid-two">{Object.entries(discoveryFields).map(([key,label])=><label className="dashboard-field" key={key}><span>{label}</span><textarea name={key} maxLength={4000} rows={3}/></label>)}</div></OperationForm></details>
 {data.notes.length?<details open><summary>Discovery history · {data.notes.length}{data.notes.length===100?' (latest 100)':''}</summary>{data.notes.map(n=><article className="relationship-note" key={n.id}><strong>{n.author||'Team member'} · {formatOperationalDate(new Date(n.created_at).toISOString())}</strong><small>Team-recorded information · original notes preserved</small><dl>{Object.entries(discoveryFields).map(([key,label])=>n.fields[key]?<div key={key}><dt>{label}</dt><dd>{String(n.fields[key])}</dd></div>:null)}</dl></article>)}</details>:null}
 <details><summary>Introductions & referral partners{data.introductions.length?` · ${data.introductions.length}`:''}</summary><p>An introducer is separate from the sales owner and account manager. No commission or payment terms are implied.</p>
 {data.introductions.map(i=><article className="relationship-note" key={i.id}><strong>{i.name}{i.organization?` · ${i.organization}`:''}</strong><p>{i.note}</p><small>Recorded {formatOperationalDate(new Date(i.created_at).toISOString())}</small></article>)}
 <OperationForm action={relationshipAction} submitLabel="Record introduction" resetOnSuccess disabled={!mutable}>{identity}<input type="hidden" name="operation" value="referral"/><div className="dashboard-form-grid dashboard-form-grid-two"><label className="dashboard-field"><span>Existing referral partner</span><select name="partnerId"><option value="">Add a new person below</option>{data.partners.map(p=><option value={p.id} key={p.id}>{p.name}{p.organization?` · ${p.organization}`:''}</option>)}</select></label><label className="dashboard-field"><span>New introducer’s name</span><input name="name" maxLength={160}/></label><label className="dashboard-field"><span>Their organization (optional)</span><input name="organization" maxLength={160}/></label><label className="dashboard-field"><span>How they introduced us</span><textarea name="note" maxLength={2000}/></label></div></OperationForm></details>
 {target.kind==='client'?<details><summary>Account manager</summary><OperationForm action={relationshipAction} submitLabel="Save account manager" disabled={!mutable}><input type="hidden" name="operation" value="manager"/><input type="hidden" name="clientId" value={target.id}/><input type="hidden" name="expectedUpdatedAt" value={client?.updated_at?.toISOString()}/><label className="dashboard-field"><span>Client relationship owner</span><select name="userId" defaultValue={manager||''}><option value="">Unassigned</option>{members.filter(m=>m.role!=='viewer').map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><p>Sales ownership and project delivery ownership are managed separately on those records.</p></OperationForm></details>:null}
 </div></section>;
}
