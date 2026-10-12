import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductWindow } from "@/components/product-window";
import { WorkflowShowcase } from "@/components/workflow-showcase";
import { ArrowLink, Eyebrow, FinalCta } from "@/components/ui";

export const metadata: Metadata = {
  title: "Custom AI Agents & Software Engineering",
  description: "Tailored Agents engineers custom AI agents, intelligent automation, and connected software for real business operations.",
  alternates: { canonical: "/" },
};

const capabilities = [
  ["AI Agents & Intelligence", "Purpose-built agents that interpret business information, support decisions, and assist with structured tasks."],
  ["Intelligent Automation", "Connected workflows that reduce repetitive work and keep operational information synchronized."],
  ["Custom Software Engineering", "Applications, internal platforms, integrations, and interfaces designed around specific business requirements."],
];

const solutions = [
  { label: "Customer Engagement", title: "Useful answers. Clear handoffs.", text: "Qualify inquiries, prepare approved responses, coordinate next steps, and keep customer records current—with deliberate escalation when judgment matters.", tags: ["Qualification", "Messaging", "Scheduling"] },
  { label: "Call Intelligence", title: "Turn conversations into context.", text: "Transcribe recorded calls, extract decision-relevant details, draft structured CRM notes, and give managers practical coaching signals.", tags: ["Transcription", "CRM notes", "Coaching"] },
  { label: "Marketing Intelligence", title: "Make campaign data legible.", text: "Connect advertising and content workflows so teams can evaluate search terms, understand performance, and review specific recommendations.", tags: ["Google Ads", "Analysis", "Editorial workflows"] },
  { label: "Operations Automation", title: "Move work across the system.", text: "Coordinate documents, job information, media, reporting, and routine administrative processes across the tools your team already uses.", tags: ["Extraction", "Synchronization", "Human review"] },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container-shell hero-grid">
          <div className="hero-copy">
            <Eyebrow>AI engineering & custom software</Eyebrow>
            <h1 className="display">Intelligence built into the way <span className="serif-italic">you work.</span></h1>
            <p className="lede">We engineer custom AI agents, intelligent automation, and connected software systems designed around the way businesses actually operate.</p>
            <div className="hero-actions"><ArrowLink href="/work">Explore Our Work</ArrowLink><Link className="button button-light" href="/contact">Discuss a Project<ArrowRight size={15}/></Link></div>
          </div>
          <div className="hero-side">
            <div className="signal-panel" aria-label="Conceptual business system orchestration diagram">
              <div className="signal-head"><span>Operational system</span><span className="signal-live">Connected</span></div>
              <div className="signal-canvas">
                <div className="signal-node"><b>Customer inquiry</b><span>Intent · Timing · Context</span></div>
                <div className="signal-node"><b>Business rules</b><span>Validate · Route · Approve</span></div>
                <div className="signal-node"><b>Connected record</b><span>CRM · Tasks · Follow-up</span></div>
                <span className="signal-line one"/><span className="signal-line two"/><span className="signal-focus">INTELLIGENCE<br/>LAYER</span>
              </div>
            </div>
            <div className="hero-index"><span className="mono">01 / 04</span><span>Systems that interpret information, coordinate work, and support better decisions.</span></div>
          </div>
        </div>
      </section>

      <section className="section-pad section-rule">
        <div className="container-shell intro-grid">
          <div><Eyebrow>What we build</Eyebrow></div>
          <div>
            <h2 className="h2">Software shaped around the <span className="serif-italic">operation.</span></h2>
            <div className="capability-list">
              {capabilities.map(([name, text], index) => <div className="capability-row" key={name}><span className="num">0{index + 1}</span><h3>{name}</h3><p>{text}</p></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="dark-section section-pad">
        <div className="container-shell showcase-grid">
          <div className="showcase-copy">
            <Eyebrow>Featured work · StonegateOS</Eyebrow>
            <h2 className="h2">Built for the complexity of <span className="serif-italic">real operations.</span></h2>
            <p className="lede">StonegateOS brings customer acquisition, communications, scheduling, quoting, field operations, business intelligence, and AI-assisted workflows into a connected software environment.</p>
            <ul className="check-list"><li>AI call analysis</li><li>Sales coaching</li><li>CRM & lead management</li><li>Job media intelligence</li><li>Marketing analysis</li><li>Partner workflows</li><li>Mobile operations</li><li>Durable automation</li></ul>
            <ArrowLink href="/work/stonegateos" light>Read the case study</ArrowLink>
          </div>
          <ProductWindow />
        </div>
      </section>

      <section className="section-pad">
        <div className="container-shell">
          <div className="intro-grid"><Eyebrow>Selected AI solutions</Eyebrow><h2 className="h2">Intelligence where it creates <span className="serif-italic">operational value.</span></h2></div>
          <div className="solutions-list">
            {solutions.map((solution, index) => (
              <article className="solution-feature" key={solution.label}>
                <div className="solution-copy"><Eyebrow>0{index + 1} · {solution.label}</Eyebrow><h3>{solution.title}</h3><p>{solution.text}</p><div className="solution-meta">{solution.tags.map((tag) => <span className="pill" key={tag}>{tag}</span>)}</div></div>
                <div className="solution-visual"><MiniFlow index={index} /></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="workflow-section section-pad">
        <div className="container-shell">
          <div className="workflow-head"><div><Eyebrow>Workflow demonstration</Eyebrow><h2 className="h2">From signal to <span className="serif-italic">useful action.</span></h2></div><p className="lede">Explore how an intelligent system can turn everyday business information into a reviewable, structured outcome.</p></div>
          <WorkflowShowcase />
        </div>
      </section>

      <section className="section-pad">
        <div className="container-shell">
          <div className="intro-grid"><Eyebrow>How we work</Eyebrow><h2 className="h2">Start with the system, <span className="serif-italic">not the feature.</span></h2></div>
          <div className="process-grid">
            {[["01","Understand","Learn the existing systems, workflows, constraints, and business problem."],["02","Architect","Determine how AI, automation, and custom software should fit together."],["03","Build","Develop and integrate the solution with appropriate testing and oversight."],["04","Improve","Evaluate real outcomes and refine the implementation as the operation evolves."]].map(([n,h,p]) => <div className="process-item" key={n}><span>{n}</span><h3>{h}</h3><p>{p}</p></div>)}
          </div>
        </div>
      </section>

      <section className="section-pad section-rule">
        <div className="container-shell engagement-grid">
          <div><Eyebrow>Ways to engage</Eyebrow><h2 className="h2">The right scope for the <span className="serif-italic">problem.</span></h2><p className="lede">Engagements are shaped around the operational objective—not a fixed menu of software packages.</p></div>
          <div className="engagement-list">
            {[["01","Focused AI Implementation","A targeted agent or automation solving one defined operational challenge."],["02","Connected AI Systems","Multiple agents, integrations, and workflows working together across business functions."],["03","Custom Software & Platforms","Purpose-built applications, sophisticated integrations, and larger AI-enabled systems."]].map(([n,h,p]) => <div className="engagement-item" key={n}><span>{n}</span><div><h3>{h}</h3><p>{p}</p></div></div>)}
          </div>
        </div>
      </section>
      <FinalCta />
    </>
  );
}

function MiniFlow({ index }: { index: number }) {
  const labels = [
    [["IN", "Inquiry"], ["AI", "Qualify"], ["OPS", "Handoff"]],
    [["AUDIO", "Recorded call"], ["TEXT", "Extract"], ["CRM", "Document"]],
    [["DATA", "Campaigns"], ["AI", "Analyze"], ["REVIEW", "Recommend"]],
    [["INPUT", "Documents"], ["RULES", "Process"], ["SYS", "Synchronize"]],
  ][index];
  return <div className="mini-flow" aria-hidden="true"><div className="mini-row">{labels.map(([tag, name], i) => <div style={{display:"contents"}} key={name}><div className="mini-node"><span>{tag}</span><b>{name}</b></div>{i < labels.length - 1 && <span className="mini-arrow">→</span>}</div>)}</div><div className="mini-output"><span>Structured outcome prepared</span><b>Ready for review</b></div></div>;
}
