import { managedMetadata } from "@/lib/seo/public-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, DatabaseZap, MessagesSquare, PhoneCall, Route, Sparkles } from "lucide-react";
import { HeroCallSystem } from "@/components/hero-call-system";
import { PricingCards } from "@/components/pricing-cards";
import { WorkflowShowcase } from "@/components/workflow-showcase";
import { ArrowLink, Eyebrow, FinalCta } from "@/components/ui";
import { customAutomationPlans, foundingAgentPlans } from "@/lib/services";

const baselineMetadata: Metadata = {
  title: "AI Agents & Business Automation",
  description: "Website AI assistants, lead qualification, follow-up, AI phone reception, business automation, integrations, and custom agent systems.",
  alternates: { canonical: "/automation" },
};

const agentCategories = [
  {
    icon: MessagesSquare,
    label: "Website-related agents",
    title: "Make the customer journey more useful.",
    description: "Add intelligence to the website after the core experience is working—using approved business knowledge, clear handoffs, and a voice that fits the brand.",
    items: [
      "Business-trained chat assistants",
      "Lead qualification and structured intake",
      "Voice-enabled website assistance",
      "Appointment and contact handoffs",
      "Review-support workflows",
      "SEO intelligence and analytics",
    ],
    note: "Founding rollout begins with chat, qualification, follow-up, and standard website handoffs. SEO intelligence remains part of managed SEO as it is introduced.",
  },
  {
    icon: Route,
    label: "Business operations agents",
    title: "Carry context beyond the website.",
    description: "Give a managed agent one bounded operational responsibility, then expand only after the workflow, systems, exceptions, and accountable people are understood.",
    items: [
      "AI phone reception and missed-call recovery",
      "Lead and estimate follow-up",
      "Customer-service assistance",
      "Document intake and processing",
      "Operational reporting",
      "Connected custom automations",
    ],
    note: "Standard configurations can begin as monthly services. Advanced agents, broader integrations, and custom software require an individually planned scope.",
  },
] as const;

const opportunities = [
  [MessagesSquare, "Website chat & qualification", "Answer approved questions, capture useful context, qualify interest, and prepare a clearer handoff without pretending every conversation is routine."],
  [CalendarCheck, "Booking & lead handoff", "Connect qualified requests to an appointment, contact path, or responsible team member with defined rules and fallbacks."],
  [Sparkles, "Review support", "Coordinate approved review requests, reminders, response drafts, and escalation without fabricating feedback or publishing unreviewed content."],
  [PhoneCall, "Phone reception & missed calls", "Handle common inbound needs, capture caller intent, recover missed opportunities, and route exceptions to a person."],
  [Route, "Lead & estimate follow-up", "Run an approved sequence with clear timing, stop conditions, response handling, and visibility into what happened."],
  [DatabaseZap, "Documents, reporting & integrations", "Move validated information between supported systems, prepare operational summaries, and request review when the workflow leaves its boundaries."],
] as const;

export default function AutomationPage() {
  return (
    <>
      <section className="service-hero automation-service-hero">
        <div className="container-shell service-hero-grid">
          <div>
            <Eyebrow>AI Agents & Business Automation</Eyebrow>
            <h1 className="page-title">Start with the website. Add intelligence as the business is <span className="serif-italic">ready.</span></h1>
            <p className="lede">Tailored Agents helps clients expand from a strong website and managed growth program into useful AI assistants, phone agents, follow-up, and connected operations—one clearly defined responsibility at a time.</p>
            <div className="hero-actions"><ArrowLink href="/contact">Discuss an Agent Opportunity</ArrowLink><Link className="button button-light" href="#founding-pricing">View Founding Pricing<ArrowRight size={15}/></Link></div>
            <p className="service-hero-meta">Website intelligence · Business operations · Human escalation</p>
          </div>
          <HeroCallSystem />
        </div>
      </section>

      <section className="section-pad agent-category-section">
        <div className="container-shell">
          <div className="section-heading-wide">
            <div><Eyebrow>Two ways to expand</Eyebrow><h2 className="h2">One client relationship. More capability <span className="serif-italic">over time.</span></h2></div>
            <p className="lede">The goal is not a disconnected collection of bots. Website and operations agents are designed to build on approved business context and eventually connect through the same client experience.</p>
          </div>
          <div className="agent-category-grid">
            {agentCategories.map(({ icon: Icon, label, title, description, items, note }) => (
              <article key={label}>
                <div className="agent-category-heading"><span><Icon size={21}/></span><small>{label}</small></div>
                <h3>{title}</h3>
                <p>{description}</p>
                <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
                <footer>{note}</footer>
              </article>
            ))}
          </div>
          <p className="agent-availability-note"><strong>Availability matters.</strong> These categories describe the service direction, not a claim that every agent is already an off-the-shelf product. Standardized offers are entering a limited founding-client rollout; advanced capabilities remain tailored engagements.</p>
        </div>
      </section>

      <section className="section-pad automation-capability-section">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>Where automation helps</Eyebrow><h2 className="h2">Less friction between an opportunity and the <span className="serif-italic">next action.</span></h2></div><p className="lede">Automation is most useful when the workflow, information, exceptions, and responsible people are understood first.</p></div>
          <div className="automation-opportunity-grid">{opportunities.map(([Icon,title,text],index)=><article key={title}><span><Icon size={19}/></span><em>0{index+1}</em><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div>
      </section>

      <section className="dark-section section-pad"><div className="container-shell"><div className="showcase-intro"><div className="showcase-copy"><Eyebrow>Illustrative workflows</Eyebrow><h2 className="h2">See how information can move through a <span className="serif-italic">controlled process.</span></h2></div><p className="lede">These conceptual workflows use synthetic examples. They show how capture, analysis, business rules, connected systems, and human review can work together.</p></div><WorkflowShowcase /></div></section>

      <section className="section-pad growth-journey-section"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>How a managed agent works</Eyebrow><h2 className="h2">Useful autonomy needs clear <span className="serif-italic">boundaries.</span></h2></div><p className="lede">A focused first agent establishes the context, integrations, review controls, and operating evidence needed before more responsibility is added.</p></div><div className="growth-journey automation-journey">{[["01","Define","Give the agent one responsibility, a clear owner, and a measurable business outcome."],["02","Connect","Provide only the approved data and tools needed to complete that responsibility."],["03","Control","Set validation, approval, escalation, and failure behavior before the agent acts."],["04","Improve","Review activity and usage, refine the workflow, and expand only when the evidence supports it."]].map(([n,h,p],index)=><article key={n}><span>{n}</span><div className="journey-icon"><Route size={18}/></div><h3>{h}</h3><p>{p}</p>{index<3&&<i aria-hidden="true">→</i>}</article>)}</div></div></section>

      <section className="section-pad package-section package-section-alt" id="founding-pricing">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>Founding-client agent pricing</Eyebrow><h2 className="h2">Accessible ways to add one useful <span className="serif-italic">capability.</span></h2></div><p className="lede">Founding-client pricing helps us standardize repeatable agents with early clients while preserving managed delivery, clear boundaries, and a premium service experience.</p></div>
          <PricingCards plans={foundingAgentPlans} columns={4}/>
          <div className="founding-pricing-note"><strong>Founding-client pricing is promotional, not low-service pricing.</strong><span>Standard deployments have $0 setup. Usage, phone, messaging, outside software, custom integrations, and work beyond the standard configuration are identified before billing.</span></div>
        </div>
      </section>

      <section className="section-pad package-section" id="custom-automation">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>Custom automation & advanced agents</Eyebrow><h2 className="h2">When the workflow is unique, the scope should be <span className="serif-italic">honest.</span></h2></div><p className="lede">Focused automations can begin with one handoff. Advanced agents, multi-system workflows, portals, and custom software are planned around the real requirements rather than forced into an introductory package.</p></div>
          <PricingCards plans={customAutomationPlans} columns={2}/>
          <div className="package-section-link"><ArrowLink href="/pricing">View all pricing details</ArrowLink></div>
        </div>
      </section>
      <FinalCta />
    </>
  );
}

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> { return managedMetadata("/automation", baselineMetadata); }
