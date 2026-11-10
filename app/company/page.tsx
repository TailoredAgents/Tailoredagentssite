import { publicPageMetadata } from "@/lib/site";
import { managedMetadata } from "@/lib/seo/public-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { ArrowLink, Eyebrow, FinalCta, PageHero } from "@/components/ui";

const baselineMetadata = publicPageMetadata(
  "About Tailored Agents",
  "Meet the Georgia-based team building custom AI, business automation and software. Practical solutions, personal relationships and a clear path from idea to implementation.",
  "/company",
);

export default function CompanyPage() {
  return <>
    <PageHero eyebrow="About Tailored Agents" title={<>People who care how your business <span className="serif-italic">works.</span></>} description="We’re a Georgia-based team building custom AI agents, automation and software around the people doing the work. Our first step is understanding your business, not prescribing a technology." meta="Based in Georgia · Built around your business" />
    <section className="section-pad business-team-section"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>Start a conversation</Eyebrow><h2 className="h2">Meet Austin<br/>and <span className="serif-italic">Jeffrey.</span></h2></div><p className="lede">Whether we met at a local business event or someone made an introduction, we’d like to hear how your business works and what you’re trying to improve.</p></div><div className="business-team-grid">{[["/team/austin-dugger.png","Austin Dugger","austin"],["/team/jeffrey-hacker.jpeg","Jeffrey Hacker","jeffrey"]].map(([portrait,name,slug])=><article key={slug}><div className="business-team-portrait"><Image src={portrait} alt={name} width={560} height={600} sizes="(max-width: 700px) 90vw, 42vw"/></div><div><h3>{name}</h3><p>Development &amp; Sales</p><Link className="business-text-link" href={`/c/${slug}`}>Contact {name.split(" ")[0]}<ArrowRight size={16}/></Link></div></article>)}</div></div></section>
    <section className="section-pad"><div className="container-shell case-intro"><div><Eyebrow>Our direction</Eyebrow><h2 className="h2">Better connections.<br/>Less repeated work.<br/><span className="serif-italic">More room to move.</span></h2></div><div><p className="lede">We bring software development and business conversations together. The opportunity might be a lead that needs a faster response, a document that gets entered three times or a team that cannot find the information it needs.</p><p className="text-muted">AI and automation are our focus. Website development, SEO and analytics remain part of our work, available independently or alongside a custom solution. You can start with whichever part of the business needs attention.</p><ArrowLink href="/solutions">Explore the work we can help with</ArrowLink></div></div></section>
    <section className="section-pad"><div className="container-shell"><div className="principle-grid">{[["01","Understand the work","Learn the process, people, information and constraints before recommending a solution."],["02","Scope a practical start","Agree on a useful outcome, responsibilities, costs and what success should look like."],["03","Build for everyday use","Connect the right tools and make the experience clear for the people using it."],["04","Keep people in control","Set appropriate permissions, review, escalation and ownership for the agent’s work."],["05","Test the real workflow","Check integrations, failure behavior and exceptions alongside the intended experience."],["06","Support what we agree","Define ongoing monitoring, maintenance and improvements in the service agreement."]].map(([n,h,p])=><div className="principle" key={n}><span>{n}</span><h3>{h}</h3><p>{p}</p></div>)}</div></div></section>
    <section className="section-pad business-partner-section"><div className="container-shell business-services"><div><Eyebrow>Know someone we should meet?</Eyebrow><h2 className="h2">A good introduction starts<br/>with a <span className="serif-italic">real problem.</span></h2><p className="lede">Think of us when an owner is dealing with repetitive work, scattered information, missed follow-up or a workflow their current software does not handle well.</p></div><div><ArrowLink href="/partners">Partnerships & revenue sharing</ArrowLink><ArrowLink href="/contact?interest=partnership">Make an introduction</ArrowLink></div></div></section>
    <FinalCta/>
  </>;
}

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> { return managedMetadata("/company", baselineMetadata); }
