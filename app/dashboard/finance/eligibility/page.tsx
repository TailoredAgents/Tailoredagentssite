import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import {listCustomerEligibility,eligibilityChoices} from '@/lib/commercial/eligibility';
import {eligibilityAction} from '@/lib/commercial/eligibility-actions';
import {OperationForm} from '@/components/dashboard/operation-form';
import {Field,RequestIdentity,Confirm} from '@/components/relationships/fields';
import styles from '@/components/dashboard/record-workspace.module.css';
import deliveryStyles from '@/components/dashboard/delivery-workspace.module.css';
export const metadata={title:'Customer eligibility'};
export default async function EligibilityPage({searchParams}:{searchParams:Promise<{client?:string;page?:string}>}){
 const c=await requireDashboardContext(),q=await searchParams;
 if(q.client&&!z.uuid().safeParse(q.client).success)notFound();
 const page=Number(q.page||1);if(!Number.isInteger(page)||page<1||page>10000)notFound();
 const data=await listCustomerEligibility(c,q.client,page).catch(e=>{if(e instanceof SalesAccessError)notFound();throw e;}),choices=data.manage?await eligibilityChoices(c):null;
 const url=(p:number)=>`/dashboard/finance/eligibility?page=${p}${q.client?'&client='+q.client:''}`;
 return <><header className="dashboard-topbar"><div><span>Finance</span><strong>Customer eligibility</strong></div></header><div className={`dashboard-content operating-workspace ${styles.workspace} ${deliveryStyles.workspace}`}>
 <Link className="dashboard-back-link" href="/dashboard/finance">← Agreements & billing</Link>
 <section className="dashboard-record-heading work-heading"><div><span className="relationship-eyebrow">Attribution & continuity</span><h1>Customer eligibility</h1><p>Keep each customer’s recipient, exact agreement and eligible service periods together.</p></div></section>
 <div className="work-notice"><strong>Prepare eligibility before payments</strong><p>Recorded eligibility is supporting evidence. Verified collections, customer window dates and recurring commission posting are still pending. Agreement replacements and renewals reuse the customer’s existing attribution.</p></div>
 <section className="dashboard-panel work-section"><h2>Customer records</h2>{q.client&&<Link href="/dashboard/finance/eligibility">Show all customers</Link>}{!data.records.length&&<p>No customer eligibility has been recorded yet.</p>}<div className="dashboard-card-list">{data.records.map(e=><Link href={`/dashboard/finance/eligibility/${e.id}`} key={e.id}><div><strong>{e.client} · {e.role}</strong><small>{e.recipient} · {e.document_title} · Version {e.document_version}</small></div><span className="dashboard-status">Preparation</span></Link>)}</div><div className="work-focus-links">{page>1&&<Link href={url(page-1)}>Previous page</Link>}{data.more&&<Link href={url(page+1)}>Next page</Link>}</div></section>
 {choices&&<section className="dashboard-panel work-section"><h2>Record customer attribution</h2><p>Use a signed agreement already recorded in Agreements & billing. Internal originators and managers remain employee recipients; they do not need a partner record. Exceptional splits and changes to pinned terms need separate review.</p><OperationForm action={eligibilityAction} submitLabel="Record attribution"><RequestIdentity action="create"/><div className="dashboard-form-grid dashboard-form-grid-two">
 <Field name="clientId" label="Customer"><select name="clientId" required defaultValue={q.client||''}><option value="">Choose customer</option>{choices.clients.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
 <Field name="documentId" label="Executed agreement version"><select name="documentId" required><option value="">Choose signed version</option>{choices.documents.map(x=><option key={x.id} value={x.id}>{x.title} · v{x.version} · {x.recipient}</option>)}</select></Field>
 <Field name="role" label="Commission role"><select name="role"><option value="external">External partner</option><option value="originator">Internal originator</option><option value="manager">Client manager</option></select></Field>
 <Field name="basis" label="Attribution source"><select name="basis"><option value="accepted_referral">Accepted external referral</option><option value="direct_origination">Direct origination</option><option value="partner_recruitment">External partner recruitment</option><option value="assignment">Manager assignment</option></select></Field>
 <Field name="referralId" label="Accepted referral (external or recruiter only)"><select name="referralId"><option value="">Not applicable</option>{choices.referrals.map(x=><option key={x.id} value={x.id}>{x.partner} → {x.client}</option>)}</select></Field>
 <Field name="evidence" label="Attribution evidence and approval reference" rows={3} required maxLength={4000}/></div>
 <Confirm>I checked the exact signed version, customer and source evidence.</Confirm></OperationForm>{choices.truncated&&<p>Selectors are limited to 500 entries. A missing source needs a targeted lookup before recording attribution.</p>}</section>}
 </div></>;
}
