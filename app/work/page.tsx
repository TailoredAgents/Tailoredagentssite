import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WebsiteConceptGallery } from "@/components/growth-visuals";
import { ProductWindow } from "@/components/product-window";
import { Eyebrow, FinalCta, PageHero } from "@/components/ui";

export const metadata: Metadata = {
  title: "Our Work & Design Concepts",
  description: "Explore original service-business website concepts and StonegateOS, Tailored Agents' connected operating platform and engineering showcase.",
  alternates: { canonical: "/work" },
};

export default function WorkPage() {
  return (
    <>
      <PageHero eyebrow="Our work" title={<>Design on the surface. Serious systems <span className="serif-italic">underneath.</span></>} description="Our work spans customer-facing website concepts and a sophisticated internal operating platform. Concept work is labeled clearly; StonegateOS is an actively developed internal engineering project." meta="Website concepts · Internal engineering platform" />
      <section className="section-pad"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>Website design concepts</Eyebrow><h2 className="h2">Original directions for service businesses that want to look <span className="serif-italic">established.</span></h2></div><p className="lede">These concepts demonstrate our design and development capabilities. They are not presented as client engagements, testimonials, or performance results.</p></div><WebsiteConceptGallery/><div className="section-end-link"><Link className="button button-dark" href="/websites">Explore Website Development<ArrowRight size={15}/></Link></div></div></section>
      <section className="dark-section section-pad">
        <div className="container-shell showcase-intro"><div className="showcase-copy"><Eyebrow>Flagship internal platform</Eyebrow><h2 className="h2">StonegateOS</h2></div><div className="showcase-copy"><p className="lede">A connected operating platform developed around the requirements of a service business—from customer acquisition and quoting to field execution, partner coordination, intelligence, and oversight.</p><p className="text-muted">StonegateOS demonstrates the application architecture, interfaces, integrations, durable workflows, and AI-assisted capabilities behind our broader technical work.</p><Link className="button button-ghost" href="/work/stonegateos">Explore the case study<ArrowRight size={15}/></Link></div></div>
        <div className="container-shell product-stage"><ProductWindow/></div>
      </section>
      <section className="section-pad"><div className="container-shell"><div className="intro-grid"><Eyebrow>Capability evidence</Eyebrow><h2 className="h2">The work behind the <span className="serif-italic">interface.</span></h2></div><div className="principle-grid" style={{marginTop:"4rem"}}>{[["01","Digital experience","Responsive customer journeys, clear content systems, interaction design, accessibility, and conversion paths."],["02","Connected operations","Customer, lead, quote, appointment, communication, partner, and field workflows modeled together."],["03","Intelligent workflows","Call analysis, drafting, marketing analysis, structured extraction, and automation with deliberate review."],["04","Multiple user contexts","Customer, office, field, partner, and owner interfaces shaped around distinct responsibilities."],["05","Provider integrations","Communication, advertising, calendar, payment, media, and AI services connected through defined boundaries."],["06","Durable engineering","Permissions, events, retries, feature gates, monitoring, and explicit approval for higher-impact actions."]].map(([n,h,p])=><div className="principle" key={n}><span>{n}</span><h3>{h}</h3><p>{p}</p></div>)}</div></div></section>
      <FinalCta />
    </>
  );
}
