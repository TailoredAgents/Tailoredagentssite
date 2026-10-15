import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, MapPinned, MessageSquareReply, Search, Smartphone, Star } from "lucide-react";
import { GrowthHeroVisual } from "@/components/growth-visuals";
import { ArrowLink, Eyebrow, FinalCta } from "@/components/ui";

export const metadata: Metadata = {
  title: "HVAC Website Design, Local SEO & Automation",
  description: "Premium HVAC website development, local search visibility, inquiry flows, and targeted automation for established heating and cooling businesses.",
  alternates: { canonical: "/industries/hvac" },
};

const hvacNeeds = [
  [Smartphone, "Fast mobile service paths", "Help homeowners choose repair, replacement, maintenance, or emergency contact paths without searching through a crowded site."],
  [Search, "Heating and cooling service pages", "Explain important services clearly and create useful pages around the work customers are actively trying to find."],
  [MapPinned, "Service-area clarity", "Present the communities you serve accurately, with useful local context rather than thin, duplicated location pages."],
  [CalendarClock, "Quote and appointment inquiries", "Collect the right initial details and route the request into an understandable next step for the customer and office team."],
  [Star, "Reputation workflows", "Create appropriate review-request and feedback paths around completed work, without fabricated social proof or manipulative claims."],
  [MessageSquareReply, "Lead follow-up automation", "Prepare notifications, follow-up tasks, and customer communication around defined rules as the business is ready to automate."],
] as const;

export default function HvacPage() {
  return (
    <>
      <section className="growth-hero hvac-landing-hero"><div className="growth-hero-atmosphere" aria-hidden="true"/><div className="container-shell growth-hero-grid"><div className="growth-hero-copy"><Eyebrow>Digital growth for HVAC companies</Eyebrow><h1 className="growth-display"><span>A better HVAC</span><span>website is part of</span><span>the <em>service experience.</em></span></h1><p className="lede">We help established heating and cooling businesses present their services clearly, strengthen local visibility, capture better inquiries, and introduce practical follow-up automation.</p><div className="hero-actions"><ArrowLink href="/free-review">Get a Free Website Review</ArrowLink><Link href="/websites" className="button button-light">Explore Website Development<ArrowRight size={15}/></Link></div><div className="growth-proof-row"><span>HVAC-relevant strategy</span><span>Industry-independent technology</span><span>No ranking guarantees</span></div></div><GrowthHeroVisual/></div></section>

      <section className="section-pad"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>Built around the customer journey</Eyebrow><h2 className="h2">From urgent repair to planned replacement, make every path <span className="serif-italic">clear.</span></h2></div><p className="lede">An HVAC website has to serve different needs, levels of urgency, service areas, and equipment questions—often from a phone and under time pressure.</p></div><div className="hvac-need-grid">{hvacNeeds.map(([Icon,title,text],index)=><article key={title}><span><Icon size={19}/></span><em>0{index+1}</em><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

      <section className="section-pad hvac-map-section"><div className="container-shell hvac-map-grid"><div><Eyebrow>Local visibility</Eyebrow><h2 className="h2">Make location and service relevance easier to <span className="serif-italic">understand.</span></h2><p className="lede">We help organize service pages, service-area information, technical foundations, and local business signals into a coherent experience for customers and search systems.</p><ul className="check-list light-check-list"><li>Accurate service coverage</li><li>Useful heating and cooling pages</li><li>Google Business Profile support</li><li>Search Console and analytics monitoring</li><li>Conversion event planning</li><li>Ongoing improvement priorities</li></ul></div><div className="local-visibility-map" aria-hidden="true"><div className="map-grid-lines"/><span className="map-point point-1"><i/>Primary service area</span><span className="map-point point-2"><i/>Heating services</span><span className="map-point point-3"><i/>Cooling services</span><div className="map-search-card"><Search size={15}/><span><small>High-intent search</small><b>air conditioning repair near me</b></span><em>Review</em></div></div></div></section>

      <section className="section-pad automation-handoff-section"><div className="container-shell service-scope-grid"><div><Eyebrow>Automation when it makes sense</Eyebrow><h2 className="h2">The website can become the front door to a <span className="serif-italic">better workflow.</span></h2><p className="lede">As inquiry volume and operational needs grow, we can connect website requests to customer communication, scheduling, CRM records, call intelligence, and internal tools.</p><ArrowLink href="/automation">Explore Business Automation</ArrowLink></div><div className="hvac-lead-flow">{[["01","Inquiry captured","Service, location, urgency, and preferred contact path."],["02","Team notified","The right office workflow receives a structured request."],["03","Follow-up prepared","Approved communication or task is ready for review."],["04","Record updated","Relevant systems retain the customer and next-step context."]].map(([n,h,p])=><div key={n}><i>{n}</i><span><b>{h}</b><small>{p}</small></span></div>)}</div></div></section>
      <FinalCta />
    </>
  );
}
