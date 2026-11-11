import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import {getStatement} from '@/lib/partners/service';
import {referralAction} from '@/lib/partners/actions';
import {OperationForm} from '@/components/dashboard/operation-form';
import {Field,RequestIdentity,Confirm,dollars,dateOnly} from '@/components/relationships/fields';
export const metadata={title:'Partner statement'};
export default async function StatementPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();const c=await requireDashboardContext();
 const d=await getStatement(c,id).catch(e=>{if(e instanceof SalesAccessError)notFound();throw e;}),s=d.statement;
 const next:Record<string,{operation:string;label:string}>={draft:{operation:'review',label:'Mark reviewed'},reviewed:{operation:'approve',label:'Approve this statement'},approved:{operation:'record_paid',label:'Record external payment or credit settlement'}};
 return <><header className="dashboard-topbar"><div><span>Partners</span><strong>Statement</strong></div></header><div className="dashboard-content operating-workspace"><Link className="dashboard-back-link" href={`/dashboard/partners/${s.partner_id}`}>← Partnership</Link><section className="work-heading"><div><span className="relationship-eyebrow">{s.status} statement</span><h1>{dollars(s.total_cents)}</h1><p>{dateOnly(s.starts_on)} – {dateOnly(s.ends_on)} · {d.items.length} source entries</p></div></section><p className="work-notice">This is an internal earnings statement. No funds are transferred by this system. Credits and negative balances need the agreed settlement process.</p>
  <section className="dashboard-panel work-section"><h2>Included source entries</h2>{d.items.map(i=><article className="work-record" key={i.earning_id}><div className="work-section-heading"><strong>{i.client_name||'Former client'} · {i.kind==='documents'?'Documents':'Other revenue'}{i.reverses_id?' · Reversal':''}</strong><strong>{dollars(i.amount_cents)}</strong></div><p>{i.source_key} · {i.earned_on} · Agreement v{i.version} · Allocation {i.allocation_bps/100}%</p><p>{i.kind==='documents'?`${i.units} eligible documents`:dollars(i.source_amount_cents)+' non-document revenue'}</p></article>)}</section>
  {d.manage&&next[s.status]&&<section className="dashboard-panel work-section"><h2>{next[s.status].label}</h2><OperationForm action={referralAction} submitLabel={next[s.status].label}><RequestIdentity action="statement_state" values={{statementId:id,revision:s.revision,expectedTotalCents:Number(s.total_cents),operation:next[s.status].operation}}/><Field name="note" label="Review or settlement note" rows={3} required/>{s.status==='approved'&&<Field name="paymentReference" label="Actual external payment or credit-settlement reference" required maxLength={500}/>}<Confirm>I reviewed these entries and the exact total of {dollars(s.total_cents)}.{s.status==='approved'?' The external settlement has already occurred.':''}</Confirm></OperationForm></section>}
  {d.manage&&['draft','reviewed'].includes(s.status)&&<details className="dashboard-panel work-section"><summary>Void this unapproved statement</summary><OperationForm action={referralAction} submitLabel="Void statement"><RequestIdentity action="statement_state" values={{statementId:id,revision:s.revision,expectedTotalCents:Number(s.total_cents),operation:'void'}}/><Field name="note" label="Reason for voiding" rows={2} required/><Confirm>Preserve this statement’s history and release its entries for a new statement.</Confirm></OperationForm></details>}
  <section className="dashboard-panel work-section"><h2>Review history</h2>{d.events.map((e,i)=><article className="work-record" key={i}><strong>{e.status} · {e.actor||'Former teammate'}</strong><p>{e.note}</p></article>)}{s.payment_reference&&<p>Settlement reference: {s.payment_reference}</p>}</section>
 </div></>;
}
