import type { Metadata } from "next";
import { FinalCta, PageHero } from "@/components/ui";

export const metadata: Metadata = {
  title: "Automation & AI Solutions",
  description: "Explore website AI assistants, lead qualification, phone reception, follow-up, marketing intelligence, operations automation, and custom software.",
  alternates: { canonical: "/solutions" },
};

const solutions = [
  {
    title: "Website AI & Lead Qualification",
    problem: "Website visitors have questions at every hour, while useful context can be lost between a generic form submission and the team's first response.",
    system: "A business-trained website assistant that answers approved questions, gathers lead context, applies qualification rules, and prepares the next handoff.",
    workflow: "Visitor question → approved answer → capture context → qualify → book, route, or escalate.",
    integrations: ["Website", "Web forms", "Scheduling", "CRM"],
    oversight: "The business approves source knowledge, qualification questions, escalation rules, and any action beyond standard website assistance.",
  },
  {
    title: "AI Phone & Missed-call Recovery",
    problem: "Calls arrive while teams are busy, after hours, or in the field, and a missed conversation can become a missed customer.",
    system: "A bounded phone and recovery workflow that handles approved common needs, captures caller intent, coordinates the next step, and escalates exceptions.",
    workflow: "Inbound or missed call → identify need → capture details → answer, book, route, or follow up → log outcome.",
    integrations: ["Telephony", "Scheduling", "CRM", "SMS & messaging"],
    oversight: "Call flows, recording and consent rules, transfers, sensitive topics, and escalation behavior are approved before launch.",
  },
  {
    title: "AI Marketing Intelligence",
    problem: "Campaign, search-term, and content data are fragmented, making it difficult to identify what deserves attention.",
    system: "A reporting and analysis workflow that explains changes, evaluates search terms, plans content, and prepares bounded recommendations.",
    workflow: "Campaign data → normalize → compare → explain → recommend → approval and action.",
    integrations: ["Google Ads", "Analytics", "Content systems", "Reporting"],
    oversight: "Recommendations include their evidence and wait for approval. Automated publishing or campaign changes are explicitly gated.",
  },
  {
    title: "AI Operations Automation",
    problem: "Documents, receipts, job information, media, and routine updates move slowly between disconnected tools.",
    system: "Connected workflows for extraction, classification, synchronization, reporting, and exception handling across everyday operations.",
    workflow: "Business input → validate → extract → apply rules → update systems → notify or request review.",
    integrations: ["Documents", "Accounting", "Scheduling", "Databases"],
    oversight: "Material financial, customer-facing, or ambiguous decisions can require explicit approval before a write or external action.",
  },
  {
    title: "Custom AI Software",
    problem: "Off-the-shelf products force unusual operations into generic workflows and leave critical context divided between systems.",
    system: "A purpose-built application, portal, CRM extension, or multi-agent environment developed around the organization’s actual requirements.",
    workflow: "Discovery → domain model → architecture → iterative delivery → integration → operational refinement.",
    integrations: ["External APIs", "Business databases", "Identity", "Communication systems"],
    oversight: "Permissions, structured outputs, auditability, and operator controls are designed with the application—not added after the fact.",
  },
];

export default function SolutionsPage() {
  return (
    <>
      <PageHero eyebrow="Detailed automation solutions" title={<>Better follow-up. Clearer workflows. <span className="serif-italic">Useful automation.</span></>} description="We develop tailored systems around defined business processes, combining automation, AI, software, integrations, controls, and human judgment where each one adds value." meta="Lead follow-up · Call intelligence · Operations · Custom software" />
      <section className="solution-system-intro">
        <div className="container-shell solution-system-flow" aria-label="Our solution design process">
          <div><span>01</span><small>Start with</small><b>Business friction</b></div><i>→</i><div><span>02</span><small>Map the</small><b>Workflow & information</b></div><i>→</i><div><span>03</span><small>Define the</small><b>Automation boundary</b></div><i>→</i><div><span>04</span><small>Evaluate the</small><b>Business outcome</b></div>
        </div>
      </section>
      <div className="container-shell">
        {solutions.map((solution, index) => (
          <section className="detail-section" key={solution.title}>
            <div className="detail-index">0{index + 1} / {solution.title}</div>
            <div className="detail-body">
              <h2>{solution.title}</h2>
              <p>{solution.system}</p>
              <div className="detail-columns">
                <div><h3>The business problem</h3><p>{solution.problem}</p><h3>Example workflow</h3><p className="mono">{solution.workflow}</p></div>
                <div><h3>Typical integrations</h3><ul className="plain-list">{solution.integrations.map((item) => <li key={item}>{item}</li>)}</ul><h3>Human oversight</h3><p>{solution.oversight}</p></div>
              </div>
            </div>
          </section>
        ))}
      </div>
      <FinalCta />
    </>
  );
}
