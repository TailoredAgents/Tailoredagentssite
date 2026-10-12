"use client";

import { useState } from "react";

const workflows = [
  {
    id: "call",
    name: "Call Intelligence",
    output: "A structured contact note is prepared with the customer’s requested service, timing, decision factors, and recommended follow-up. A manager sees two coaching observations before review.",
    steps: [
      ["01", "Capture", "A recorded customer call enters the approved workflow."],
      ["02", "Transcribe", "Speech is converted into searchable, time-linked text."],
      ["03", "Extract", "Service need, location, timing, and intent are structured."],
      ["04", "Document", "A concise CRM note and next steps are drafted."],
      ["05", "Review", "Coaching signals and the draft wait for human review."],
    ],
  },
  {
    id: "engagement",
    name: "Customer Engagement",
    output: "The inquiry is classified as a qualified service request. An approved response is prepared, a scheduling path is suggested, and a human is alerted where judgment is required.",
    steps: [
      ["01", "Receive", "An inquiry arrives from web, SMS, or another channel."],
      ["02", "Qualify", "Known service, location, and timing rules are applied."],
      ["03", "Prepare", "A response uses approved business information."],
      ["04", "Route", "The request enters the correct booking or follow-up path."],
      ["05", "Escalate", "Exceptions and sensitive questions go to an operator."],
    ],
  },
  {
    id: "marketing",
    name: "Marketing Intelligence",
    output: "The system surfaces a high-cost search pattern, explains the evidence, and prepares a bounded recommendation for approval—without changing the campaign automatically.",
    steps: [
      ["01", "Ingest", "Campaign and search-term data are synchronized."],
      ["02", "Compare", "Performance is evaluated against defined criteria."],
      ["03", "Explain", "Material changes and anomalies are summarized."],
      ["04", "Recommend", "A specific, reversible action is proposed."],
      ["05", "Approve", "An authorized user decides whether to act."],
    ],
  },
] as const;

export function WorkflowShowcase() {
  const [activeId, setActiveId] = useState<(typeof workflows)[number]["id"]>("call");
  const active = workflows.find((item) => item.id === activeId) ?? workflows[0];

  return (
    <div className="workflow-shell">
      <div className="workflow-tabs" role="tablist" aria-label="Example AI workflows">
        {workflows.map((workflow, index) => (
          <button
            type="button"
            role="tab"
            id={`tab-${workflow.id}`}
            aria-controls={`panel-${workflow.id}`}
            aria-selected={workflow.id === activeId}
            className="workflow-tab"
            key={workflow.id}
            onClick={() => setActiveId(workflow.id)}
          >
            <span>0{index + 1}</span><b>{workflow.name}</b>
          </button>
        ))}
      </div>
      <div className="workflow-view" role="tabpanel" id={`panel-${active.id}`} aria-labelledby={`tab-${active.id}`} tabIndex={0}>
        <span className="workflow-disclaimer">Illustrative workflow · Synthetic data</span>
        <div className="workflow-steps">
          {active.steps.map(([num, name, description]) => (
            <div className="workflow-step" key={name}>
              <span className="step-num">{num}</span><b>{name}</b><p>{description}</p>
            </div>
          ))}
        </div>
        <div className="workflow-output"><span>Prepared outcome</span><p>{active.output}</p></div>
      </div>
    </div>
  );
}
