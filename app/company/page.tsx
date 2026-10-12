import type { Metadata } from "next";
import { FinalCta, PageHero } from "@/components/ui";

export const metadata: Metadata = {
  title: "Company",
  description: "Tailored Agents is an AI engineering and custom software company focused on practical systems, responsible automation, and long-term operational value.",
  alternates: { canonical: "/company" },
};

export default function CompanyPage() {
  return (
    <>
      <PageHero eyebrow="Company" title={<>Practical intelligence. <span className="serif-italic">Purpose-built systems.</span></>} description="Tailored Agents is a technology development company building software around real business operations. We care about whether a system fits the work—not whether it checks a trend-driven box." meta="Custom AI · Automation · Software engineering" />
      <section className="section-pad"><div className="container-shell case-intro"><div><span className="eyebrow">Our perspective</span><h2 className="h2">Good software begins with <span className="serif-italic">operational understanding.</span></h2></div><div><p className="lede">The difficult part of applied AI is rarely the isolated model call. It is understanding the information, decisions, permissions, exceptions, and human responsibilities that surround it.</p><p className="text-muted">Our approach is informed by building systems for our own operations. That experience keeps the work grounded: integrations fail, policies change, edge cases matter, and a useful interface has to make sense on a busy day—not only in a demonstration.</p></div></div></section>
      <section className="section-pad section-rule"><div className="container-shell"><div className="principle-grid">{[['01','Understand the work','We study the current process, the information moving through it, and the people accountable for the outcome.'],['02','Engineer for the whole system','Models, software, data, integrations, and controls are designed together around one operational objective.'],['03','Automate responsibly','Autonomy should match risk. Sensitive, ambiguous, or customer-facing actions retain appropriate review and escalation.'],['04','Prefer durable value','We prioritize maintainable systems and clear ownership over demonstrations that cannot survive real operating conditions.'],['05','Be honest about fit','Not every problem needs AI. Sometimes the best answer is clearer software, a reliable integration, or a simpler process.'],['06','Keep improving','Real usage reveals better requirements than assumptions. We evaluate outcomes and refine the system as the operation changes.']].map(([n,h,p]) => <div className="principle" key={n}><span>{n}</span><h3>{h}</h3><p>{p}</p></div>)}</div></div></section>
      <section className="section-pad"><div className="content-narrow"><span className="eyebrow">What we are building toward</span><h2 className="h2" style={{marginTop:"1.3rem"}}>A long-term engineering partner for organizations with <span className="serif-italic">important work to improve.</span></h2><p className="lede">That can begin with one focused automation or extend to a connected operating platform. The common thread is disciplined engineering around a meaningful business problem.</p></div></section>
      <FinalCta />
    </>
  );
}
