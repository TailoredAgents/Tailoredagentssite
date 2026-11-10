import { publicPageMetadata } from "@/lib/site";
import { managedMetadata } from "@/lib/seo/public-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, FileCheck2, Handshake, ReceiptText } from "lucide-react";
import { PricingCards } from "@/components/pricing-cards";
import { Eyebrow, FinalCta } from "@/components/ui";
import { customAutomationPlans, foundingAgentPlans, seoPlans, websitePlans } from "@/lib/services";

const baselineMetadata = publicPageMetadata(
  "Custom AI, Automation & Service Pricing",
  "Custom AI and automation scoped around your business, plus transparent pricing for focused workflows, websites, SEO and standard managed agents.",
  "/pricing",
);

const pricingGroups = [
  ["Custom systems", "Tailored proposal", "#custom-solutions"],
  ["Implementation", "Defined scope", "#custom-solutions"],
  ["Ongoing support", "Agreed service plan", "#custom-solutions"],
  ["AI & provider usage", "Identified separately", "#custom-solutions"],
] as const;

export default function PricingPage() {
  return (
    <>
      <section className="pricing-page-hero">
        <div className="container-shell pricing-page-hero-grid">
          <div>
            <Eyebrow>Clear pricing</Eyebrow>
            <h1 className="page-title">A clear scope. Built around <span className="serif-italic">your business.</span></h1>
            <p className="lede">Custom AI and automation pricing depends on the workflow, integrations, implementation, ongoing management and usage. We agree on a written scope before paid work begins. Existing website, SEO and standard agent offers remain available below.</p>
            <div className="hero-actions"><Link className="button button-dark" href="/contact">Discuss your business</Link><Link className="button button-light" href="#websites">View standard service prices<ArrowDown size={15} aria-hidden="true" /></Link></div>
          </div>
          <aside className="pricing-hero-panel" aria-label="What a custom engagement includes">
            <span className="micro-label blue">How custom work is priced</span>
            {pricingGroups.map(([label, price, href]) => <Link href={href} key={label}><span>{label}</span><strong>{price}</strong><ArrowDown size={14} aria-hidden="true" /></Link>)}
            <p>We scope the work with you. The proposal defines deliverables, responsibilities, support, usage and what would change the price.</p>
          </aside>
        </div>
      </section>

      <section className="section-pad package-section package-section-alt" id="custom-solutions">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>Custom AI & automation</Eyebrow><h2 className="h2">From one useful workflow to a <span className="serif-italic">connected system.</span></h2></div><p className="lede">Start with a specific operational need. Larger systems receive a tailored proposal; the focused-workflow starting price below applies only to its defined scope.</p></div>
          <PricingCards plans={[customAutomationPlans[1], customAutomationPlans[0]]} columns={2} />
          <p className="business-pricing-note">Exploring a delivery partnership or revenue-share arrangement? <Link href="/partners">Let’s discuss the fit and terms privately.</Link></p>
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
          <div><Eyebrow>Pricing questions</Eyebrow><h2 className="h2">Know what affects the <span className="serif-italic">number.</span></h2><p className="lede">A business conversation helps us understand what you need. A free website review is also available for website-specific opportunities.</p></div>
          <div className="pricing-faq-list">
            <details><summary>How do you price a custom AI solution?</summary><p>We look at the workflow, the data and systems involved, integration access, implementation, testing, ongoing support and expected usage. Those details become a tailored proposal. There is no single published minimum for a custom system.</p></details>
            <details><summary>Do I need a new website to use your AI services?</summary><p>No. We can begin with an internal process, a customer workflow or a connection between your existing tools. Website projects are a separate option.</p></details>
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
