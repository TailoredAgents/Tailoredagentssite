import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, DatabaseZap, MessagesSquare, PhoneCall, Route, Sparkles } from "lucide-react";
import { HeroCallSystem } from "@/components/hero-call-system";
import { PricingCards } from "@/components/pricing-cards";
import { WorkflowShowcase } from "@/components/workflow-showcase";
import { ArrowLink, Eyebrow, FinalCta } from "@/components/ui";
import { automationPlans } from "@/lib/services";

export const metadata: Metadata = {
  title: "AI Agents & Business Automation",
  description: "Managed AI agents, tailored lead follow-up, appointment workflows, call intelligence, CRM integrations, and custom business software.",
  alternates: { canonical: "/automation" },
};

const opportunities = [
  [MessagesSquare, "Lead qualification & follow-up", "Give one managed agent a defined role in qualifying inquiries, preparing next steps, and escalating exceptions."],
  [Sparkles, "Customer communication", "Prepare useful responses from approved business context, with review and escalation wherever judgment matters."],
  [CalendarCheck, "Appointment workflows", "Connect customer requests, availability, reminders, and team handoffs around a clearer booking path."],
  [PhoneCall, "Call intelligence", "Turn approved recordings into transcripts, structured details, CRM notes, follow-up tasks, and reviewable coaching signals."],
  [DatabaseZap, "CRM & system integrations", "Keep customer, communication, scheduling, and operational information synchronized through defined APIs and events."],
  [Route, "Operations automation", "Coordinate documents, media, reporting, routine updates, and exception handling across the systems already in use."],
] as const;

export default function AutomationPage() {
  return (
    <>
      <section className="service-hero automation-service-hero"><div className="container-shell service-hero-grid"><div><Eyebrow>AI Agents & Business Automation</Eyebrow><h1 className="page-title">Add a tailored agent where the work repeats—and keep people in <span className="serif-italic">control.</span></h1><p className="lede">We build managed agents and focused automations around one clearly defined responsibility inside the systems a business already uses—from lead follow-up and scheduling to call intelligence and internal operations.</p><div className="hero-actions"><ArrowLink href="/contact">Discuss an Agent Opportunity</ArrowLink><Link className="button button-light" href="/engineering">Explore Engineering<ArrowRight size={15}/></Link></div><p className="service-hero-meta">Defined responsibility · Approved tools · Human escalation</p></div><HeroCallSystem /></div></section>

      <section className="section-pad"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>Where automation helps</Eyebrow><h2 className="h2">Less friction between an opportunity and the <span className="serif-italic">next action.</span></h2></div><p className="lede">Automation is most useful when the workflow, information, exceptions, and responsible people are understood first.</p></div><div className="automation-opportunity-grid">{opportunities.map(([Icon,title,text],index)=><article key={title}><span><Icon size={19}/></span><em>0{index+1}</em><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

      <section className="dark-section section-pad"><div className="container-shell"><div className="showcase-intro"><div className="showcase-copy"><Eyebrow>Illustrative workflows</Eyebrow><h2 className="h2">See how information can move through a <span className="serif-italic">controlled process.</span></h2></div><p className="lede">These conceptual workflows use synthetic examples. They show how capture, analysis, business rules, connected systems, and human review can work together.</p></div><WorkflowShowcase /></div></section>

      <section className="section-pad growth-journey-section"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>How a managed agent works</Eyebrow><h2 className="h2">Useful autonomy needs clear <span className="serif-italic">boundaries.</span></h2></div><p className="lede">A focused first agent establishes the context, integrations, review controls, and operating evidence needed before more responsibility is added.</p></div><div className="growth-journey automation-journey">{[["01","Define","Give the agent one responsibility, a clear owner, and a measurable business outcome."],["02","Connect","Provide only the approved data and tools needed to complete that responsibility."],["03","Control","Set validation, approval, escalation, and failure behavior before the agent acts."],["04","Improve","Review activity and usage, refine the workflow, and expand only when the evidence supports it."]].map(([n,h,p],index)=><article key={n}><span>{n}</span><div className="journey-icon"><Route size={18}/></div><h3>{h}</h3><p>{p}</p>{index<3&&<i aria-hidden="true">→</i>}</article>)}</div></div></section>

      <section className="section-pad package-section package-section-alt" id="pricing"><div className="container-shell"><div className="section-heading-wide"><div><Eyebrow>AI & automation pricing</Eyebrow><h2 className="h2">Start with one workflow. Add managed intelligence when the value is <span className="serif-italic">clear.</span></h2></div><p className="lede">Use a one-time automation for a fixed handoff, or a managed monthly agent when the responsibility requires ongoing monitoring, refinement, and usage.</p></div><PricingCards plans={automationPlans}/><div className="package-section-link"><ArrowLink href="/pricing">View all pricing details</ArrowLink></div></div></section>
      <FinalCta />
    </>
  );
}
