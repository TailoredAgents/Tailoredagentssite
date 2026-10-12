"use client";

import { useEffect, useState } from "react";
import { AudioLines, BrainCircuit, Check, Database, FileText, MessageSquareText, PhoneCall, PhoneIncoming, Sparkles, UserRound } from "lucide-react";

const stages = [
  {
    id: "received",
    label: "Call received",
    icon: PhoneIncoming,
    eyebrow: "Twilio voice event",
    title: "The conversation enters the system.",
    body: "The completed recording is associated with the matched contact and queued for controlled processing.",
  },
  {
    id: "transcribe",
    label: "Transcribed",
    icon: AudioLines,
    eyebrow: "Recorded-call transcript",
    title: "The complete conversation becomes searchable.",
    body: "Speaker-separated text and time references create a durable source for downstream analysis and review.",
  },
  {
    id: "understand",
    label: "Requirements",
    icon: BrainCircuit,
    eyebrow: "Structured extraction",
    title: "Customer requirements become usable data.",
    body: "Service need, location, timing, access requirements, intent, and next steps are extracted into structured fields.",
  },
  {
    id: "sync",
    label: "CRM updated",
    icon: Database,
    eyebrow: "CRM synchronization",
    title: "Context is prepared where the team works.",
    body: "A concise note, enriched contact fields, and a follow-up task are prepared for operator review.",
  },
  {
    id: "coach",
    label: "Coaching",
    icon: Sparkles,
    eyebrow: "Conversation analysis",
    title: "Managers get specific coaching signals.",
    body: "The system highlights useful discovery moments, missed questions, and a suggested approach for the follow-up.",
  },
] as const;

export function HeroCallSystem() {
  const [active, setActive] = useState(2);
  const [manuallySelected, setManuallySelected] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || manuallySelected) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % stages.length), 4800);
    return () => window.clearInterval(timer);
  }, [manuallySelected]);

  const stage = stages[active];
  const StageIcon = stage.icon;

  return (
    <div className="hero-product" aria-label="Illustrative call intelligence demonstration using synthetic customer data">
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
            <div className="call-identity">
              <span className="customer-avatar">ME</span>
              <div><span className="micro-label">Matched customer · Voice call</span><h3>Morgan Ellis</h3><p>Commercial office cleanout · Decatur, GA</p></div>
            </div>
            <div className="call-meta"><span className="status-complete"><Check size={12} /> Processed</span><span>12:48</span></div>
          </div>

          <div className="call-pipeline" role="tablist" aria-label="Call intelligence processing stages">
            {stages.map((item, index) => {
              const Icon = item.icon;
              return <button key={item.id} id={`call-stage-tab-${item.id}`} aria-controls="call-stage-panel" type="button" role="tab" aria-selected={active === index} className={active === index ? "active" : active > index ? "complete" : ""} onClick={() => { setActive(index); setManuallySelected(true); }}><span className="pipeline-icon"><Icon size={13}/></span><span><small>0{index + 1}</small>{item.label}</span></button>;
            })}
          </div>

          <div className="call-grid">
            <section className="transcript-pane">
              <div className="pane-title"><span>Transcript</span><span className="audio-indicator" aria-label="Recorded call audio"><i/><i/><i/><i/><i/><i/><i/></span></div>
              <div className="transcript-scroll">
                <TranscriptLine time="00:18" speaker="Agent" text="Thanks for calling. Tell me a little about what you need help with." />
                <TranscriptLine time="00:27" speaker="Morgan" text="We’re clearing out an office in Decatur before the end of the month." highlighted />
                <TranscriptLine time="00:41" speaker="Agent" text="Understood. Is there elevator access, and do you have a target date?" />
                <TranscriptLine time="00:53" speaker="Morgan" text="Yes—freight elevator. Ideally Thursday the 24th, sometime after 10." highlighted />
                <TranscriptLine time="01:12" speaker="Agent" text="I can prepare the details and have our team confirm availability." />
                <TranscriptLine time="01:24" speaker="Morgan" text="Great. Email is best for the quote, but text me when it’s ready." highlighted />
              </div>
              <div className="transcript-source"><PhoneCall size={12}/><span>Recording received through Twilio integration</span><b>Source retained</b></div>
            </section>

            <section className="intelligence-pane">
              <div className="intelligence-card" id="call-stage-panel" role="tabpanel" aria-labelledby={`call-stage-tab-${stage.id}`} tabIndex={0}>
                <div className="intelligence-heading"><span className="intelligence-icon"><StageIcon size={18}/></span><div><span className="micro-label blue">{stage.eyebrow}</span><h4>{stage.title}</h4></div></div>
                <p>{stage.body}</p>
                <StageDetails id={stage.id} />
              </div>
              <div className="review-bar"><span><Check size={13}/> Processing trail available</span><span className="review-action">Open customer record</span></div>
            </section>
          </div>
        </div>
      </div>
      <div className="hero-product-glow" aria-hidden="true" />
    </div>
  );
}

function StageDetails({ id }: { id: typeof stages[number]["id"] }) {
  if (id === "received") return <div className="event-details"><span><small>Source</small>Twilio voice</span><span><small>Contact match</small>Morgan Ellis</span><span><small>Recording</small>Attached</span><span><small>Processing</small>Queued</span></div>;
  if (id === "transcribe") return <div className="transcription-details"><div><span>Speaker separation</span><b>High confidence</b></div><div><span>Conversation language</span><b>English</b></div><div><span>Transcript status</span><b className="success-text">Complete</b></div></div>;
  if (id === "understand") return <div className="extraction-grid"><span><small>Service</small>Office cleanout</span><span><small>Location</small>Decatur, GA</span><span><small>Target date</small>Thu 24 · After 10</span><span><small>Site access</small>Freight elevator</span><span><small>Follow-up</small>Email quote + text</span><span><small>Customer intent</small>Ready to schedule</span></div>;
  if (id === "sync") return <div className="crm-sync"><div className="crm-note"><span><Check size={12}/> CRM note prepared</span><p>Commercial office cleanout requested in Decatur. Customer prefers Thu 24 after 10 AM. Freight elevator available. Send quote by email and confirm by text.</p></div><div className="sync-status"><span><FileText size={13}/> Contact record enriched</span><span><Check size={13}/> Follow-up task drafted</span></div></div>;
  return <div className="coaching-panel"><div className="coach-score"><span>Conversation focus</span><b>Discovery</b><small>Reviewable analysis—not an employee score</small></div><div className="coach-list"><span><i className="good"/> Strong clarification on access</span><span><i/> Confirm approximate item volume</span><span><i/> Ask who will approve the quote</span></div><div className="suggested-followup"><small>Suggested next step</small><p>Send the prepared quote, then confirm scheduling authority and item volume before booking.</p></div></div>;
}

function TranscriptLine({ time, speaker, text, highlighted = false }: { time: string; speaker: string; text: string; highlighted?: boolean }) {
  return <div className={`transcript-line ${highlighted ? "highlighted" : ""}`}><span className="transcript-time">{time}</span><div><b>{speaker}</b><p>{text}</p></div></div>;
}
