import Link from 'next/link';
import {z} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {listClientServices} from '@/lib/client-services/service';
import {serviceKinds} from '@/lib/client-services/contract';
import {ServiceEditor} from '@/components/relationships/service-editor';
import {dateOnly} from '@/components/relationships/fields';
export const metadata={title:'Client services'};
export default async function ServicesPage({searchParams}:{searchParams:Promise<{scope?:string;client?:string;attention?:string;page?:string}>}){
 const c=await requireDashboardContext(),p=await searchParams,scope=p.scope==='mine'?'mine':'team',clientId=z.uuid().safeParse(p.client).success?p.client:undefined,page=Math.max(1,Math.min(500,Number.parseInt(p.page||'1')||1));
 const data=await listClientServices(c,{scope,clientId,attention:p.attention==='true',page});
 function href(nextPage:number){const q=new URLSearchParams({scope,page:String(nextPage)});if(clientId)q.set('client',clientId);if(p.attention==='true')q.set('attention','true');return '?'+q;}
 return <><header className="dashboard-topbar"><div><span>Clients & delivery</span><strong>Services</strong></div></header><div className="dashboard-content operating-workspace"><section className="work-heading"><div><span className="relationship-eyebrow">Keep the partnership working</span><h1>Client services</h1><p>Active systems, responsible people, review dates and recorded outcomes.</p></div><a className="dashboard-primary-button" href="#new-service">Add service</a></section><nav className="workspace-section-links" aria-label="Service views"><Link href="?scope=team">All services</Link><Link href="?scope=mine">My services</Link><Link href="?scope=team&attention=true">Needs attention</Link></nav>
  <div className="work-cards">{data.items.map(s=><Link className="work-card" key={s.id} href={`/dashboard/services/${s.id}`}><div><span className={`work-health is-${s.health}`}>{s.health}</span><h2>{s.name}</h2><p>{s.client_name} · {serviceKinds[s.kind as keyof typeof serviceKinds]}</p><p>{s.owner||'Needs an owner'} · {s.status}</p><small>Review {dateOnly(s.next_review_on)}{s.open_incidents?` · ${s.open_incidents} open incident(s)`:''}</small></div></Link>)}</div>{!data.items.length&&<section className="dashboard-panel work-empty"><h2>No services in this view</h2><p>Add a service after agreeing its support scope and who will look after it.</p></section>}
  <nav className="workspace-section-links" aria-label="Service pages">{page>1&&<Link href={href(page-1)}>Previous</Link>}{data.hasMore&&<Link href={href(page+1)}>Next</Link>}</nav>
  <details id="new-service" className="dashboard-panel work-section"><summary>Add a client service</summary><ServiceEditor context={c} clientId={clientId}/></details>
 </div></>;
}
