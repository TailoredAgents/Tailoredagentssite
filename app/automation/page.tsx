import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, DatabaseZap, MessagesSquare, PhoneCall, Route, Sparkles } from "lucide-react";
import { HeroCallSystem } from "@/components/hero-call-system";
import { WorkflowShowcase } from "@/components/workflow-showcase";
import { ArrowLink, Eyebrow, FinalCta } from "@/components/ui";
import { servicePricing } from "@/lib/services";

export const metadata: Metadata = {
  title: "Business Automation & AI",
  description: "Tailored lead follow-up, customer communication, appointment workflows, call intelligence, CRM integrations, and custom business software.",
  alternates: { canonical: "/automation" },
};

const opportunities = [
  [MessagesSquare, "Lead capture & follow-up", "Move website and campaign inquiries into a defined qualification, notification, and follow-up process."],
  [Sparkles, "AI-assisted communication", "Prepare useful responses from approved business context, with review and escalation where judgment matters."],
  [CalendarCheck, "Appointment workflows", "Connect customer requests, availability, reminders, and team handoffs around a clearer booking path."],
  [PhoneCall, "Call intelligence", "Turn approved recordings into transcripts, structured details, CRM notes, follow-up tasks, and reviewable coaching signals."],
  [DatabaseZap, "CRM & system integrations", "Keep customer, communication, scheduling, and operational information synchronized through defined APIs and events."],
  [Route, "Operations automation", "Coordinate documents, media, reporting, routine updates, and exception handling across the systems already in use."],
] as const;

export default function AutomationPage() {
  return (
    <>
      <section className="service-hero automation-service-hero"><div className="container-shell service-hero-grid"><div><Eyebrow>Business Automation & AI</Eyebrow><h1 className="page-title">Make the next step easier for customers—and the repeated work easier for your <span className="serif-italic">team.</span></h1><p className="lede">We design targeted automations around specific business problems, from lead follow-up and scheduling to call intelligence, integrations, and purpose-built applications.</p><div className="hero-actions"><ArrowLink href="/contact">Discuss an Opportunity</ArrowLink><Link className="button button-light" href="/engineering">Explore Engineering<ArrowRight size={15}/></Link></div><p className="service-hero-meta">Start focused · Integrate deliberately · Expand when useful</p></div><HeroCallSystem /></div></section>

      <section className="section-pad"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>Where automation helps</Eyebrow><h2 className="h2">Less friction between an opportunity and the <span className="serif-italic">next action.</span></h2></div><p className="lede">Automation is most useful when the workflow, information, exceptions, and responsible people are understood first.</p></div><div className="automation-opportunity-grid">{opportunities.map(([Icon,title,text],index)=><article key={title}><span><Icon size={19}/></span><em>0{index+1}</em><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

      <section className="dark-section section-pad"><div className="container-shell"><div className="showcase-intro"><div className="showcase-copy"><Eyebrow>Illustrative workflows</Eyebrow><h2 className="h2">See how information can move through a <span className="serif-italic">controlled process.</span></h2></div><p className="lede">These conceptual workflows use synthetic examples. They show how capture, analysis, business rules, connected systems, and human review can work together.</p></div><WorkflowShowcase /></div></section>

      <section className="section-pad growth-journey-section"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>Start with one useful outcome</Eyebrow><h2 className="h2">Automation can grow with the <span className="serif-italic">business.</span></h2></div><p className="lede">A focused first implementation can establish the integration, review, and operating patterns needed for broader systems later.</p></div><div className="growth-journey automation-journey">{[["01","Choose","Identify one repeated workflow with a clear owner and meaningful outcome."],["02","Map","Understand inputs, decisions, exceptions, systems, and approval points."],["03","Implement","Build the smallest reliable automation that fits the surrounding operation."],["04","Evaluate","Observe real use, refine the workflow, and expand only when the value is clear."]].map(([n,h,p],index)=><article key={n}><span>{n}</span><div className="journey-icon"><Route size={18}/></div><h3>{h}</h3><p>{p}</p>{index<3&&<i aria-hidden="true">→</i>}</article>)}</div></div></section>

      <section className="section-pad service-price-band"><div className="container-shell"><div><Eyebrow>Engagement model</Eyebrow><h2>{servicePricing.automation.price}</h2><p>{servicePricing.automation.note} We define the operational objective, system boundaries, implementation scope, and verification approach before proposing the work.</p></div><ArrowLink href="/contact">Discuss an Opportunity</ArrowLink></div></section>
      <FinalCta />
    </>
  );
}
