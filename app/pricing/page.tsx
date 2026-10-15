import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, FileCheck2, Handshake, ReceiptText } from "lucide-react";
import { PricingCards } from "@/components/pricing-cards";
import { Eyebrow, FinalCta } from "@/components/ui";
import { automationPlans, seoPlans, websitePlans } from "@/lib/services";

export const metadata: Metadata = {
  title: "Website, SEO & AI Automation Pricing",
  description: "Clear starting prices for professional websites, managed local SEO, focused automation, and managed AI agents from Tailored Agents.",
  alternates: { canonical: "/pricing" },
};

const pricingGroups = [
  ["Websites", "From $1,500", "#websites"],
  ["SEO & Analytics", "From $400/month", "#seo"],
  ["AI & Automation", "From $650", "#automation"],
] as const;

export default function PricingPage() {
  return (
    <>
      <section className="pricing-page-hero">
        <div className="container-shell pricing-page-hero-grid">
          <div>
            <Eyebrow>Clear pricing</Eyebrow>
            <h1 className="page-title">Serious work. Clear ways to <span className="serif-italic">start.</span></h1>
            <p className="lede">These packages establish a useful starting point without forcing every business into the same solution. We confirm the deliverables, timeline, and complete price in writing before paid work begins.</p>
            <div className="hero-actions"><Link className="button button-dark" href="/packages">Build a Flexible Package</Link><Link className="button button-light" href="#websites">Compare individual services<ArrowDown size={15} aria-hidden="true" /></Link></div>
          </div>
          <aside className="pricing-hero-panel" aria-label="Service starting prices">
            <span className="micro-label blue">Straightforward starting points</span>
            {pricingGroups.map(([label, price, href]) => <Link href={href} key={label}><span>{label}</span><strong>{price}</strong><ArrowDown size={14} aria-hidden="true" /></Link>)}
            <p>No gated price sheet. No surprise agency fees. The written proposal defines what is included and what would change the scope.</p>
          </aside>
        </div>
      </section>

      <section className="section-pad package-section" id="websites">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>Website design & development</Eyebrow><h2 className="h2">Choose the right level of <span className="serif-italic">build.</span></h2></div><p className="lede">Begin with a focused business website or expand the scope when more content, integrations, and customer-facing functionality are genuinely useful.</p></div>
          <PricingCards plans={websitePlans} />
        </div>
      </section>

      <section className="section-pad package-section package-section-alt" id="seo">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>Local SEO & growth analytics</Eyebrow><h2 className="h2">A monthly cadence matched to the <span className="serif-italic">opportunity.</span></h2></div><p className="lede">Both plans begin with a one-time foundation setup, then continue month to month without a long-term SEO commitment. Setup is included when SEO is paired with a new website package.</p></div>
          <PricingCards plans={seoPlans} columns={2} />
        </div>
      </section>

      <section className="section-pad package-section" id="automation">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>AI agents, automation & custom software</Eyebrow><h2 className="h2">Start focused. Expand when the value is <span className="serif-italic">clear.</span></h2></div><p className="lede">Choose a one-time automation for a fixed workflow or a managed monthly agent when the responsibility requires monitoring, refinement, and variable usage.</p></div>
          <PricingCards plans={automationPlans} />
        </div>
      </section>

      <section className="section-pad pricing-terms-section">
        <div className="container-shell">
          <div className="infrastructure-heading"><div><Eyebrow>How pricing works</Eyebrow><h2 className="h2">Clarity before the work <span className="serif-italic">begins.</span></h2></div><p className="lede">Starting prices make comparison easier. The proposal turns that starting point into an exact scope, payment schedule, and delivery plan.</p></div>
          <div className="pricing-terms-grid">
            <article><ReceiptText size={20}/><span>01</span><h3>Written scope</h3><p>Pages, deliverables, responsibilities, revision rounds, integrations, and exclusions are documented before billing begins.</p></article>
            <article><Handshake size={20}/><span>02</span><h3>Practical milestones</h3><p>Website projects typically use 40% to begin, 30% after design approval, and 30% before launch. The proposal confirms the schedule.</p></article>
            <article><FileCheck2 size={20}/><span>03</span><h3>Separate outside costs</h3><p>Domains, paid software, advertising spend, and third-party subscriptions are identified separately instead of being hidden inside the fee.</p></article>
          </div>
        </div>
      </section>

      <section className="section-pad pricing-faq-section">
        <div className="container-shell pricing-faq-grid">
          <div><Eyebrow>Pricing questions</Eyebrow><h2 className="h2">Know what affects the <span className="serif-italic">number.</span></h2><p className="lede">The free website review is the simplest way to identify which package is realistic before discussing a paid engagement.</p></div>
          <div className="pricing-faq-list">
            <details><summary>Is the $1,500 Launch Website a complete website?</summary><p>Yes, within its defined scope: up to five essential pages, responsive design and development, a standard inquiry form, foundational SEO and analytics, one consolidated revision round, and deployment assistance. The client supplies the core copy, logo, and photography.</p></details>
            <details><summary>What usually increases a website price?</summary><p>Additional pages, copywriting, custom photography or media work, ecommerce, specialized forms, customer portals, third-party integrations, and custom application behavior add scope.</p></details>
            <details><summary>What does the SEO Foundation Setup cover?</summary><p>It establishes the technical audit, measurement baseline, search and location priorities, reporting environment, and initial action plan. Managed SEO then continues month to month and can be canceled before the next billing cycle.</p></details>
            <details><summary>How are managed AI agents billed?</summary><p>The monthly management fee covers the defined agent, monitoring, refinement, support, and an agreed usage allowance. Activation, third-party software, voice or messaging costs, and usage above the allowance are identified separately in the proposal.</p></details>
            <details><summary>When does automation need a tailored proposal?</summary><p>A proposal is needed when a workflow spans several systems, depends on custom APIs or data migration, requires a new interface, or needs broader operational testing and support.</p></details>
          </div>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
