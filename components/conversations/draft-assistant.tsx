"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, Sparkles, X } from "lucide-react";
import { suggestClientMessageAction } from "@/lib/conversations/draft-actions";
import type { DraftRequest, SuggestedDraft } from "@/lib/conversations/draft-validation";

export function DraftAssistant({ request, disabled, onApply }: {
  request: Omit<DraftRequest, "direction">; disabled: boolean; onApply: (draft: SuggestedDraft) => void;
}) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false), [direction, setDirection] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const disabledRef = useRef(disabled); disabledRef.current = disabled;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [applied, setApplied] = useState(false);
  const current = JSON.stringify(request);
  const currentRef = useRef(current); currentRef.current = current;
  const locked = useRef(false);
  async function generate() {
    if (disabled || locked.current) return;
    locked.current = true; setBusy(true); setError(""); setApplied(false);
    try {
      const next = await suggestClientMessageAction({ ...request, direction });
      // A late result must not refill a sent message or replace newer edits.
      if (!mounted.current) return;
      if (currentRef.current !== current || disabledRef.current) {
        setError("Your message or recipient changed, or a send is in progress. Generate again when you’re ready.");
      } else if ("error" in next) {
        setError(next.error);
      } else {
        onApply(next.draft); setOpen(false); setApplied(true); router.refresh();
        requestAnimationFrame(() => {
          const message = container.current?.closest("form")?.querySelector<HTMLTextAreaElement>('textarea[name="text"]');
          if (message && !message.readOnly && !message.disabled) {
            message.focus(); message.setSelectionRange(message.value.length, message.value.length);
          }
        });
      }
    } catch { if (mounted.current) setError("Could not generate a draft. Your message is unchanged. Please try again."); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  return <div className="ai-draft-assistant" ref={container}>
    <div className="ai-draft-toolbar"><button type="button" className="inbox-button ai-draft-toggle" disabled={disabled} aria-expanded={open} aria-controls={id} onClick={() => { setOpen(!open); setApplied(false); }}><Sparkles size={14} aria-hidden="true" />Suggest message</button>{applied ? <span role="status">Draft added. Edit it below, then send.</span> : null}</div>
    {open ? <div className="ai-draft-panel" id={id} aria-busy={busy}>
      <div className="ai-draft-heading"><strong>What would you like to say?</strong><button type="button" className="ai-draft-close" aria-label="Close draft assistant" onClick={() => setOpen(false)}><X size={16} aria-hidden="true" /></button></div>
      <p>Use the client’s saved brief, details and recent history, or add a direction. The draft goes straight into your message box for editing.</p>
      <div className="ai-draft-presets">{[
        ["Introduce us", "Initial message after the lead came in. Introduce Tailored Agents and ask about what they need."],
        ["Suggest a reply", "Reply to their latest message and suggest a useful next step."],
        ["Set up a meeting", "They seem ready to meet. Ask about a convenient time to discuss their project."],
      ].map(([label, prompt]) => <button type="button" key={label} disabled={busy || disabled} onClick={() => setDirection(prompt)}>{label}</button>)}</div>
      <label className="inbox-field"><span>Direction <small>(optional)</small></span><textarea aria-label="Message direction" rows={2} maxLength={1000} disabled={busy || disabled} value={direction} onChange={event => setDirection(event.target.value)} placeholder="E.g. First message to a lead looking for their first website…" /></label>
      <button type="button" className="inbox-button" disabled={busy || disabled} onClick={generate}>{busy ? <LoaderCircle className="signin-spinner" size={14} aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}{busy ? "Writing draft…" : "Generate draft"}</button>
      {error ? <p className="ai-draft-error" role="alert">{error}</p> : null}
    </div> : null}
  </div>;
}
