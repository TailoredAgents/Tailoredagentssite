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
      <div className="container-shell">
        {practices.map(([title, copy, points], index) => (
          <section className="detail-section" key={title}>
            <div className="detail-index">0{index + 1}</div>
            <div className="detail-body"><h2>{title}</h2><p>{copy}</p><div className="detail-columns"><div><h3>Representative work</h3><ul className="plain-list">{points.map((point) => <li key={point}>{point}</li>)}</ul></div><div><h3>Engineering position</h3><p>{index === 4 ? "No software is infallible. We design for clear operating boundaries, observable behavior, recoverable failure, and informed human ownership." : "The right implementation depends on the operation, risk, data, and existing technology. Architecture follows those constraints."}</p></div></div></div>
          </section>
        ))}
      </div>
      <FinalCta />
    </>
  );
}

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> { return managedMetadata("/engineering", baselineMetadata); }
