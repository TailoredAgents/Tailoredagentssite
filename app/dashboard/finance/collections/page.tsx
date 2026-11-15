import Link from 'next/link';
import financeStyles from '@/components/relationships/finance-record-list.module.css';
import {notFound} from 'next/navigation';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import {billingWorkspace} from '@/lib/billing/service';
import {billingAction} from '@/lib/billing/actions';
import {OperationForm} from '@/components/dashboard/operation-form';
import {RequestIdentity,Confirm} from '@/components/relationships/fields';
import {formatEasternTime} from '@/lib/time';
import styles from '@/components/dashboard/record-workspace.module.css';
import deliveryStyles from '@/components/dashboard/delivery-workspace.module.css';
export const metadata={title:'Collections & reconciliation'};
export default async function CollectionsPage({searchParams}:{searchParams:Promise<{page?:string}>}){
 const c=await requireDashboardContext(),q=await searchParams,page=Number(q.page||1);if(!Number.isInteger(page)||page<1||page>10000)notFound();
 const data=await billingWorkspace(c,page).catch(e=>{if(e instanceof SalesAccessError)notFound();throw e;});
 return <><header className="dashboard-topbar"><div><span>Finance</span><strong>Collections & reconciliation</strong></div></header><div className={`dashboard-content operating-workspace ${styles.workspace} ${deliveryStyles.workspace}`}><Link className="dashboard-back-link" href="/dashboard/finance">← Agreements & billing</Link>
 <section className="dashboard-record-heading work-heading"><div><span className="relationship-eyebrow">Evidence before earnings</span><h1>Collections & reconciliation</h1><p>Review customer mapping, payment evidence and covered service dates before calculating recurring commissions.</p></div></section>
 <div className="work-notice"><strong>Read-only preparation</strong><p>Imports and calculations do not issue invoices, charge customers or post commissions. Jeffrey’s Stripe connection and provider acceptance remain final activation steps.</p></div>
 <section className="dashboard-panel work-section"><h2>Payment sources</h2>{!data.connections.length&&<p>No Stripe account is connected. The tested import is ready for later configuration; existing invoice drafts remain in Agreements & billing.</p>}{data.connections.map(x=><article key={x.id} className="work-section"><h3>{x.mode==='test'?'Sandbox evidence':'Live source evidence'}</h3><p>{x.account_id} · Last full invoice listing: {x.last_scan_at?formatEasternTime(x.last_scan_at.toISOString()):'Pending'}</p>{data.manage&&<OperationForm action={billingAction} submitLabel="Request reconciliation"><RequestIdentity action="retry" values={{connectionId:x.id}}/><Confirm>Queue a source refresh and retry failed imports. This makes no provider changes.</Confirm></OperationForm>}</article>)}</section>
 <section className="dashboard-panel work-section"><h2>Imported invoices</h2>{!data.invoices.length&&<p>No invoice evidence has been imported.</p>}<div className={financeStyles.list}>{data.invoices.map(x=><Link key={x.id} href={`/dashboard/finance/collections/${x.id}`}><div><strong>{x.client||'Customer mapping needed'}</strong><small>{x.provider_id} · {x.mode} · {x.currency==='usd'?`${(Number(x.total_cents)/100).toFixed(2)} USD`:`${x.total_cents} minor units ${String(x.currency).toUpperCase()}`}</small></div><span className="dashboard-status">{x.reviewed?'Source reviewed':'Needs review'}</span></Link>)}</div><div className="work-focus-links">{page>1&&<Link href={`?page=${page-1}`}>Previous page</Link>}{data.more&&<Link href={`?page=${page+1}`}>Next page</Link>}</div></section>
 <section className="dashboard-panel work-section"><h2>Reconciliation queue</h2>{!data.jobs.length&&<p>No pending import jobs.</p>}{data.jobs.map(j=><p key={j.id}><strong>{j.kind==='scan'?'Invoice listing':j.object_id}</strong> · {j.status} · Attempt {j.attempts}{j.last_error&&<> · {String(j.last_error).replaceAll('_',' ').toLowerCase()}</>}</p>)}{data.jobsTruncated&&<p>Showing the latest 100 pending jobs.</p>}</section></div></>;
}
