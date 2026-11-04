import type {Metadata} from 'next';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {getBookingCalendar} from '@/lib/booking/calendar';
import {BookingCalendar} from '@/components/smart-cards/calendar';
import {easternInputValue} from '@/lib/time';
import '../smart-cards/smart-cards.css';
import './calendar.css';
export const metadata:Metadata={title:'Team calendar'};
export default async function CalendarPage(){const context=await requireDashboardContext();const data=await getBookingCalendar(context);return <><header className="dashboard-topbar"><div><span>Daily work</span><strong>Team calendar</strong></div></header><div className="dashboard-content"><section className="dashboard-page-heading"><div><span>A time for the next conversation</span><h1>Team calendar</h1><p>Your team’s shared consultation calendar.</p></div></section><BookingCalendar data={data} today={easternInputValue(new Date().toISOString()).slice(0,10)}/></div></>;}
