import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, Phone, Sparkles } from "lucide-react";
import { LocalTime } from "@/components/sales/date-time-field";
import { OpportunityTable } from "@/components/sales/opportunity-list";
import { SalesEmpty, SalesHeader, SalesMetric, SalesPanel, SalesStatus } from "@/components/sales/workspace";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getSalesToday } from "@/lib/sales/data";

export const metadata: Metadata = { title: "My sales day" };

export default async function SalesTodayPage({ searchParams }: { searchParams: Promise<{ scope?: string | string[] }> }) {
  const context = await requireDashboardContext();
  const params = await searchParams;
  const scope = params.scope === "team" ? "team" : "mine";
  const data = await getSalesToday(context, scope);
  return <>
    <SalesHeader title={scope === "mine" ? "Your sales day" : "The team’s sales day"} active="today" subtitle={scope === "mine" ? `${context.user.name.split(" ")[0]}, here are your scheduled commitments and the prospects ready for a conversation.` : "A shared view of the team’s next conversations, appointments, and website previews."}><div className="sales-day-scope"><Link href="/dashboard/sales/today" className={scope === "mine" ? "is-active" : ""} aria-current={scope === "mine" ? "page" : undefined}>Mine</Link><Link href="/dashboard/sales/today?scope=team" className={scope === "team" ? "is-active" : ""} aria-current={scope === "team" ? "page" : undefined}>Team</Link></div></SalesHeader>
    <div className="sales-body"><div className="sales-metrics"><SalesMetric label="Commitments due" value={data.stats.due} detail="Scheduled work due now or earlier" tone="blue" /><SalesMetric label="Appointments" value={data.stats.appointments} detail="Upcoming and overdue conversations" /><SalesMetric label="Interested prospects" value={data.stats.interested} detail="Ready for a personal next step" tone="teal" /><SalesMetric label="Mockups in progress" value={data.stats.mockups} detail="Connected to your website sales" /></div>
      <div className="sales-split"><SalesPanel title="Follow-ups to work" eyebrow="A promise kept is a sale moved forward" action={<CalendarClock size={18} color="var(--workspace-muted)" />}>{data.tasks.length ? data.tasks.map((task) => <article className="sales-task" key={task.id}><div><strong><Link href={`/dashboard/sales/${task.opportunityId}`}>{task.title}</Link></strong><p>{task.businessName} · {task.ownerName || "Unassigned"}</p><p><LocalTime value={task.dueAt} /></p>{task.notes ? <p>{task.notes}</p> : null}</div><Link className="sales-button" href={`/dashboard/sales/${task.opportunityId}`}>Open<ArrowUpRight size={14} /></Link></article>) : <SalesEmpty title="No follow-ups due">Scheduled follow-ups appear here when they are due. Open a prospect to agree and schedule the next step.</SalesEmpty>}</SalesPanel>
        <SalesPanel title="Appointments" eyebrow="Make every conversation count" action={<Phone size={18} color="var(--workspace-muted)" />}>{data.appointments.length ? data.appointments.map((task) => <article className="sales-task" key={task.id}><div><strong><Link href={`/dashboard/sales/${task.opportunityId}`}>{task.businessName}</Link></strong><p>{task.title}</p><p><LocalTime value={task.dueAt} />{task.endAt ? <> — <LocalTime value={task.endAt} /></> : null}</p><p>{[task.ownerName || "Unassigned", task.location].filter(Boolean).join(" · ")}</p></div><Link className="sales-button" href={`/dashboard/sales/${task.opportunityId}`}>Prepare<ArrowUpRight size={14} /></Link></article>) : <SalesEmpty title="Room for your next appointment">Book a discovery call or preview walkthrough from the prospect’s record.</SalesEmpty>}</SalesPanel></div>
      <SalesPanel title={scope === "mine" ? "Your calling & opportunity queue" : "The team’s calling & opportunity queue"} eyebrow={`Showing ${data.stats.assigned} assigned opportunities`} action={<Link className="sales-button" href={`/dashboard/sales?owner=${scope === "mine" ? "mine" : "all"}&view=table`}>Full pipeline<ArrowUpRight size={14} /></Link>}><OpportunityTable opportunities={data.opportunities} emptyTitle={scope === "mine" ? "No opportunities assigned to you yet" : "No active team opportunities"} /></SalesPanel>
      {data.mockups.length ? <SalesPanel title="Website previews to keep moving" eyebrow="From interest to something they can see" action={<Sparkles size={18} color="var(--workspace-muted)" />}>{data.mockups.map((mockup) => <article key={mockup.id} className="sales-task"><div><strong><Link href={`/dashboard/sales/${mockup.opportunityId}`}>{mockup.businessName}</Link></strong><p>{mockup.ownerName || "Builder unassigned"} · Updated <LocalTime value={mockup.updatedAt} /></p><SalesStatus value={mockup.status}>{mockup.status}</SalesStatus></div><Link className="sales-button" href={`/dashboard/sales/${mockup.opportunityId}`}>Review<ArrowUpRight size={14} /></Link></article>)}</SalesPanel> : null}
    </div>
  </>;
}
