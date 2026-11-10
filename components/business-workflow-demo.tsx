"use client";

import { useState } from "react";
import { ArrowDown, ArrowUpRight, Check, FileText, Layers3, Sparkles, UserRound } from "lucide-react";

const examples = [
  { label: "Lead follow-up", input: "An inquiry in your inbox", detail: "“Our leads are falling between email and our CRM. Can you help connect them?”", agent: "Understand the request", prepared: "Find the intent. Gather the context. Prepare the next step.", fields: [["Interest", "Connected sales tools"], ["Needs context", "Current CRM & workflow"]], result: "A relevant reply, ready to review", draft: "Thanks for reaching out. Which CRM does your team use, and where do new inquiries arrive today? We can start with that handoff.", systems: "Email → CRM → Your team" },
  { label: "Document intake", input: "A delivery packet arrives", detail: "A signed delivery document and invoice need to be matched to shipment ATL–1048.", agent: "Read, match & check", prepared: "Extract the details. Compare the records. Surface the exception.", fields: [["Shipment", "ATL–1048 · Matched"], ["Needs review", "$160 charge difference"]], result: "The exception comes to you", draft: "The shipment matches and the delivery signature is present. The invoice has an additional charge. Review it against the agreed rate before billing.", systems: "Documents → TMS → Review queue" },
  { label: "Team knowledge", input: "A teammate needs an answer", detail: "“A customer wants to change the scope after approval. What is our next step?”", agent: "Find the relevant guidance", prepared: "Search approved knowledge. Cite the source. Keep judgment with you.", fields: [["Source", "Example change-request guide"], ["Next step", "Confirm scope & approval"]], result: "An answer with its context", draft: "Document the requested change, confirm its effect on scope and pricing, and get approval before work begins. Source: example change-request guide, section 2.", systems: "Approved knowledge → Answer → Your team" },
] as const;

export function BusinessWorkflowDemo() {
  const [selected, setSelected] = useState(0);
  const example = examples[selected];
  return <div className="workflow-studio">
    <div className="studio-heading"><span className="studio-brand"><Layers3 size={19}/> The work, connected.</span><span className="studio-example">Interactive example</span></div>
    <div className="studio-tabs" role="group" aria-label="Explore an example workflow">{examples.map((item,index)=><button type="button" aria-pressed={selected===index} onClick={()=>setSelected(index)} key={item.label}>{item.label}<ArrowUpRight size={13}/></button>)}</div>
    <div className="studio-workflow" aria-live="polite" aria-atomic="true">
      <div className="studio-input"><div className="studio-label"><FileText size={15}/> 01 / The everyday task</div><strong>{example.input}</strong><p>{example.detail}</p></div>
      <div className="studio-connection" aria-hidden="true"><span/><ArrowDown size={16}/><span/></div>
      <div className="studio-agent"><span className="studio-agent-symbol"><Sparkles size={23}/></span><div><span className="studio-label">02 / Your tailored agent</span><h2>{example.agent}</h2><p>{example.prepared}</p></div></div>
      <div className="studio-output"><div className="studio-fields">{example.fields.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="studio-result"><span className="studio-label"><Check size={13}/> {example.result}</span><p>{example.draft}</p></div><div className="studio-review"><UserRound size={16}/><span>Prepared for your team</span><b>Human review</b></div></div>
      <div className="studio-systems">{example.systems}</div>
    </div>
    <p className="studio-note">Illustrative workflow with fictional data. Connections and actions are scoped with your team.</p>
  </div>;
}
