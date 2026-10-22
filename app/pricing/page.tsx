import { managedMetadata } from "@/lib/seo/public-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, FileCheck2, Handshake, ReceiptText } from "lucide-react";
import { PricingCards } from "@/components/pricing-cards";
import { Eyebrow, FinalCta } from "@/components/ui";
import { customAutomationPlans, foundingAgentPlans, seoPlans, websitePlans } from "@/lib/services";

const baselineMetadata: Metadata = {
  title: "Website, SEO & AI Automation Pricing",
  description: "Clear starting prices for professional websites, managed local SEO, focused automation, and managed AI agents from Tailored Agents.",
  alternates: { canonical: "/pricing" },
};

const pricingGroups = [
  ["Websites", "From $1,500", "#websites"],
  ["SEO & Analytics", "From $400/month", "#seo"],
  ["AI agent add-ons", "From $99/month", "#automation"],
] as const;

export default function PricingPage() {
  return (
    <>
      <section className="pricing-page-hero">
        <div className="container-shell pricing-page-hero-grid">
          <div>
            <Eyebrow>Clear pricing</Eyebrow>
            <h1 className="page-title">Serious work. Clear ways to <span className="serif-italic">start.</span></h1>
            <p className="lede">These packages establish a useful starting point without forcing every business into the same solution. Founding-client agent pricing makes expansion accessible, while every engagement still receives a written scope before paid work begins.</p>
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
          <div className="section-heading-wide"><div><Eyebrow>Founding-client AI add-ons</Eyebrow><h2 className="h2">Start with one useful capability. Expand when the value is <span className="serif-italic">clear.</span></h2></div><p className="lede">These introductory monthly offers are designed for repeatable website and business workflows. Availability, fit, usage, integrations, and the standard configuration are confirmed before billing.</p></div>
          <PricingCards plans={foundingAgentPlans} columns={4} />
          <div className="founding-pricing-note"><strong>Why founding-client pricing?</strong><span>We are building our early client base and standardizing these services without reducing the level of management, review, or support. Standard deployments have $0 setup; usage and nonstandard work remain separate.</span></div>
          <div className="pricing-subsection-heading"><Eyebrow>Custom automation & advanced agents</Eyebrow><h2 className="h2">Some systems should be scoped around the <span className="serif-italic">business.</span></h2><p className="lede">Broader integrations, advanced agent responsibilities, portals, and custom software retain implementation pricing and an individually defined support model.</p></div>
          <PricingCards plans={customAutomationPlans} columns={2} />
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
            <details><summary>What does founding-client pricing mean?</summary><p>It is introductory pricing for early clients who are a good fit for a standardized agent configuration. It is not reduced-service work. Availability is limited, and the written scope confirms the responsibility, support, boundaries, usage, and any outside costs.</p></details>
            <details><summary>Does $0 setup apply to every AI agent?</summary><p>No. It applies to the standard configuration of the listed founding-client agents. Custom knowledge preparation, nonstandard call flows, CRM writes, migrations, specialized compliance requirements, broader integrations, and custom software require a separate scope.</p></details>
            <details><summary>How are agent usage costs handled?</summary><p>Voice minutes, phone numbers, text messages, third-party software, and volume beyond an included allowance are identified separately before launch. The exact usage model depends on the selected agent and providers.</p></details>
            <details><summary>When does automation need a tailored proposal?</summary><p>A proposal is needed when a workflow spans several systems, depends on custom APIs or data migration, requires a new interface, or needs broader operational testing and support.</p></details>
          </div>
        </div>
      </section>

      <FinalCta />
    </>
  );
}

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> { return managedMetadata("/pricing", baselineMetadata); }
