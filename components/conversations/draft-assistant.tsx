"use client";
import { useId, useRef, useState } from "react";
import { LoaderCircle, Sparkles, X } from "lucide-react";
import { suggestClientMessageAction } from "@/lib/conversations/draft-actions";
import type { DraftRequest, DraftResult, SuggestedDraft } from "@/lib/conversations/draft-validation";

export function DraftAssistant({ request, disabled, onApply }: {
  request: Omit<DraftRequest, "direction">; disabled: boolean; onApply: (draft: SuggestedDraft) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false), [direction, setDirection] = useState("");
  const [busy, setBusy] = useState(false), [result, setResult] = useState<DraftResult | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [applied, setApplied] = useState(false);
  const current = JSON.stringify(request);
  const currentRef = useRef(current); currentRef.current = current;
  const locked = useRef(false);
  const stale = !!result && snapshot !== current;
  async function generate() {
    if (disabled || locked.current) return;
    locked.current = true; setBusy(true); setResult(null); setApplied(false); setSnapshot(current);
    try {
      const next = await suggestClientMessageAction({ ...request, direction });
      // Never offer a result for a recipient, subject or message changed mid-request.
      setResult(currentRef.current === current ? next : { error: "Your message or recipient changed. Generate again to use the latest details." });
    } catch { setResult({ error: "Could not generate a draft. Your message is unchanged. Please try again." }); }
    finally { locked.current = false; setBusy(false); }
  }
  return <div className="ai-draft-assistant">
    <div className="ai-draft-toolbar"><button type="button" className="inbox-button ai-draft-toggle" disabled={disabled} aria-expanded={open} aria-controls={id} onClick={() => { setOpen(!open); setApplied(false); }}><Sparkles size={14} aria-hidden="true" />Suggest message</button>{applied ? <span role="status">Draft added. Review it before sending.</span> : null}</div>
    {open ? <div className="ai-draft-panel" id={id} aria-busy={busy}>
      <div className="ai-draft-heading"><strong>What would you like to say?</strong><button type="button" className="ai-draft-close" aria-label="Close draft assistant" onClick={() => setOpen(false)}><X size={16} aria-hidden="true" /></button></div>
      <p>Use the client’s details and recent history, or add a direction.</p>
      <div className="ai-draft-presets">{[
        ["Introduce us", "Initial message after the lead came in. Introduce Tailored Agents and ask about what they need."],
        ["Suggest a reply", "Reply to their latest message and suggest a useful next step."],
        ["Set up a meeting", "They seem ready to meet. Ask about a convenient time to discuss their project."],
      ].map(([label, prompt]) => <button type="button" key={label} disabled={busy || disabled} onClick={() => setDirection(prompt)}>{label}</button>)}</div>
      <label className="inbox-field"><span>Direction <small>(optional)</small></span><textarea aria-label="Message direction" rows={2} maxLength={1000} disabled={busy || disabled} value={direction} onChange={event => setDirection(event.target.value)} placeholder="E.g. First message to a lead looking for their first website…" /></label>
      <button type="button" className="inbox-button" disabled={busy || disabled} onClick={generate}>{busy ? <LoaderCircle className="signin-spinner" size={14} aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}{busy ? "Writing draft…" : result && "draft" in result ? "Try another draft" : "Generate draft"}</button>
      {result && "error" in result ? <p className="ai-draft-error" role="alert">{result.error}</p> : null}
      {result && "draft" in result ? <div className="ai-draft-preview" role="region" aria-label="Suggested message">
        <small>{result.contextNote}</small>
        {request.channel === "email" && !request.threadId && result.draft.subject ? <strong>{result.draft.subject}</strong> : null}
        <p>{result.draft.text}</p>
        {stale ? <p role="status">Your message changed. Generate a fresh suggestion to keep your latest edits.</p> : null}
        <div><small>{request.currentText ? "Replaces the text currently in your composer." : "Review and edit in the composer before sending."}</small><button type="button" className="inbox-button inbox-button-primary" disabled={disabled || busy || stale} onClick={() => { onApply(result.draft); setOpen(false); setResult(null); setApplied(true); }}>Use draft</button></div>
      </div> : null}
    </div> : null}
  </div>;
}
