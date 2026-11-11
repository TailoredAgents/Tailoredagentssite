import Link from 'next/link';
import type {DashboardContext} from '@/lib/dashboard/data';
import type {RelationshipTarget} from '@/lib/relationships/contract';
import {listEncounters} from '@/lib/relationships/capture';
import {LocalTime} from '@/components/sales/date-time-field';
export async function EncounterPanel({context,target}:{context:DashboardContext;target:RelationshipTarget}){
 const rows=await listEncounters(context,target);
 if(!rows.length&&target.kind!=='lead')return null;
 return <section className="dashboard-panel work-section"><div className="work-section-heading"><h2>Conversations & encounters</h2>{target.kind==='lead'&&<Link className="dashboard-secondary-button" href={`/dashboard/capture?lead=${target.id}`}>Capture another conversation →</Link>}</div>{rows.map(r=><article className="work-record" key={r.id}><strong>{r.event_name||r.channel.replace(/_/g,' ')}</strong><p>{r.notes}</p><p>Recorded by {r.recorded_by||'Former teammate'}{r.appointment_setter?` · Appointment setter: ${r.appointment_setter}`:''}{r.introducer?` · Introduced by ${r.introducer}`:''}</p>{r.met_at&&<small><LocalTime value={new Date(r.met_at).toISOString()}/></small>}</article>)}{!rows.length&&<p>No encounter context recorded yet.</p>}</section>;
}
