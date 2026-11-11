import deliveryStyles from "@/components/dashboard/delivery-workspace.module.css";
import recordStyles from "@/components/dashboard/record-workspace.module.css";
import Link from 'next/link';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {getWorkspaceMembers} from '@/lib/operations/data';
import {partnersWorkspace} from '@/lib/partners/service';
import {referralAction} from '@/lib/partners/actions';
import {OperationForm} from '@/components/dashboard/operation-form';
import {Field,RequestIdentity} from '@/components/relationships/fields';
export const metadata={title:'Partners'};
export default async function PartnersPage(){
 const context=await requireDashboardContext(),data=await partnersWorkspace(context),members=data.admin?await getWorkspaceMembers(context):[];
 return <><header className="dashboard-topbar"><div><span>Relationships</span><strong>Partners</strong></div></header><div className={`dashboard-content operating-workspace ${deliveryStyles.workspace} ${recordStyles.workspace}`}>
  <section className="work-heading dashboard-record-heading"><div><span className="relationship-eyebrow">Introductions that grow into partnerships</span><h1>Partners</h1><p>Private agreements, traceable earnings and clear statements. An introduction alone never creates a payment.</p></div><Link className="dashboard-secondary-button" href="/dashboard/sales/today">My day →</Link></section>
  {!data.full&&<p className="work-notice">Only partners explicitly shared with your account appear here. Approved statements are available within each partner’s record.</p>}
  <div className="work-cards">{data.partners.map(p=><Link className="work-card" key={p.id} href={`/dashboard/partners/${p.id}`}><span className="work-avatar">{p.name.slice(0,1)}</span><div><h2>{p.name}</h2><p>{p.organization||'Referral partner'}</p><span>Open partnership →</span></div></Link>)}</div>
  {!data.partners.length&&<section className="dashboard-panel work-empty"><h2>{data.manage?'Start with a partner':'No partner records shared yet'}</h2><p>{data.manage?'Existing introducers will appear here. Add a partner, then let the finance lead configure the agreement.':'Ask a workspace owner to grant finance access or share your specific partner record.'}</p></section>}
  {data.partners.length===200&&<p>Showing the first 200 partners.</p>}
  {data.manage&&<details className="dashboard-panel work-section"><summary>Add a partner</summary><OperationForm action={referralAction} submitLabel="Create partner"><RequestIdentity action="partner"/><div className="dashboard-form-grid dashboard-form-grid-two"><Field name="name" label="Partner name" required maxLength={160}/><Field name="organization" label="Organization (optional)" maxLength={160}/></div></OperationForm></details>}
  {data.admin&&<details className="dashboard-panel work-section"><summary>Finance access</summary><p>Owners and administrators already have finance access. Give Conner or another designated teammate access explicitly. This does not share mail or change CRM roles.</p><OperationForm action={referralAction} submitLabel="Save finance access"><RequestIdentity action="finance_access"/><div className="dashboard-form-grid dashboard-form-grid-two"><Field name="userId" label="Teammate"><select name="userId" required><option value="">Choose teammate</option>{members.filter(m=>m.role!=='viewer').map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></Field><Field name="permission" label="Finance permission"><select name="permission"><option value="read">Read finance records</option><option value="manage">Manage agreements and statements</option><option value="revoke">Remove explicit finance access</option></select></Field></div></OperationForm><ul>{data.grants.map(g=><li key={g.user_id}>{g.name} · {g.permission}</li>)}</ul></details>}
 </div></>;
}
