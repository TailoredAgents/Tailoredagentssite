import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {getMeeting} from '@/lib/meetings/access';
import {meetingPublicRecord} from '@/lib/meetings/service';
import {MeetingDetail} from '@/components/meetings/client';
export const metadata={title:'Meeting review'};
export default async function MeetingPage({params}:{params:Promise<{id:string}>}){
 const c=await requireDashboardContext(),{id}=await params;const m=await getMeeting(c,id).catch(()=>null);if(!m)notFound();
 return <><header className="dashboard-topbar"><div><span>Meetings & notes</span><strong>Review conversation</strong></div></header><div className="dashboard-content meeting-workspace"><Link className="dashboard-back-link" href="/dashboard/meetings">← Meetings & notes</Link><MeetingDetail initial={JSON.parse(JSON.stringify(meetingPublicRecord(m)))} canEdit={m.owner_user_id===c.user.id&&c.role!=='viewer'}/></div></>;
}
