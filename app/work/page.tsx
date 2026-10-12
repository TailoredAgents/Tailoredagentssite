import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductWindow } from "@/components/product-window";
import { Eyebrow, FinalCta, PageHero } from "@/components/ui";

export const metadata: Metadata = {
  title: "Our Work",
  description: "Explore StonegateOS and the practical engineering capabilities behind Tailored Agents' connected business systems.",
  alternates: { canonical: "/work" },
};

export default function WorkPage() {
  return (
    <>
      <PageHero eyebrow="Our work" title={<>Evidence in the <span className="serif-italic">system.</span></>} description="We use our own operating environment to confront the difficult parts of applied AI: fragmented data, real workflows, edge cases, permissions, integrations, and human accountability." meta="Featured project · StonegateOS" />
      <section className="dark-section section-pad">
        <div className="container-shell showcase-intro">
          <div className="showcase-copy"><Eyebrow>Flagship internal platform</Eyebrow><h2 className="h2">StonegateOS</h2></div>
          <div className="showcase-copy"><p className="lede">A connected operating platform created around the requirements of a service business—from customer acquisition and quoting to field execution, partner coordination, intelligence, and oversight.</p><p className="text-muted">The public repository shows a production-oriented monorepo spanning a customer website, desktop Team Console, phone-first field application, Partner Portal, API services, and durable workers.</p><Link className="button button-ghost" href="/work/stonegateos">Explore the case study<ArrowRight size={15}/></Link></div>
        </div>
        <div className="container-shell product-stage">
          <ProductWindow />
        </div>
      </section>
      <section className="section-pad">
        <div className="container-shell"><div className="intro-grid"><Eyebrow>Capability evidence</Eyebrow><h2 className="h2">The work behind the <span className="serif-italic">interface.</span></h2></div>
          <div className="principle-grid" style={{marginTop:"4rem"}}>
            {[['01','Operational modeling','Customer, property, lead, quote, appointment, conversation, partner, and financial records form a connected operating model.'],['02','Intelligent workflows','Call transcription, coaching, drafting, marketing analysis, document work, and automation run through controlled workflows.'],['03','Multiple user contexts','Customers, office teams, field operators, partners, and owners each receive a purpose-built interface and permission boundary.'],['04','Provider integrations','Communication, advertising, calendar, payment, media, and AI providers connect through defined application boundaries.'],['05','Durable processing','Background work uses queued events, retries, scheduled tasks, and operational health signals instead of relying on fragile request chains.'],['06','Operational safeguards','Authentication, route permissions, feature gates, audit evidence, and explicit approvals govern higher-impact actions.']].map(([n,h,p]) => <div className="principle" key={n}><span>{n}</span><h3>{h}</h3><p>{p}</p></div>)}
          </div>
        </div>
      </section>
      <FinalCta />
    </>
  );
}
