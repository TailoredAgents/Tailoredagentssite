import Link from 'next/link';
import {Mic, ArrowRight} from 'lucide-react';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {listMeetings,meetingSettings} from '@/lib/meetings/service';
import {listMeetingDevices} from '@/lib/meetings/omi';
import {MeetingSettings} from '@/components/meetings/client';
import {MeetingIntake} from '@/components/meetings/intake';
import {formatOperationalDate} from '@/lib/operations/format';
export const metadata={title:'Meetings & notes'};
export default async function MeetingsPage({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 const c=await requireDashboardContext(),p=await searchParams,page=Math.max(1,Math.min(1000,Number(p.page)||1));
 const [data,settings,devices]=await Promise.all([listMeetings(c,(p.q||'').slice(0,120),page),meetingSettings(c),listMeetingDevices(c)]);
 return <>
  <header className="dashboard-topbar"><div><span>Sales & prospects</span><strong>Meetings & notes</strong></div></header>
  <div className="dashboard-content meeting-workspace">
   <section className="dashboard-page-heading">
    <div><span>From conversation to opportunity</span><h1>Meetings & notes</h1>
     <p>Save a recording or jot down notes from a business conversation, then choose the next step.</p>
    </div>
   </section>
   {c.role!=='viewer'&&<MeetingIntake/>}
   <section className="dashboard-panel">
    <div className="dashboard-panel-heading">
     <div><span>Your private meetings & team-shared recordings</span><h2>Recordings to review</h2></div>
     <form method="get">
      <label className="dashboard-field"><span className="sr-only">Search meetings</span>
       <input name="q" type="search" maxLength={120} defaultValue={p.q||''} placeholder="Search title or transcript…"/>
      </label>
      <button className="dashboard-secondary-button">Search</button>
     </form>
    </div>
    <div className="meeting-list">
     {data.items.length?data.items.map(m=><Link href={`/dashboard/meetings/${m.id}`} key={m.id}>
      <span className="meeting-list-icon"><Mic size={20} aria-hidden="true"/></span>
      <div><strong>{m.title}</strong><small>{m.owner_name} · {formatOperationalDate(new Date(m.created_at).toISOString())} · {m.visibility==='private'?'Private':'Team'}</small></div>
      <span className={`meeting-badge status-${m.status}`}>{m.status.replaceAll('_',' ')}</span><ArrowRight size={16} aria-hidden="true"/>
     </Link>):<div className="meeting-empty">
      <Mic size={30} aria-hidden="true"/><h3>{p.q?'No matching recordings':'No recordings yet'}</h3>
      <p>Add a recording or connect your Omi to review conversations here.</p>
     </div>}
    </div>
    <div className="meeting-action-row meeting-pagination">
     {page>1&&<Link href={`?page=${page-1}&q=${encodeURIComponent(p.q||'')}`}>Previous</Link>}
     <span>Page {page}</span>{data.hasMore&&<Link href={`?page=${page+1}&q=${encodeURIComponent(p.q||'')}`}>Next</Link>}
    </div>
   </section>
   {c.role!=='viewer'&&<MeetingSettings settings={settings} devices={JSON.parse(JSON.stringify(devices))}/>}
  </div>
 </>;
}
