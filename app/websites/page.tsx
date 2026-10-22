import { managedMetadata } from "@/lib/seo/public-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { Accessibility, ArrowRight, Bot, Gauge, LayoutTemplate, Search, Smartphone } from "lucide-react";
import { WebsiteConceptGallery } from "@/components/growth-visuals";
import { PricingCards } from "@/components/pricing-cards";
import { ArrowLink, Eyebrow, FinalCta } from "@/components/ui";
import { websitePlans } from "@/lib/services";

const baselineMetadata: Metadata = {
  title: "Website Design & Development",
  description: "Premium, responsive website design and development for service businesses that need credibility, clarity, performance, and better inquiry paths.",
  alternates: { canonical: "/websites" },
};

const capabilities = [
  [LayoutTemplate, "Custom design systems", "A visual direction and reusable interface system shaped around your brand, services, and audience—not a generic agency template."],
  [Smartphone, "Responsive by design", "Desktop, tablet, and mobile layouts are considered together so the experience stays clear wherever a customer finds you."],
  [Gauge, "Performance-minded delivery", "Lean implementation, stable layouts, careful loading behavior, and production checks support a faster, more dependable experience."],
  [Accessibility, "Accessible interactions", "Semantic structure, keyboard support, visible focus states, readable contrast, and reduced-motion preferences are part of the build."],
  [Search, "Search foundations", "Technical metadata, clear page structure, crawlable content, sitemap support, and local-service architecture establish a useful SEO foundation."],
  [ArrowRight, "Conversion paths", "Calls, forms, service requests, and next steps are placed deliberately so interested visitors can move forward without friction."],
] as const;

export default function WebsitesPage() {
  return (
    <>
      <section className="service-hero website-service-hero">
        <div className="container-shell service-hero-grid">
          <div><Eyebrow>Website Design & Development</Eyebrow><h1 className="page-title">A better website should make the business feel <span className="serif-italic">better, too.</span></h1><p className="lede">We create premium service-business websites that explain the offer clearly, build trust quickly, perform across devices, and give interested visitors an obvious next step.</p><div className="hero-actions"><ArrowLink href="/free-review">Get a Free Website Review</ArrowLink><Link className="button button-light" href="/work">View Design Concepts<ArrowRight size={15}/></Link></div><p className="service-hero-meta">Custom strategy · Design · Development · Launch support</p></div>
          <div className="website-hero-stack"><div className="website-hero-window"><div className="concept-browser-bar"><span><i/><i/><i/></span><b>yourbusiness.com</b><em>Responsive concept</em></div><div className="website-wire-nav"><b>YOUR BRAND</b><span>Services</span><span>Work</span><span>About</span><i>Get started</i></div><div className="website-wire-hero"><small>Clear value proposition</small><strong>A website that earns attention—and makes the next step easy.</strong><p>Purposeful content, refined visual direction, and responsive conversion paths.</p><span>Primary action <ArrowRight size={12}/></span></div><div className="website-wire-cards"><i/><i/><i/></div></div><div className="website-hero-phone"><span/><b>YOUR BRAND</b><small>Mobile-first clarity</small><strong>Built for every screen.</strong><i>Get started</i></div></div>
        </div>
      </section>

      <section className="section-pad">
        <div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>Selected directions</Eyebrow><h2 className="h2">Designed to feel specific to the <span className="serif-italic">business.</span></h2></div><p className="lede">These original concepts demonstrate different visual systems for established service companies. They are design concepts, not client projects or performance claims.</p></div><WebsiteConceptGallery /></div>
      </section>

      <section className="section-pad website-capability-section">
        <div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>What the build includes</Eyebrow><h2 className="h2">Polish on the surface. Discipline <span className="serif-italic">underneath.</span></h2></div><p className="lede">The website is treated as a working business system: messaging, interface, performance, search foundations, accessibility, and inquiry handling all reinforce one another.</p></div><div className="website-capability-grid">{capabilities.map(([Icon,title,text], index) => <article key={title}><span><Icon size={19}/></span><em>0{index + 1}</em><h3>{title}</h3><p>{text}</p></article>)}</div></div>
      </section>

      <section className="section-pad web-scope-section">
        <div className="container-shell service-scope-grid"><div><Eyebrow>A clear project scope</Eyebrow><h2 className="h2">Built around what customers need to <span className="serif-italic">understand and do.</span></h2><p className="lede">We define the information architecture, content responsibilities, page set, functionality, review process, and launch requirements before development expands.</p></div><div className="scope-list">{[["Strategy & structure","Audience, services, page hierarchy, content plan, and conversion paths."],["Visual design","Brand direction, responsive layouts, interface components, and interaction details."],["Development","Production implementation, forms, foundational metadata, testing, and deployment support."],["Launch & improvement","Final checks, handoff, measurement planning, and optional ongoing growth work."]].map(([title,text], index)=><div key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></div>)}</div></div>
      </section>

      <section className="section-pad process-section">
        <div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>Development process</Eyebrow><h2 className="h2">From business context to a <span className="serif-italic">finished experience.</span></h2></div><p className="lede">Each phase resolves a different kind of uncertainty before the site is asked to perform in public.</p></div><div className="process-grid">{[["01","Discover","Clarify the audience, offer, differentiators, content, and technical needs."],["02","Design","Establish visual direction, page composition, and responsive behavior."],["03","Develop","Build the production site, interactions, forms, and SEO foundations."],["04","Launch","Verify quality, connect delivery systems, deploy, and identify next improvements."]].map(([n,h,p])=><div className="process-item" key={n}><span>{n}</span><h3>{h}</h3><p>{p}</p></div>)}</div></div>
      </section>

      <section className="section-pad website-agent-section">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>Built to expand</Eyebrow><h2 className="h2">The website can become more useful <span className="serif-italic">over time.</span></h2></div><p className="lede">Launch the customer experience first. When the business is ready, add a managed chat assistant, lead qualification, booking handoff, follow-up, or voice-enabled help without turning the original project into an oversized build.</p></div>
          <div className="package-agent-bridge"><span><Bot size={20} aria-hidden="true" /></span><div><small>Founding-client website agents</small><h3>Standard website assistants begin at $99 per month with $0 setup.</h3><p>Availability is limited, and the standard configuration, knowledge readiness, usage, and handoff boundaries are confirmed before billing.</p></div><Link href="/automation#founding-pricing">Explore website agents<ArrowRight size={14} aria-hidden="true" /></Link></div>
        </div>
      </section>

      <section className="section-pad package-section package-section-alt" id="pricing"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>Website packages</Eyebrow><h2 className="h2">A competitive place to start, with room to <span className="serif-italic">grow.</span></h2></div><p className="lede">Choose a focused launch scope or expand the build when more content, integrations, and customer-facing functionality are useful. Final deliverables and pricing are confirmed in writing.</p></div><PricingCards plans={websitePlans}/><div className="package-section-link"><ArrowLink href="/pricing">View all pricing details</ArrowLink></div></div></section>
      <FinalCta />
    </>
  );
}

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> { return managedMetadata("/websites", baselineMetadata); }
