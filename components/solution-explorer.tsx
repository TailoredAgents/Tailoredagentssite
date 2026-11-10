"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CornerDownRight, ShieldCheck } from "lucide-react";

type Solution = { title: string; problem: string; system: string; workflow: string; integrations: string[]; oversight: string };

export function SolutionExplorer({ solutions }: { solutions: Solution[] }) {
  const [active,setActive] = useState(0);
  return <div className="solution-explorer">
    <div className="solution-selector" role="group" aria-label="Choose a solution">{solutions.map((item,index)=><button key={item.title} aria-controls={`solution-panel-${index}`} type="button" aria-pressed={active===index} onClick={()=>setActive(index)}><span>0{index+1}</span>{item.title}<ArrowRight size={18}/></button>)}</div>
    <div className="solution-canvas" aria-live="polite" aria-atomic="true">{solutions.map((solution,index)=><section id={`solution-panel-${index}`} key={solution.title} hidden={active!==index}>
      <span className="studio-label">Designed around the work</span><h2>{solution.title}</h2><p className="solution-intro">{solution.system}</p>
      <div className="solution-friction"><CornerDownRight size={20}/><p>{solution.problem}</p></div>
      <h3 className="studio-label">A possible workflow</h3><ol className="solution-steps">{solution.workflow.replace(/\.$/, "").split(" → ").map((step,index)=><li key={step}><span>{index+1}</span>{step}</li>)}</ol>
      <div className="solution-connections"><span>Possible connections</span>{solution.integrations.map(item=><b key={item}><Check size={12}/>{item}</b>)}</div>
      <div className="solution-oversight"><ShieldCheck size={20}/><p>{solution.oversight}</p></div>
      <Link href="/contact?interest=automation" className="button button-dark">Discuss this workflow<ArrowRight size={16}/></Link>
    </section>)}</div>
  </div>;
}
