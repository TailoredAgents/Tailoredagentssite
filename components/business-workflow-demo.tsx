"use client";

import { useState } from "react";
import { ArrowDown, ArrowUpRight, Check, FileText, Layers3, UserRound } from "lucide-react";

const examples = [
  { label: "Lead follow-up", input: "A new inquiry arrives", detail: "An owner asks about connecting their sales tools.", agent: "Understand the request", prepared: "Organize the details and prepare a relevant first reply.", review: "Your team reviews the reply", outcome: "A useful conversation can begin", systems: "Email · CRM · Scheduling" },
  { label: "Document intake", input: "A document arrives", detail: "A delivery document needs to be matched to a shipment.", agent: "Read, match & check", prepared: "Extract key details and flag missing information against your rules.", review: "Your team checks exceptions", outcome: "Prepare the record for the next step", systems: "Documents · TMS · Review queue" },
  { label: "Team knowledge", input: "A teammate has a question", detail: "They need the right process for an unusual customer request.", agent: "Find the relevant guidance", prepared: "Prepare an answer from approved sources, with references and open questions.", review: "A person handles the judgment call", outcome: "The team has context to move forward", systems: "Internal documents · Knowledge base · Team tools" },
] as const;

export function BusinessWorkflowDemo() {
  const [selected,setSelected]=useState(0);
  const example=examples[selected];
  return <div className="business-demo">
    <div className="business-demo-top"><span><Layers3 size={17}/> A connected way to work</span><small>Illustrative example</small></div>
    <div className="business-demo-tabs" role="group" aria-label="Explore an example workflow">{examples.map((item,index)=><button type="button" aria-pressed={selected===index} onClick={()=>setSelected(index)} key={item.label}>{item.label}</button>)}</div>
    <div className="business-demo-flow" aria-live="polite" aria-atomic="true">
      <div className="business-demo-input"><FileText size={19}/><div><strong>{example.input}</strong><p>{example.detail}</p></div><span>01</span></div>
      <ArrowDown className="business-demo-connector" size={19} aria-hidden="true"/>
      <div className="business-demo-agent"><span className="business-demo-agent-label">TAILORED TO YOUR WORKFLOW</span><h2>{example.agent}</h2><p>{example.prepared}</p><div><span><Check size={13}/> Your business context</span><span><Check size={13}/> Your rules</span></div></div>
      <ArrowDown className="business-demo-connector" size={19} aria-hidden="true"/>
      <div className="business-demo-review"><UserRound size={18}/><span>{example.review}</span><span className="business-review-tag">Human checkpoint</span></div>
      <div className="business-demo-outcome"><ArrowUpRight size={19}/><strong>{example.outcome}</strong></div>
      <p className="business-demo-systems">{example.systems}</p>
    </div>
    <p className="business-demo-note">A possible workflow, not a live system. Connections and actions are agreed with your team.</p>
  </div>;
}
