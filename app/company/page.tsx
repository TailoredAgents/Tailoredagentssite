import { managedMetadata } from "@/lib/seo/public-metadata";
import type { Metadata } from "next";
import { FinalCta, PageHero } from "@/components/ui";

const baselineMetadata: Metadata = {
  title: "About Tailored Agents",
  description: "Tailored Agents combines digital design, software engineering, local growth expertise, and practical business automation.",
  alternates: { canonical: "/company" },
};

export default function CompanyPage() {
  return (
    <>
      <PageHero eyebrow="About" title={<>Design quality and engineering depth, working toward the <span className="serif-italic">same business goal.</span></>} description="Tailored Agents builds premium websites, manages digital visibility, and develops practical automation and software for growing businesses." meta="Digital design · Growth · Automation · Engineering" />
      <section className="section-pad"><div className="container-shell case-intro"><div><span className="eyebrow">Our perspective</span><h2 className="h2">A website should not be separated from what the business is trying to <span className="serif-italic">become.</span></h2></div><div><p className="lede">The customer experience, search visibility, inquiry flow, internal follow-up, and surrounding business systems all influence one another. We bring design and engineering together so those parts can improve in a deliberate sequence.</p><p className="text-muted">That can begin with a focused website project. It can continue through managed SEO and analytics, targeted automation, integrations, or a custom platform when the opportunity justifies it.</p></div></div></section>
      <section className="section-pad section-rule"><div className="container-shell"><div className="principle-grid">{[['01','Understand the business','We clarify the audience, offer, current experience, growth priorities, and operational constraints before prescribing a solution.'],['02','Design with purpose','Visual quality, content, responsiveness, accessibility, and conversion paths support the same customer journey.'],['03','Use evidence carefully','Analytics and search data inform priorities when they are genuinely configured and available. We do not manufacture proof.'],['04','Automate responsibly','Sensitive, ambiguous, or customer-facing actions retain appropriate review, escalation, and ownership.'],['05','Engineer durable systems','Maintainability, security, permissions, failure behavior, and deployment quality are part of the work.'],['06','Improve in stages','Begin with the clearest opportunity, evaluate real use, and expand when the next investment makes sense.']].map(([n,h,p]) => <div className="principle" key={n}><span>{n}</span><h3>{h}</h3><p>{p}</p></div>)}</div></div></section>
      <section className="section-pad"><div className="content-narrow"><span className="eyebrow">What we are building toward</span><h2 className="h2" style={{marginTop:"1.3rem"}}>A long-term technology partner for businesses with <span className="serif-italic">important growth to support.</span></h2><p className="lede">Our range is intentional: strong customer-facing design at the beginning, disciplined measurement and improvement over time, and serious engineering capability when the business needs more.</p></div></section>
      <FinalCta />
    </>
  );
}

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> { return managedMetadata("/company", baselineMetadata); }
