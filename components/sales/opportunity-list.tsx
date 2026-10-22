import Link from "next/link";
import { ArrowUpRight, CalendarClock, Globe, Phone } from "lucide-react";
import { LocalTime } from "./date-time-field";
import { initials, money, SalesEmpty, SalesStatus } from "./workspace";
import { stageLabels, websiteStatusLabels, type SalesOpportunity } from "@/lib/sales/types";

export function OpportunityCard({ opportunity }: { opportunity: SalesOpportunity }) {
  const { business } = opportunity;
  return <Link href={`/dashboard/sales/${opportunity.id}`} className="sales-opportunity-card">
    <div className="sales-card-top"><span className="sales-card-category">{business.industry || "Website opportunity"}</span><ArrowUpRight size={15} color="var(--workspace-muted)" /></div>
    <h3>{business.name}</h3><p className="sales-card-title">{opportunity.title}</p><p>{opportunity.contact?.name || business.state || "Contact not yet identified"}</p>
    <p>{websiteStatusLabels[business.websiteStatus] || business.websiteStatus}{business.score !== null ? ` · Score ${business.score}` : ""}</p>
    {opportunity.nextTask ? <p className="sales-card-next"><CalendarClock size={13} /> {opportunity.nextTask.title}<br /><LocalTime value={opportunity.nextTask.dueAt} /></p> : null}
    {opportunity.mockupStatus ? <div style={{ marginTop: ".65rem" }}><SalesStatus value={opportunity.mockupStatus}>Mockup: {opportunity.mockupStatus}</SalesStatus></div> : null}
    <div className="sales-card-footer"><strong>{opportunity.valueCents === null ? "Value not set" : money(opportunity.valueCents / 100)}</strong><span className="sales-owner"><i>{opportunity.ownerName ? initials(opportunity.ownerName) : "—"}</i><span>{opportunity.ownerName?.split(" ")[0] || "Unassigned"}</span></span></div>
  </Link>;
}

export function OpportunityTable({ opportunities, emptyTitle = "No opportunities in this view" }: { opportunities: SalesOpportunity[]; emptyTitle?: string }) {
  if (!opportunities.length) return <SalesEmpty title={emptyTitle}>Import a researched list, add an opportunity, or adjust your filters to get started.</SalesEmpty>;
  return <div className="sales-table-wrap"><table className="sales-table"><thead><tr><th>Business / contact</th><th>Stage</th><th>Research</th><th>Owner / next action</th><th>Value</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{opportunities.map((opportunity) => <tr key={opportunity.id}>
    <td><Link href={`/dashboard/sales/${opportunity.id}`}><strong>{opportunity.business.name}</strong></Link><small>{opportunity.title}</small><small>{opportunity.contact?.name || opportunity.business.industry || "Contact not yet identified"}</small>{opportunity.business.phone ? <small><Phone size={12} /> {opportunity.business.phone}</small> : null}</td>
    <td><SalesStatus value={opportunity.stage}>{stageLabels[opportunity.stage]}</SalesStatus>{opportunity.mockupStatus ? <small>Mockup: {opportunity.mockupStatus}</small> : null}</td>
    <td><strong>{websiteStatusLabels[opportunity.business.websiteStatus] || "Not checked"}</strong><small>{[opportunity.business.industry, opportunity.business.state, opportunity.business.score !== null ? `Score ${opportunity.business.score}` : null].filter(Boolean).join(" · ") || "Research not added"}</small>{opportunity.listNames.length ? <small>{opportunity.listNames.join(", ")}</small> : null}</td>
    <td><strong>{opportunity.ownerName || "Unassigned"}</strong><small>{opportunity.nextTask?.title || "No scheduled commitment"}</small>{opportunity.nextTask ? <small><LocalTime value={opportunity.nextTask.dueAt} /></small> : null}</td>
    <td><strong>{opportunity.valueCents === null ? "—" : money(opportunity.valueCents / 100)}</strong><small>{opportunity.offerType === "promotion" ? "Acquisition promotion" : opportunity.offerType === "custom" ? "Custom scope" : "Standard offer"}</small></td>
    <td><Link aria-label={`Open ${opportunity.business.name}`} href={`/dashboard/sales/${opportunity.id}`}><ArrowUpRight size={17} /></Link></td>
  </tr>)}</tbody></table></div>;
}

export function BusinessLink({ url, label }: { url: string | null | undefined; label?: string }) {
  return url ? <a href={url} target="_blank" rel="noreferrer"><Globe size={14} /> {label || url}<ArrowUpRight size={12} /></a> : <span>Not provided</span>;
}
