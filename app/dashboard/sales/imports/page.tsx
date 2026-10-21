import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, FileSpreadsheet } from "lucide-react";
import { ImportWorkspace } from "@/components/sales/import-workspace";
import { LocalTime } from "@/components/sales/date-time-field";
import { money, SalesEmpty, SalesHeader, SalesPanel } from "@/components/sales/workspace";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getWorkspaceMembers } from "@/lib/operations/data";
import { getSalesLists } from "@/lib/sales/data";

export const metadata: Metadata = { title: "Calling lists & imports" };

export default async function ImportsPage() {
  const context = await requireDashboardContext();
  const [lists, members] = await Promise.all([getSalesLists(context), getWorkspaceMembers(context)]);
  return <>
    <SalesHeader title="Calling lists & imports" active="imports" subtitle="Bring your research into the CRM, connect BatchDialer results, and see which prospecting lists turn into clients."><Link className="sales-button" href="/dashboard/sales?view=table">Open prospect records<ArrowUpRight size={15} /></Link></SalesHeader>
    <div className="sales-body"><SalesPanel title="Import a reviewed CSV" eyebrow="Research stays connected to the sale" action={<FileSpreadsheet size={20} color="#6a83a5" />}><ImportWorkspace disabled={context.role === "viewer"} currentUserId={context.user.id} members={members.filter(member => member.role !== "viewer").map((member) => ({ id: member.id, name: member.name || member.email, email: member.email }))} /></SalesPanel>
      <SalesPanel title="Calling list performance" eyebrow="Know where your customers come from"><p className="sales-panel-copy">Contacted, interested, appointment, and mockup counts reflect businesses associated with each list. Won sales and revenue are attributed once to the opportunity’s first source list.</p>{lists.length ? <div className="sales-table-wrap"><table className="sales-table"><thead><tr><th>Calling list</th><th>Businesses</th><th>Contacted</th><th>Interested</th><th>Appointments</th><th>Mockups</th><th>Won / sales value</th></tr></thead><tbody>{lists.map((list) => <tr key={list.id}><td><Link href={`/dashboard/sales?list=${list.id}&view=table`}><strong>{list.name}<ArrowUpRight size={12} /></strong></Link><small><LocalTime value={list.createdAt} dateOnly /></small></td><td>{list.businesses.toLocaleString()}</td><td>{list.contacted}</td><td>{list.interested}</td><td>{list.appointments}</td><td>{list.mockups}</td><td><strong>{money(list.wonValueCents / 100)}</strong><small>{list.won} won</small></td></tr>)}</tbody></table></div> : <SalesEmpty title="Your first list starts the picture">Import a researched calling list above. Its businesses, conversations, appointments, and eventual sales will stay connected.</SalesEmpty>}</SalesPanel>
    </div>
  </>;
}
