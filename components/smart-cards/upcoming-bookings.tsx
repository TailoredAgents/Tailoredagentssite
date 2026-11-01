import Link from 'next/link';
import type {upcomingBookings} from '@/lib/booking/calendar';
import {formatEasternTime} from '@/lib/time';
export function UpcomingBookings({bookings}:{bookings:Awaited<ReturnType<typeof upcomingBookings>>}){
 return <section className="dashboard-panel" style={{padding:24,marginBottom:24}}><h2>Smart Card consultations</h2><p>Confirmed phone calls from the team calendar. Call the visitor at the booked time.</p>{bookings.length?bookings.map(b=><article className="sales-task" key={b.id}><div><strong>{b.name||'Consultation'}</strong><p>{b.display_name} · {formatEasternTime(b.starts_at.toISOString())}</p>{b.phone?<a href={`tel:${b.phone.replace(/[^+\d]/g,'')}`}>{b.phone}</a>:null}</div>{b.lead_id?<Link className="sales-button" href={`/dashboard/leads/${b.lead_id}`}>Open lead</Link>:null}</article>):<p>No upcoming card consultations in the next 30 days.</p>}<Link className="sales-button" href="/dashboard/calendar">Open team calendar →</Link></section>;
}
