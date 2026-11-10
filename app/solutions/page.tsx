import { publicPageMetadata } from "@/lib/site";
import { managedMetadata } from "@/lib/seo/public-metadata";
import Link from "next/link";
import { SolutionExplorer } from "@/components/solution-explorer";
import type { Metadata } from "next";
import { ArrowLink, Eyebrow, FinalCta, PageHero } from "@/components/ui";

const baselineMetadata = publicPageMetadata(
  "Automation & AI Solutions",
  "Explore custom AI agents, operations automation, team knowledge, lead follow-up and connected software, with focused solutions for insurance and freight teams.",
  "/solutions",
);

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
      <section className="business-solutions-intro"><div className="container-shell"><p className="lede">The workflows below are examples we can scope. Available integrations, responsibilities and launch requirements are confirmed for each engagement.</p><div className="business-solution-links"><Link href="/solutions/commercial-insurance">Commercial insurance →</Link><Link href="/solutions/freight-automation">Freight brokerages &amp; 3PL →</Link></div></div></section>
      <section className="section-pad solution-explorer-section"><div className="container-shell"><SolutionExplorer solutions={[solutions[3],solutions[4],solutions[1],solutions[0],solutions[2]]}/></div></section>
      <section className="section-pad section-rule"><div className="container-shell business-services"><div><Eyebrow>Also part of our work</Eyebrow><h2 className="h2">Your public presence <span className="serif-italic">still matters.</span></h2><p className="lede">Website design and search visibility remain available as separate services or as part of a broader engagement.</p></div><div><ArrowLink href="/websites">Website development</ArrowLink><ArrowLink href="/seo">SEO & analytics</ArrowLink><ArrowLink href="/packages">Website & SEO packages</ArrowLink></div></div></section>
      <FinalCta />
    </>
  );
}

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> { return managedMetadata("/solutions", baselineMetadata); }
