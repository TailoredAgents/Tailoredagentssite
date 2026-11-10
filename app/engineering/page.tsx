import { managedMetadata } from "@/lib/seo/public-metadata";
import type { Metadata } from "next";
import { FinalCta, PageHero } from "@/components/ui";

const baselineMetadata: Metadata = {
  title: "Engineering",
  description: "Our approach to AI agent engineering, full-stack software, system integrations, data processing, reliability, and human oversight.",
  alternates: { canonical: "/engineering" },
};

const practices = [
  ["AI Agent Engineering", "We design agent workflows around bounded responsibilities: structured inputs and outputs, deliberate tool access, validation, context management, memory when appropriate, and explicit escalation paths.", ["Tool permissions", "Structured outputs", "Evaluation & validation", "Human-in-the-loop controls"]],
  ["Software & Application Development", "We build full-stack applications, internal portals, dashboards, operational tools, and customer-facing experiences around a coherent domain model—not a collection of disconnected AI features.", ["Web applications", "Internal platforms", "Operational interfaces", "Customer portals"]],
  ["System Integrations", "Useful systems need to fit the surrounding operation. We connect CRMs, communications, scheduling, advertising services, databases, and external APIs through clear service boundaries.", ["API architecture", "Webhooks & events", "Identity & permissions", "Data synchronization"]],
  ["Data & Intelligence", "We develop workflows for extraction, normalization, enrichment, analysis, and reporting. Predictive modeling is considered only when the available data and decision context support it.", ["Structured extraction", "Data processing", "Decision support", "Model evaluation"]],
  ["Reliability & Oversight", "We treat AI as one component in a larger software system. Testing, observability, permissions, retries, data protection, approvals, and failure behavior are part of the design.", ["Testing & monitoring", "Durable background work", "Access control", "Safe failure modes"]],
] as const;

export default function EngineeringPage() {
  return (
    <>
      <PageHero eyebrow="Engineering" title={<>Built as a system. <span className="serif-italic">Operated with care.</span></>} description="AI is most valuable when it is grounded in sound software architecture, explicit controls, reliable integrations, and a clear understanding of the work around it." meta="Architecture · Delivery · Reliability" />
      <section className="section-pad">
        <div className="container-shell architecture">
          <span className="eyebrow">A practical system model</span>
          <h2 className="h2">Intelligence is one layer of the <span className="serif-italic">architecture.</span></h2>
          <div className="arch-flow">
            {[['01 · Inputs','Business signals','Calls, messages, documents, events, and structured records.'],['02 · Intelligence','Interpret & prepare','Models extract, classify, reason, or draft within a bounded task.'],['03 · Controls','Validate & approve','Rules, confidence checks, permissions, and human decisions govern action.'],['04 · Systems','Write & observe','Approved results update connected software with traceable outcomes.']].map(([n,h,p]) => <div className="arch-block" key={n}><span>{n}</span><h3>{h}</h3><p>{p}</p></div>)}
          </div>
        </div>
        <div className="container-shell engineering-principles">
          <div><span className="concept-label">Engineering posture</span><p>Capability is only useful when the surrounding system is understandable, observable, and accountable.</p></div>
          <ol><li><span>01</span><b>Defined boundaries</b><small>Explicit responsibilities and permissions</small></li><li><span>02</span><b>Observable behavior</b><small>Traceable inputs, decisions, and outcomes</small></li><li><span>03</span><b>Recoverable failure</b><small>Retries, escalation, and safe fallbacks</small></li><li><span>04</span><b>Human ownership</b><small>Clear approval and operating responsibility</small></li></ol>
        </div>
      </section>
      <section className="section-pad engineering-practice-section"><div className="container-shell"><div className="section-heading-wide"><div><span className="eyebrow">What we bring together</span><h2 className="h2">The whole system.<br/><span className="serif-italic">Thought through.</span></h2></div><p className="lede">Architecture follows your operation, data and existing tools. These are the disciplines we bring to the work.</p></div><div className="engineering-practice-grid">{practices.map(([title,copy,points],index)=><article key={title}><span className="practice-number">0{index+1}</span><h3>{title}</h3><p>{copy}</p><ul>{points.map(point=><li key={point}>{point}</li>)}</ul></article>)}</div><p className="engineering-footnote">No software is infallible. We plan for observable behavior, recoverable failure and informed human ownership.</p></div></section>
      <FinalCta />
    </>
  );
}

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> { return managedMetadata("/engineering", baselineMetadata); }
