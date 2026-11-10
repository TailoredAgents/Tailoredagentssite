import type {Metadata} from 'next';
import {z} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {getBookingCalendar} from '@/lib/booking/calendar';
import {BookingCalendar} from '@/components/smart-cards/calendar';
import {businessDateKey} from '@/lib/time';
import {viewDays,shiftDay,type CalendarView} from '@/lib/booking/display';
import '../smart-cards/smart-cards.css';
import './calendar.css';
export const metadata:Metadata={title:'Team calendar'};
export default async function CalendarPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const context=await requireDashboardContext(),q=await searchParams,today=businessDateKey();
 const day=z.iso.date().safeParse(q.date),anchor=day.success?day.data:today;
 const view:CalendarView=q.view==='day'||q.view==='month'?q.view:'week';
 const days=viewDays(anchor,view),data=await getBookingCalendar(context,{start:days[0],end:shiftDay(days.at(-1)!,1)});
 return <><header className="dashboard-topbar"><div><span>Daily work</span><strong>Team calendar</strong></div></header><div className="dashboard-content team-calendar-content"><BookingCalendar data={data} today={today} anchor={anchor} view={view}/></div></>;
}
