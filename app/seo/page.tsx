import type { Metadata } from "next";
import { BarChart3, CheckCircle2, FileSearch, Gauge, MapPin, SearchCheck } from "lucide-react";
import { SeoDashboard } from "@/components/growth-visuals";
import { PricingCards } from "@/components/pricing-cards";
import { ArrowLink, Eyebrow, FinalCta } from "@/components/ui";
import { seoPlans } from "@/lib/services";

export const metadata: Metadata = {
  title: "Local SEO, Analytics & Growth Hub",
  description: "Managed local SEO, website analytics, technical improvements, conversion measurement, and a clear client reporting direction for growing service businesses.",
  alternates: { canonical: "/seo" },
};

const seoServices = [
  [SearchCheck, "Technical SEO", "Review indexing foundations, metadata, page structure, internal linking, performance signals, and issues that can limit discoverability."],
  [MapPin, "Local visibility", "Support service-area structure, location relevance, local business information, and Google Business Profile improvement priorities."],
  [Gauge, "Website performance", "Monitor the experience customers receive across important pages and identify practical technical improvements."],
  [BarChart3, "Analytics & conversion measurement", "Configure and review meaningful website events so reporting connects visibility with useful visitor actions."],
  [FileSearch, "Content recommendations", "Identify gaps, clarify high-intent service topics, and improve pages based on business priorities and available evidence."],
  [CheckCircle2, "Ongoing reporting", "See what was reviewed, what changed, why it mattered, and what should be considered next."],
] as const;

export default function SeoPage() {
  return (
    <>
      <section className="service-hero seo-service-hero"><div className="container-shell service-hero-grid"><div><Eyebrow>Managed Local SEO & Analytics</Eyebrow><h1 className="page-title">Make visibility easier to understand—and improvement easier to <span className="serif-italic">manage.</span></h1><p className="lede">We help service businesses strengthen search foundations, understand website performance, and work through prioritized improvements with transparent reporting.</p><div className="hero-actions"><ArrowLink href="/free-review">Get a Free Website Review</ArrowLink><ArrowLink href="/contact">Discuss Ongoing SEO</ArrowLink></div><p className="service-hero-meta">No ranking guarantees · Human-reviewed analysis · Clear reporting</p></div><SeoDashboard compact /></div></section>

      <section className="section-pad seo-dashboard-section"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>Tailored Growth Hub concept</Eyebrow><h2 className="h2">Signals become priorities. Priorities become <span className="serif-italic">visible work.</span></h2></div><p className="lede">The Growth Hub direction brings monitored signals, completed work, recommended priorities, and future automation activity into one client workspace. The interface below is illustrative and uses synthetic data.</p></div><SeoDashboard /></div></section>

      <section className="section-pad seo-service-section"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>Managed service</Eyebrow><h2 className="h2">The foundations, the evidence, and the <span className="serif-italic">follow-through.</span></h2></div><p className="lede">Search visibility depends on many connected factors. We focus on practical work we can explain and evaluate—not opaque activity or guaranteed outcomes.</p></div><div className="seo-service-grid">{seoServices.map(([Icon,title,text], index)=><article key={title}><span><Icon size={18}/></span><em>0{index+1}</em><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

      <section className="section-pad dark-section seo-method-section"><div className="container-shell"><div className="infrastructure-heading"><div><Eyebrow>How the service works</Eyebrow><h2 className="h2">Continuous attention, with <span className="serif-italic">human judgment.</span></h2></div><p className="lede">Tools and AI-assisted analysis can help organize evidence. Recommendations and business decisions still require context, review, and clear ownership.</p></div><div className="seo-method-grid">{[["01","Measure","Review search, website, and inquiry signals that are actually configured and available."],["02","Diagnose","Separate technical issues, content gaps, local visibility opportunities, and measurement problems."],["03","Improve","Complete or coordinate prioritized changes within the agreed monthly scope."],["04","Explain","Report completed work, observed signals, open questions, and recommended next steps."]].map(([n,h,p])=><article key={n}><span>{n}</span><h3>{h}</h3><p>{p}</p></article>)}</div><p className="evidence-note">Search engines control rankings, and market conditions change. We do not guarantee positions, traffic, leads, or revenue.</p></div></section>

      <section className="section-pad package-section package-section-alt" id="pricing"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>Managed SEO packages</Eyebrow><h2 className="h2">Choose the improvement cadence that fits the <span className="serif-italic">business.</span></h2></div><p className="lede">Both plans begin with a one-time foundation setup, then continue month to month without a long-term SEO commitment. Normal analytics and reporting are included. Our planned, human-reviewed SEO intelligence layer will support these subscriptions rather than become a separate agent fee.</p></div><PricingCards plans={seoPlans} columns={2}/><p className="seo-intelligence-note"><strong>Human review remains the boundary.</strong> SEO intelligence is not presented as active autonomous publishing. Recommendations and proposed changes stay reviewable, evidence-based, and accountable as the capability is introduced.</p><div className="package-section-link"><ArrowLink href="/packages">Explore website + SEO packages</ArrowLink></div></div></section>
      <FinalCta />
    </>
  );
}
