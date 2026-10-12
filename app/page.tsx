import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, ChartNoAxesCombined, Check, FileInput, MessageSquareMore, Route, Sparkles } from "lucide-react";
import { HeroCallSystem } from "@/components/hero-call-system";
import { ProductWindow } from "@/components/product-window";
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

const operatingStories = [
  { label: "Customer Engagement", title: "Useful answers. Clear handoffs.", text: "Qualify inquiries, prepare approved responses, coordinate next steps, and keep customer records current—with deliberate escalation when judgment matters.", tags: ["Qualification", "Messaging", "Scheduling"], visual: 0 },
  { label: "Marketing Intelligence", title: "Evidence before action.", text: "Connect advertising and content workflows so teams can evaluate search terms, understand change, and review bounded recommendations.", tags: ["Campaign data", "Analysis", "Approval"], visual: 1 },
  { label: "Operations Automation", title: "Move work through the system.", text: "Coordinate documents, job information, media, reporting, and routine administration across the tools the operation already depends on.", tags: ["Extraction", "Synchronization", "Human review"], visual: 2 },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-atmosphere" aria-hidden="true" />
        <div className="container-shell hero-grid-new">
          <div className="hero-copy">
            <div className="hero-kicker"><Sparkles size={14}/> Custom AI agents · Intelligent software</div>
            <h1 className="display"><span className="display-line">AI systems</span><span className="display-line">that do</span><span className="display-line serif-italic">real work.</span></h1>
            <p className="lede">We engineer custom AI agents and connected software that turn business information into structured, reviewable action.</p>
            <div className="hero-actions"><ArrowLink href="/work">Explore Our Work</ArrowLink><Link className="button button-light" href="/contact">Discuss a Project<ArrowRight size={15}/></Link></div>
            <div className="hero-trust"><span><Check size={13}/> Designed around your operation</span><span><Check size={13}/> Human oversight where it matters</span></div>
          </div>
          <HeroCallSystem />
        </div>
        <div className="container-shell hero-capability-strip"><span>Agent engineering</span><i/><span>Call intelligence</span><i/><span>Business automation</span><i/><span>Custom platforms</span></div>
      </section>

      <section className="section-pad build-section">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>What we build</Eyebrow><h2 className="h2">Intelligence inside the <span className="serif-italic">system.</span></h2></div><p className="lede">Not a chatbot bolted onto the side. We combine AI, workflow architecture, and application engineering into software that fits the way work actually moves.</p></div>
          <div className="capability-canvas">
            {capabilities.map(([name, text], index) => <div className={`capability-tile tile-${index + 1}`} key={name}><span className="capability-icon">{index === 0 ? <Bot size={22}/> : index === 1 ? <Route size={22}/> : <FileInput size={22}/>}</span><span className="num">0{index + 1}</span><h3>{name}</h3><p>{text}</p>{index === 0 ? <div className="capability-system" aria-hidden="true"><span>Business signal</span><i>→</i><span>Agent reasoning</span><i>→</i><span>Reviewable action</span></div> : <div className="capability-signal" aria-hidden="true"><i/><i/><i/><i/></div>}</div>)}
          </div>
        </div>
      </section>

      <section className="dark-section section-pad stonegate-section">
        <div className="container-shell showcase-intro">
          <div className="showcase-copy"><Eyebrow>Featured work · StonegateOS</Eyebrow><h2 className="h2">Built for the complexity of <span className="serif-italic">real operations.</span></h2><p className="lede">StonegateOS brings customer acquisition, communications, scheduling, quoting, field operations, business intelligence, and AI-assisted workflows into a connected software environment.</p><ArrowLink href="/work/stonegateos" light>Read the case study</ArrowLink></div>
          <ul className="check-list"><li>AI call analysis</li><li>Sales coaching</li><li>CRM & lead management</li><li>Job media intelligence</li><li>Marketing analysis</li><li>Partner workflows</li><li>Mobile operations</li><li>Durable automation</li></ul>
        </div>
        <div className="container-shell product-stage"><ProductWindow /></div>
      </section>

      <section className="section-pad solutions-section">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>Connected intelligence</Eyebrow><h2 className="h2">Different workflows. One <span className="serif-italic">operating context.</span></h2></div><p className="lede">Call intelligence is only one part of the system. Customer engagement, marketing analysis, and operational automation all become more useful when they share reliable context.</p></div>
          <div className="operating-stories">
            {operatingStories.map((story, index) => <article className={`operating-story story-${index + 1}`} key={story.label}><div className="solution-copy"><Eyebrow>0{index + 1} · {story.label}</Eyebrow><h3>{story.title}</h3><p>{story.text}</p><div className="solution-meta">{story.tags.map((tag) => <span className="pill" key={tag}>{tag}</span>)}</div></div><div className="solution-visual"><MiniFlow index={story.visual}/></div></article>)}
          </div>
        </div>
      </section>

      <section className="infrastructure-section section-pad">
        <div className="container-shell">
          <div className="infrastructure-heading"><div><Eyebrow>Enterprise engineering & integrations</Eyebrow><h2 className="h2">Built to work with your <span className="serif-italic">infrastructure.</span></h2></div><p className="lede">We connect intelligent software to the systems your business already relies on—from customer relationships and communications to operational databases, scheduling, and internal workflows.</p></div>
          <div className="infrastructure-map" aria-label="Business systems connect through an intelligence and automation layer to governed operational outcomes">
            <div className="system-column input-systems"><span className="system-column-label">Business systems</span><div className="system-node"><i>01</i><span><b>CRM & customer records</b><small>Contacts, activity, opportunities</small></span></div><div className="system-node"><i>02</i><span><b>Voice & communications</b><small>Calls, messages, notifications</small></span></div><div className="system-node"><i>03</i><span><b>Operational data</b><small>Scheduling, jobs, documents</small></span></div><div className="system-node"><i>04</i><span><b>External APIs</b><small>Providers and internal services</small></span></div></div>
            <div className="system-connector" aria-hidden="true"><span/><span/><span/><span/></div>
            <div className="intelligence-core"><span className="core-label">Tailored intelligence layer</span><div className="core-mark"><Bot size={25}/><span>TA</span></div><div className="core-orbit"><span>Agent orchestration</span><span>Structured extraction</span><span>Business rules</span><span>Context management</span></div><p>Purpose-built software coordinates models, data, integrations, and business logic around a bounded operational objective.</p></div>
            <div className="system-connector outbound" aria-hidden="true"><span/><span/><span/></div>
            <div className="system-column outcome-systems"><span className="system-column-label">Governed outcomes</span><div className="system-node"><i><Check size={12}/></i><span><b>Human approval</b><small>Review where judgment matters</small></span></div><div className="system-node"><i><Check size={12}/></i><span><b>Application updates</b><small>Traceable writes through APIs</small></span></div><div className="system-node"><i><Check size={12}/></i><span><b>Durable processing</b><small>Events, queues, retries, monitoring</small></span></div></div>
          </div>
          <div className="infrastructure-capabilities"><span>Custom backend applications</span><span>Event-driven processing</span><span>Database architecture</span><span>Access controls</span><span>Operational monitoring</span><span>Human oversight</span></div>
        </div>
      </section>

      <section className="section-pad process-section">
        <div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>How we work</Eyebrow><h2 className="h2">Start with the system, <span className="serif-italic">not the feature.</span></h2></div><p className="lede">We work from the operational reality inward—then choose the right combination of software, AI, and automation.</p></div><div className="process-grid">{[["01","Understand","Learn the existing systems, workflows, constraints, and business problem."],["02","Architect","Determine how AI, automation, and custom software should fit together."],["03","Build","Develop and integrate the solution with appropriate testing and oversight."],["04","Improve","Evaluate real outcomes and refine the implementation as the operation evolves."]].map(([n,h,p]) => <div className="process-item" key={n}><span>{n}</span><h3>{h}</h3><p>{p}</p></div>)}</div></div>
      </section>

      <section className="section-pad engagement-section">
        <div className="container-shell engagement-grid"><div><Eyebrow>Ways to engage</Eyebrow><h2 className="h2">The right scope for the <span className="serif-italic">problem.</span></h2><p className="lede">Engagements are shaped around the operational objective—not a fixed menu of software packages.</p></div><div className="engagement-list">{[["01","Focused AI Implementation","A targeted agent or automation solving one defined operational challenge."],["02","Connected AI Systems","Multiple agents, integrations, and workflows working together across business functions."],["03","Custom Software & Platforms","Purpose-built applications, sophisticated integrations, and larger AI-enabled systems."]].map(([n,h,p]) => <div className="engagement-item" key={n}><span>{n}</span><div><h3>{h}</h3><p>{p}</p></div><ArrowRight size={17}/></div>)}</div></div>
      </section>
      <FinalCta />
    </>
  );
}

function MiniFlow({ index }: { index: number }) {
  if (index === 0) return <div className="solution-demo engagement-demo" aria-hidden="true"><div className="demo-head"><MessageSquareMore size={16}/><b>Engagement agent</b><span>Human available</span></div><div className="chat-line customer">Can you help with a commercial pickup next week?</div><div className="agent-thinking"><i/><span>Checking service fit, location, and schedule…</span></div><div className="chat-line agent">Yes. I can collect a few details and prepare the right scheduling path.</div><div className="demo-result"><Check size={13}/> Qualified inquiry · CRM record updated</div></div>;
  if (index === 1) return <div className="solution-demo marketing-demo" aria-hidden="true"><div className="demo-head"><ChartNoAxesCombined size={16}/><b>Campaign intelligence</b><span>Last 30 days</span></div><div className="marketing-chart"><div className="chart-line"/>{[42,58,47,70,62,88,76,96].map((n,i)=><i key={i} style={{height:`${n}%`}}/>)}</div><div className="insight-callout"><span>Opportunity detected</span><b>Focus review on high-intent local terms</b><p>Evidence and recommendation prepared for approval.</p></div></div>;
  return <div className="solution-demo automation-demo" aria-hidden="true"><div className="demo-head"><Route size={16}/><b>Automation run</b><span className="running-dot">Active</span></div>{[["Document received","Complete"],["Information extracted","Complete"],["Business rules applied","Complete"],["System records synchronized","Review"]].map(([a,b],i)=><div className="automation-row" key={a}><i>{i+1}</i><span><b>{a}</b><small>{b}</small></span><em className={b === "Review" ? "review" : ""}>{b === "Review" ? "Waiting" : "✓"}</em></div>)}</div>;
}
