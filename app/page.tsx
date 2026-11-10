import { publicPageMetadata } from "@/lib/site";
import { managedMetadata } from "@/lib/seo/public-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Cable, FileText, Handshake, MessagesSquare, Search, Workflow } from "lucide-react";
import { BusinessWorkflowDemo } from "@/components/business-workflow-demo";
import { ArrowLink, Eyebrow, FinalCta } from "@/components/ui";

const baselineMetadata = publicPageMetadata(
  "Custom AI Agents & Business Automation",
  "Georgia-based Tailored Agents builds custom AI agents, workflow automation and software around your business. Explore solutions, ongoing support and partnerships.",
  "/",
);

const opportunities = [
  [MessagesSquare,"Follow up while the opportunity is fresh","Organize incoming leads, prepare relevant replies, and help the right person take the next step."],
  [Cable,"Connect the tools your team already uses","Move information between supported systems so people spend less time copying the same details."],
  [FileText,"Turn documents into useful information","Extract and check details, match them to records, and route exceptions for review."],
  [Workflow,"Make reporting easier to act on","Bring scattered updates into a useful summary, with the evidence behind it."],
  [Search,"Help your team find the answer","Build assistants around approved business knowledge, with sources and a clear path to a person."],
] as const;

export default function Home() {
  return <>
    <section className="business-hero">
      <div className="container-shell business-hero-grid">
        <div className="business-hero-copy"><Eyebrow>Custom AI · Automation · Software</Eyebrow><h1>AI that works<br/>around <em>your<br className="business-title-break"/> business.</em></h1><p className="lede">We build custom AI agents and automation that reduce repetitive work, connect your systems, and give your team more time for the work that matters.</p><div className="hero-actions"><ArrowLink href="/contact">Let’s talk about your business</ArrowLink><Link className="business-text-link" href="/solutions">Explore solutions<ArrowRight size={16}/></Link></div><p className="business-location">Based in Georgia. Built for businesses wherever they operate.</p></div>
        <BusinessWorkflowDemo/>
      </div>
      <div className="container-shell business-capabilities"><span>Custom AI agents</span><span>Workflow automation</span><span>Connected software</span><span>Ongoing support</span></div>
    </section>

    <section className="business-case section-pad"><div className="container-shell business-case-grid">
      <div><Eyebrow>Inside our work · StonegateOS</Eyebrow><h2 className="h2">From a conversation<br/>to a <span className="serif-italic">clear next step.</span></h2><p className="lede">Customer conversations, follow-up and job details shouldn’t live in separate places. StonegateOS brings them into a connected operating platform for a service business.</p><ArrowLink href="/work/stonegateos" light>Explore the engineering case study</ArrowLink></div>
      <div className="business-case-workflow"><span className="micro-label">One workflow in the platform</span><ol>{[["Capture the conversation","Keep a customer call connected to its business context."],["Prepare the useful details","Transcription and analysis can turn the recording into structured information."],["Put context with the customer","Prepare CRM documentation so the next person can pick up the conversation."],["Keep a person in control","Review suggested next steps and sensitive actions before carrying them out."]].map(([title,text],index)=><li key={title}><span>0{index+1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol><p className="business-case-note">An actively developed internal platform. Capabilities depend on configuration; this is not a claim that every workflow is verified live.</p></div>
    </div></section>

    <section className="section-pad"><div className="container-shell business-opportunities"><div><Eyebrow>Start with the work</Eyebrow><h2 className="h2">Where does your team<br/>keep getting <span className="serif-italic">stuck?</span></h2><p className="lede">You don’t need to know which AI to buy. Bring us the repeated task, awkward handoff or missing connection. We’ll help work out what’s worth building.</p><p className="text-muted">These are examples of solutions we can scope, not a list of ready-made products.</p></div><div className="business-problem-list">{opportunities.map(([Icon,title,text],index)=><article key={title}><span><Icon size={21}/></span><div><small>0{index+1}</small><h3>{title}</h3><p>{text}</p></div></article>)}</div></div></section>

    <section className="section-pad business-industry-section"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>Focused opportunities</Eyebrow><h2 className="h2">Real workflows.<br/><span className="serif-italic">Different industries.</span></h2></div><p className="lede">We start with how the work gets done. Explore two areas we’re focused on, or talk with us about a different business.</p></div><div className="business-industry-grid"><Link href="/solutions/commercial-insurance"><span>01 / Commercial insurance</span><h3>Less document chasing.<br/>More time for clients.</h3><p>Explore intake, document preparation and review workflows for agency teams.</p><b>Explore insurance automation<ArrowRight size={17}/></b></Link><Link href="/solutions/freight-automation"><span>02 / Freight brokerages &amp; 3PL</span><h3>Keep the paperwork<br/>moving with the freight.</h3><p>Explore delivery documents, invoice checks and billing preparation around your operation.</p><b>Explore freight automation<ArrowRight size={17}/></b></Link></div></div></section>

    <section className="section-pad"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>How we work together</Eyebrow><h2 className="h2">Understand it.<br/>Build it. <span className="serif-italic">Improve it.</span></h2></div><p className="lede">Start with one useful opportunity and a clear scope. Implementation, ongoing support and improvements are agreed around what your business needs.</p></div><div className="business-process">{[["Understand","Walk through the workflow, the people involved, the systems you use and where time gets lost."],["Scope","Agree on a practical solution, connections, human checkpoints, costs and what success should look like."],["Build & implement","Develop the solution, test it with your team and prepare the handoff into everyday use."],["Support & improve","Provide the monitoring, maintenance and improvements included in your support agreement."]].map(([title,text],index)=><article key={title}><span>0{index+1}</span><h3>{title}</h3><p>{text}</p></article>)}</div><div className="section-end-link"><Link className="business-text-link" href="/pricing">How we scope and price the work<ArrowRight size={16}/></Link></div></div></section>

    <section className="section-pad section-rule"><div className="container-shell business-services"><div><Eyebrow>Our full range</Eyebrow><h2 className="h2">The right tools for<br/>the <span className="serif-italic">whole business.</span></h2><p className="lede">AI and automation are our focus. Websites, search visibility and custom software remain part of what we do—available together or as separate engagements.</p></div><div>{[["AI agents & automation","/automation"],["Custom software & integrations","/engineering"],["Website design & development","/websites"],["SEO & analytics","/seo"],["Website & SEO packages","/packages"]].map(([title,href])=><Link href={href} key={href}>{title}<ArrowRight size={18}/></Link>)}</div></div></section>

    <section className="section-pad business-partner-section"><div className="container-shell business-partner"><div className="business-partner-icon"><Handshake size={32}/></div><div><Eyebrow>Build with us</Eyebrow><h2 className="h2">Good relationships create<br/><span className="serif-italic">new possibilities.</span></h2><p>Know a business we could help? Have an audience, industry expertise or an idea for a joint solution? Let’s discuss referrals, delivery partnerships or our revenue-share program.</p></div><ArrowLink href="/partners">Explore partnerships</ArrowLink></div></section>
    <FinalCta/>
  </>;
}

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> { return managedMetadata("/", baselineMetadata); }
