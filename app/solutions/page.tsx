import type { Metadata } from "next";
import { FinalCta, PageHero } from "@/components/ui";

export const metadata: Metadata = {
  title: "AI Agents & Automation Solutions",
  description: "Explore custom AI customer engagement, call intelligence, marketing intelligence, operations automation, and bespoke AI software.",
  alternates: { canonical: "/solutions" },
};

const solutions = [
  {
    title: "AI Customer Engagement",
    problem: "Customer inquiries arrive across channels, context gets lost, and timely follow-up depends on repetitive manual work.",
    system: "An engagement layer that qualifies inbound requests, prepares approved answers, coordinates next steps, and keeps customer records synchronized.",
    workflow: "Inquiry → classify intent → apply business rules → prepare response → route or escalate → update record.",
    integrations: ["CRM", "SMS & messaging", "Scheduling", "Web forms"],
    oversight: "Operators approve sensitive or nonstandard responses; exceptions and low-confidence cases route to a person.",
  },
  {
    title: "AI Call Intelligence",
    problem: "Important customer context stays inside recordings while CRM notes, follow-up, and coaching remain inconsistent.",
    system: "A recorded-call pipeline for transcription, structured information extraction, concise documentation, next-step detection, and reviewable coaching insights.",
    workflow: "Recording → transcription → entity and intent extraction → CRM draft → coaching analysis → manager review.",
    integrations: ["Telephony", "CRM", "Task systems", "Reporting"],
    oversight: "Teams define recording consent and retention policies. Generated notes and coaching signals remain reviewable and traceable.",
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
      <PageHero eyebrow="Solutions" title={<>AI designed for <span className="serif-italic">actual work.</span></>} description="We develop intelligent systems around defined business processes, combining AI with the software, integrations, controls, and human judgment needed to make it useful." meta="Agents · Automation · Connected software" />
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
