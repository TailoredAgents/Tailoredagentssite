import {DailyWorkFocus,ServiceAttention} from '@/components/relationships/daily-work';
import {HandoffQueue} from "@/components/relationships/handoffs";
import {upcomingBookings} from "@/lib/booking/calendar";
import {UpcomingBookings} from "@/components/smart-cards/upcoming-bookings";
import { getIntroductionCalls } from "@/lib/lead-intro/data";
import { LeadIntroCalls } from "@/components/lead-intro-calls";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, ChevronDown, Phone, Plus, Sparkles } from "lucide-react";
import { LocalTime } from "@/components/sales/date-time-field";
import { OpportunityTable } from "@/components/sales/opportunity-list";
import { SalesEmpty, SalesPanel, SalesStatus } from "@/components/sales/workspace";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getSalesToday } from "@/lib/sales/data";
import { getFactoryWorkNotices } from "@/lib/factory/work-notices";
import { FactoryWorkNotices } from "@/components/factory/work-notices";
import "@/app/dashboard/factory.css";
import styles from "./today.module.css";

export const metadata: Metadata = { title: "My day" };

export default async function SalesTodayPage({ searchParams }: { searchParams: Promise<{ scope?: string | string[] }> }) {
  const context = await requireDashboardContext();
  const params = await searchParams;
  const scope = params.scope === "team" ? "team" : "mine";
  const [data, notices, introCalls, bookings] = await Promise.all([getSalesToday(context, scope),getFactoryWorkNotices(context, scope),getIntroductionCalls(context,scope),upcomingBookings(context,scope)]);
  return <>
    <header className="dashboard-topbar"><div><span>Daily work</span><strong>My day</strong></div></header>
    <div className={`sales-body ${styles.workspace}`}>
      <header className={styles.heading}><div><h1>{scope === "mine" ? "Your day" : "The team’s day"}</h1><p>{scope === "mine" ? `${context.user.name.split(" ")[0]}, here’s what needs your attention.` : "Conversations, commitments, and the next step."}</p></div><Link className="dashboard-primary-button" href="/dashboard/capture"><Plus size={17} aria-hidden="true"/>Quick capture</Link></header>
      <div className={styles.navigation}><nav className="sales-day-scope" aria-label="Daily work scope"><Link href="/dashboard/sales/today" className={scope === "mine" ? "is-active" : ""} aria-current={scope === "mine" ? "page" : undefined}>Mine</Link><Link href="/dashboard/sales/today?scope=team" className={scope === "team" ? "is-active" : ""} aria-current={scope === "team" ? "page" : undefined}>Team</Link></nav><Link href="/dashboard/calendar"><CalendarClock size={16} aria-hidden="true"/>Team calendar</Link></div>
      <dl className={styles.metrics} aria-label="Daily work summary"><div><dt>Commitments due</dt><dd>{data.stats.due}</dd></div><div><dt>Appointments</dt><dd>{data.stats.appointments+bookings.length}</dd></div><div><dt>Interested prospects</dt><dd>{data.stats.interested}</dd></div></dl>
      <div className={`sales-split ${styles.priorities}`}><SalesPanel title="Follow-ups to work" eyebrow="Upcoming & overdue" action={<CalendarClock size={18} color="var(--workspace-muted)" />}>{data.tasks.length ? data.tasks.map((task) => <article className="sales-task" key={task.id}><div><strong><Link href={task.opportunityId ? `/dashboard/sales/${task.opportunityId}` : `/dashboard/tasks/${task.id}`}>{task.title}</Link></strong><p>{task.businessName} · {task.ownerName || "Unassigned"}</p><p><LocalTime value={task.dueAt} /></p>{task.notes ? <p>{task.notes}</p> : null}</div><Link className="sales-button" href={task.opportunityId ? `/dashboard/sales/${task.opportunityId}` : `/dashboard/tasks/${task.id}`}>Open<ArrowUpRight size={14} /></Link></article>) : <SalesEmpty title="No follow-ups scheduled">Follow-ups due within the next seven days appear here. Open a prospect to agree and schedule the next step.</SalesEmpty>}</SalesPanel>
        <SalesPanel title="Sales appointments" eyebrow="Make every conversation count" action={<Phone size={18} color="var(--workspace-muted)" />}>{data.appointments.length ? data.appointments.map((task) => <article className="sales-task" key={task.id}><div><strong><Link href={task.opportunityId ? `/dashboard/sales/${task.opportunityId}` : `/dashboard/tasks/${task.id}`}>{task.businessName}</Link></strong><p>{task.title}</p><p><LocalTime value={task.dueAt} />{task.endAt ? <> — <LocalTime value={task.endAt} /></> : null}</p><p>{[task.ownerName || "Unassigned", task.location].filter(Boolean).join(" · ")}</p></div><Link className="sales-button" href={task.opportunityId ? `/dashboard/sales/${task.opportunityId}` : `/dashboard/tasks/${task.id}`}>Prepare<ArrowUpRight size={14} /></Link></article>) : <SalesEmpty title="Room for your next appointment">Schedule a discovery meeting, office visit or follow-up from the opportunity’s record.</SalesEmpty>}</SalesPanel></div>
      <LeadIntroCalls calls={introCalls}/><UpcomingBookings bookings={bookings}/><HandoffQueue context={context} scope={scope}/><ServiceAttention context={context} scope={scope}/>
      {notices.items.length > 0 && <details className={styles.disclosure}><summary><Sparkles size={18} aria-hidden="true"/><span><strong>{notices.items.length} website update{notices.items.length === 1 ? "" : "s"}</strong><small>{notices.items.filter(n => n.kind === "needs_attention").length ? "Includes an issue needing attention" : "Plans and previews ready to review"}</small></span><ChevronDown size={18} aria-hidden="true"/></summary><FactoryWorkNotices data={notices} team={scope === "team"}/></details>}
      <details className={styles.disclosure}><summary><span><strong>Work focus & shortcuts</strong><small>Personalize your starting point</small></span><ChevronDown size={18} aria-hidden="true"/></summary><DailyWorkFocus context={context}/></details>
      <SalesPanel title={scope === "mine" ? "Your opportunity queue" : "The team’s opportunity queue"} eyebrow={`Showing ${data.stats.assigned} assigned opportunities`} action={<Link className="sales-button" href={`/dashboard/sales?owner=${scope === "mine" ? "mine" : "all"}&view=table`}>Full pipeline<ArrowUpRight size={14} /></Link>}><OpportunityTable opportunities={data.opportunities} emptyTitle={scope === "mine" ? "No opportunities assigned to you yet" : "No active team opportunities"} /></SalesPanel>
      {data.mockups.length ? <SalesPanel title="Website previews to keep moving" eyebrow="From interest to something they can see" action={<Sparkles size={18} color="var(--workspace-muted)" />}>{data.mockups.map((mockup) => <article key={mockup.id} className="sales-task"><div><strong><Link href={`/dashboard/sales/${mockup.opportunityId}`}>{mockup.businessName}</Link></strong><p>{mockup.ownerName || "Builder unassigned"} · Updated <LocalTime value={mockup.updatedAt} /></p><SalesStatus value={mockup.status}>{mockup.status}</SalesStatus></div><Link className="sales-button" href={`/dashboard/sales/${mockup.opportunityId}`}>Review<ArrowUpRight size={14} /></Link></article>)}</SalesPanel> : null}
    </div>
  </>;
}
