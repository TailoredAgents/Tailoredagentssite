"use client";

import { useEffect, useState } from "react";
import { AudioLines, BrainCircuit, Check, FileText, MessageSquareText, PhoneCall, Sparkles, UserRound } from "lucide-react";

const stages = [
  {
    id: "capture",
    label: "Transcribe",
    icon: AudioLines,
    eyebrow: "Call transcript",
    title: "Every detail, captured.",
    body: "A searchable transcript is attached to the customer record with speaker labels and time references.",
  },
  {
    id: "extract",
    label: "Extract",
    icon: BrainCircuit,
    eyebrow: "Structured intelligence",
    title: "Context becomes usable data.",
    body: "Service need, location, timing, decision factors, and next steps are extracted into reliable fields.",
  },
  {
    id: "document",
    label: "Document",
    icon: FileText,
    eyebrow: "CRM documentation",
    title: "The record writes itself.",
    body: "A concise CRM summary and follow-up task are prepared for an operator to review and approve.",
  },
  {
    id: "coach",
    label: "Coach",
    icon: Sparkles,
    eyebrow: "Conversation coaching",
    title: "Managers see what matters.",
    body: "The system identifies strong discovery moments and specific opportunities for a better next conversation.",
  },
] as const;

export function HeroCallSystem() {
  const [active, setActive] = useState(1);
  const [manuallySelected, setManuallySelected] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || manuallySelected) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % stages.length), 4400);
    return () => window.clearInterval(timer);
  }, [manuallySelected]);

  const stage = stages[active];
  const StageIcon = stage.icon;

  return (
    <div className="hero-product" aria-label="Illustrative call intelligence product demonstration using synthetic data">
      <div className="hero-product-bar">
        <div className="product-brand-mini"><span>TA</span><b>Call Intelligence</b></div>
        <span className="synthetic-tag"><i /> Illustrative interface · Synthetic data</span>
        <div className="product-user"><UserRound size={14} /><span>Operations</span></div>
      </div>
      <div className="hero-product-body">
        <aside className="hero-product-rail" aria-hidden="true">
          <span className="rail-brand">TA</span>
          <span className="rail-icon active"><PhoneCall size={16} /></span>
          <span className="rail-icon"><MessageSquareText size={16} /></span>
          <span className="rail-icon"><BrainCircuit size={16} /></span>
          <span className="rail-spacer" />
          <span className="rail-avatar">AM</span>
        </aside>
        <div className="call-workspace">
          <div className="call-context">
            <div>
              <span className="micro-label">Customer conversation</span>
              <h3>Morgan Ellis</h3>
            </div>
            <div className="call-meta"><span className="status-complete"><Check size={12} /> Processed</span><span>12:48</span></div>
          </div>
          <div className="call-grid">
            <section className="transcript-pane">
              <div className="pane-title"><span>Transcript</span><span className="audio-indicator"><i/><i/><i/><i/><i/></span></div>
              <div className="transcript-scroll">
                <TranscriptLine time="00:18" speaker="Agent" text="Thanks for calling. Tell me a little about what you need help with." />
                <TranscriptLine time="00:27" speaker="Morgan" text="We’re clearing out an office in Decatur before the end of the month." highlighted />
                <TranscriptLine time="00:41" speaker="Agent" text="Understood. Is there elevator access, and do you have a target date?" />
                <TranscriptLine time="00:53" speaker="Morgan" text="Yes—freight elevator. Ideally Thursday the 24th, sometime after 10." highlighted />
                <TranscriptLine time="01:12" speaker="Agent" text="I can prepare the details and have our team confirm availability." />
              </div>
            </section>
            <section className="intelligence-pane">
              <div className="stage-tabs" role="tablist" aria-label="Call processing stages">
                {stages.map((item, index) => {
                  const Icon = item.icon;
                  return <button key={item.id} id={`call-stage-tab-${item.id}`} aria-controls={`call-stage-panel-${item.id}`} type="button" role="tab" aria-selected={active === index} className={active === index ? "active" : ""} onClick={() => { setActive(index); setManuallySelected(true); }}><Icon size={14}/><span>{item.label}</span></button>;
                })}
              </div>
              <div className="intelligence-card" id={`call-stage-panel-${stage.id}`} role="tabpanel" aria-labelledby={`call-stage-tab-${stage.id}`} tabIndex={0}>
                <span className="intelligence-icon"><StageIcon size={19}/></span>
                <span className="micro-label blue">{stage.eyebrow}</span>
                <h4>{stage.title}</h4>
                <p>{stage.body}</p>
                {stage.id === "extract" && <div className="extraction-grid"><span><small>Service</small>Office cleanout</span><span><small>Location</small>Decatur, GA</span><span><small>Timing</small>Thu 24 · After 10</span><span><small>Access</small>Freight elevator</span></div>}
                {stage.id === "document" && <div className="crm-note"><span><Check size={12}/> CRM note prepared</span><p>Commercial office cleanout requested in Decatur. Customer prefers Thu 24 after 10 AM. Freight elevator available.</p></div>}
                {stage.id === "coach" && <div className="coach-list"><span><i className="good"/> Strong clarification on access</span><span><i/> Confirm decision-maker on follow-up</span><span><i/> Ask about estimated item volume</span></div>}
                {stage.id === "capture" && <div className="confidence-row"><span>Speaker separation</span><b>High confidence</b></div>}
              </div>
              <div className="review-bar"><span><Check size={13}/> Workflow complete</span><span className="review-action">Review record</span></div>
            </section>
          </div>
        </div>
      </div>
      <div className="hero-product-glow" aria-hidden="true" />
    </div>
  );
}

function TranscriptLine({ time, speaker, text, highlighted = false }: { time: string; speaker: string; text: string; highlighted?: boolean }) {
  return <div className={`transcript-line ${highlighted ? "highlighted" : ""}`}><span className="transcript-time">{time}</span><div><b>{speaker}</b><p>{text}</p></div></div>;
}
