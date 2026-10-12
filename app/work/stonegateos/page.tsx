import type { Metadata } from "next";
import { ProductWindow } from "@/components/product-window";
import { Eyebrow, FinalCta, PageHero } from "@/components/ui";

export const metadata: Metadata = {
  title: "StonegateOS Case Study",
  description: "A technical case study of StonegateOS, a connected operating platform built around the requirements of a service business.",
  alternates: { canonical: "/work/stonegateos" },
};

const systems = [
  ["Customer quoting & booking", "Public service flows collect structured requests, produce quotes, manage availability, and hand confirmed work into operations."],
  ["CRM & unified communications", "Customer, property, lead, conversation, and job context are brought together for office and field teams."],
  ["AI call analysis", "Recorded-call workflows can transcribe conversations, extract structured information, and prepare CRM documentation."],
  ["Sales coaching", "Conversation analysis can identify next steps and coaching signals for review by sales leadership."],
  ["Lead & follow-up automation", "Durable events coordinate notifications, reminders, follow-up sequences, and provider work outside user-facing requests."],
  ["Job & media intelligence", "Field workflows manage scope, media, payment, completion evidence, and recovery for unreliable connectivity."],
  ["Marketing analytics", "First-party web data, advertising integrations, and analysis workflows support campaign and search-term review."],
  ["Partner management", "A dedicated portal and staff workspace support accounts, locations, requests, jobs, proof, approvals, and commercial records."],
  ["Mobile operations", "A protected, phone-first experience supports daily work, communication, receipts, media, payments, and job completion."],
] as const;

export default function StonegateCaseStudy() {
  return (
    <>
      <PageHero eyebrow="Case study · StonegateOS" title={<>One connected system for a <span className="serif-italic">complex operation.</span></>} description="A custom business operating platform developed around the practical requirements of a service business—and an ongoing proving ground for applied AI engineering." meta="Internal platform · Source reviewed October 2026" />
      <section className="section-pad">
        <div className="container-shell case-intro">
          <div><Eyebrow>Project overview</Eyebrow><h2 className="h2">Built from the operation <span className="serif-italic">outward.</span></h2></div>
          <div><p className="lede">StonegateOS connects the customer journey, office coordination, field execution, partner work, financial context, and intelligent workflows within one operating environment.</p><div className="case-facts"><div className="case-fact"><span>Type</span><span>Custom operating platform</span></div><div className="case-fact"><span>Surfaces</span><span>Public site, Team Console, mobile, customer proposals, Partner Portal</span></div><div className="case-fact"><span>Architecture</span><span>Next.js applications, PostgreSQL, API service, durable workers, provider integrations</span></div><div className="case-fact"><span>Status</span><span>Actively developed internal system; individual capability enablement varies by deployment configuration</span></div></div></div>
        </div>
      </section>
      <section className="dark-section section-pad"><div className="container-shell"><ProductWindow /></div></section>
      <section className="section-pad">
        <div className="container-shell">
          <div className="intro-grid"><Eyebrow>Business challenge</Eyebrow><div><h2 className="h2">Operational truth was spread across <span className="serif-italic">too many handoffs.</span></h2><p className="lede">Customer information, conversations, lead follow-up, scheduling, quoting, field execution, partner coordination, and reporting all depend on one another. Treating each as a separate tool creates duplicated work and incomplete context.</p></div></div>
        </div>
      </section>
      <section className="section-pad section-rule">
        <div className="container-shell"><div className="intro-grid"><Eyebrow>Selected systems</Eyebrow><h2 className="h2">A platform, not a <span className="serif-italic">single feature.</span></h2></div><div className="feature-matrix">{systems.map(([title, text], index) => <div className="matrix-cell" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></div>)}</div></div>
      </section>
      <section className="section-pad">
        <div className="container-shell architecture"><Eyebrow>Technical approach</Eyebrow><h2 className="h2">Designed around durable <span className="serif-italic">system boundaries.</span></h2><div className="arch-flow">{[['01 · Model','Structured records','Core customer, property, lead, job, quote, conversation, and partner data create shared context.'],['02 · Connect','APIs & events','Provider webhooks and application APIs move information through explicit service boundaries.'],['03 · Process','Background workers','Queued work handles retries, notifications, analysis, documents, and scheduled activity.'],['04 · Govern','Access & approval','Individual sessions, permissions, feature gates, and human review control sensitive operations.']].map(([n,h,p]) => <div className="arch-block" key={n}><span>{n}</span><h3>{h}</h3><p>{p}</p></div>)}</div></div>
      </section>
      <section className="section-pad section-rule">
        <div className="container-shell detail-section" style={{paddingTop:0,paddingBottom:0,borderTop:0}}><div className="detail-index">Engineering considerations</div><div className="detail-body"><h2>Capability requires more than code.</h2><p>Source review can establish what an application implements. It cannot, by itself, prove that every provider, feature flag, protected route, or workflow is active and healthy in a particular production environment.</p><div className="detail-columns"><div><h3>Controls in the system</h3><ul className="plain-list"><li>Individual and role-based access</li><li>API-side authorization boundaries</li><li>Deployment-controlled feature gates</li><li>Approval before sensitive agent actions</li></ul></div><div><h3>Operational posture</h3><p>StonegateOS documentation explicitly distinguishes source implementation from runtime certification. That discipline—clear evidence, bounded claims, and proportional verification—is part of the engineering work.</p></div></div></div></div>
      </section>
      <section className="section-pad section-rule"><div className="content-narrow"><p className="concept-label">Presentation note</p><p className="lede">The interface shown here is an intentionally designed conceptual demonstration using synthetic data. It communicates the shape of the operating system without exposing customer records or presenting a fabricated screenshot as production evidence.</p></div></section>
      <FinalCta />
    </>
  );
}
