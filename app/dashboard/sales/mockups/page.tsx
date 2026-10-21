import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ExternalLink, Sparkles } from "lucide-react";
import { LocalTime } from "@/components/sales/date-time-field";
import { SalesEmpty, SalesHeader, SalesMetric, SalesStatus } from "@/components/sales/workspace";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getMockupQueue } from "@/lib/sales/data";
import { mockupStatuses } from "@/lib/sales/types";

export const metadata: Metadata = { title: "Website mockup queue" };

export default async function MockupsPage({ searchParams }: { searchParams: Promise<{ owner?: string | string[]; status?: string | string[] }> }) {
  const context = await requireDashboardContext();
  const [data, filters] = await Promise.all([getMockupQueue(context), searchParams]);
  const owner = typeof filters.owner === "string" ? filters.owner : "all";
  const status = typeof filters.status === "string" && mockupStatuses.some((item) => item === filters.status) ? filters.status : "all";
  const items = data.items.filter((item) => (owner === "all" || item.ownerId === (owner === "mine" ? context.user.id : owner)) && (status === "all" || item.status === status));
  return <>
    <SalesHeader title="Website mockups" active="mockups" subtitle="Personalized website previews, from the first request to the client walkthrough. Build in Website Factory; keep the handoff here."><Link className="sales-button" href="/dashboard/sales?stage=interested">Interested prospects<ArrowUpRight size={15} /></Link></SalesHeader>
    <div className="sales-body"><div className="sales-metrics"><SalesMetric label="Requested" value={data.items.filter((item) => item.status === "requested").length} detail="Briefs waiting for a builder" /><SalesMetric label="Building" value={data.items.filter((item) => item.status === "building").length} detail="In your existing Website Factory" tone="blue" /><SalesMetric label="Review & ready" value={data.items.filter((item) => ["review", "ready"].includes(item.status)).length} detail="One step closer to a sales conversation" tone="teal" /><SalesMetric label="Delivered" value={data.items.filter((item) => item.status === "delivered").length} detail="Previews shared with the prospect" /></div>
      <form method="get" className="sales-filter-bar"><label><select name="owner" aria-label="Filter mockups by builder" defaultValue={owner}><option value="all">All builders</option><option value="mine">Assigned to me</option>{data.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label><select name="status" aria-label="Filter mockups by status" defaultValue={status}><option value="all">Every status</option>{mockupStatuses.map((value) => <option value={value} key={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></label><button type="submit">Apply</button>{owner !== "all" || status !== "all" ? <Link className="sales-button" href="/dashboard/sales/mockups">Clear</Link> : null}</form>
      {!items.length ? <section className="dashboard-panel"><SalesEmpty title="The next great website starts with a request" href="/dashboard/sales" linkLabel="Find an interested prospect">Open a prospect and request a mockup with the brief. The request and business information arrive in this queue.</SalesEmpty></section> : <div className="sales-queue-grid">{mockupStatuses.filter((value) => status === "all" || status === value).map((value) => <section key={value}><div className="sales-section-title"><h2>{value.charAt(0).toUpperCase() + value.slice(1)}</h2><SalesStatus value={value}>{items.filter((item) => item.status === value).length}</SalesStatus></div>{items.filter((item) => item.status === value).map((item) => <article className="sales-queue-card" key={item.id}><div><span className="sales-eyebrow"><Sparkles size={13} /> Website Factory</span><h3 style={{ marginTop: ".7rem" }}>{item.businessName}</h3><p>{item.brief}</p><p>{item.ownerName || "Builder unassigned"}<br /><LocalTime value={item.updatedAt} /></p>{item.previewUrl ? <a className="sales-button" href={item.previewUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open preview</a> : null}</div><Link href={`/dashboard/sales/${item.opportunityId}`}>Open handoff<ArrowRight size={15} /></Link></article>)}{!items.some((item) => item.status === value) ? <p className="sales-column-empty">No mockups here.</p> : null}</section>)}</div>}
    </div>
  </>;
}
