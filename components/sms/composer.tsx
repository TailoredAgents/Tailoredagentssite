"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePenLine, LoaderCircle, LockKeyhole, Send, ShieldAlert } from "lucide-react";
import { checkSmsSendAction, saveSmsDraftAction, sendSmsMessageAction } from "@/lib/sms/actions";
import type { SmsActionState, SmsDraft, SmsNumber } from "@/lib/sms/types";
import { smsHref } from "./shared";

const initial: SmsActionState = { status: "idle", message: "" };
type Intent = { requestId: string; to: string; text: string; permissionConfirmed: boolean; permissionEvidence: string; state: "pending" | "unknown" };

export function SmsComposer({ number, conversationId, phone, permissionState = "unknown", draft, userId, readOnly, conversationHref, compact = false }: { number: SmsNumber; conversationId?: string; phone?: string; permissionState?: "unknown" | "allowed" | "blocked"; draft?: SmsDraft | null; userId: string; readOnly: boolean; conversationHref?: string; compact?: boolean }) {
  const router = useRouter();
  const [to, setTo] = useState(phone || draft?.to || "");
  const [text, setText] = useState(draft?.text || "");
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const [permissionEvidence, setPermissionEvidence] = useState("");
  const [requestId, setRequestId] = useState("");
  const [unresolved, setUnresolved] = useState(false);
  const [feedback, setFeedback] = useState<SmsActionState>(initial);
  const unresolvedRef = useRef(false);
  const intentRef = useRef<Intent | null>(null);
  const storageKey = `tailored-sms-send:${userId}:${number.id}:${conversationId || "compose"}`;
  const needsPermission = permissionState === "unknown";

  function applyReceipt(receipt: SmsActionState) {
    setFeedback(receipt);
    if (receipt.sendState === "accepted") {
      try { sessionStorage.removeItem(storageKey); } catch { /* In-memory state is sufficient for this tab. */ }
      unresolvedRef.current = false; intentRef.current = null; setUnresolved(false); setText(""); setRequestId(crypto.randomUUID());
      if (receipt.conversationId && !conversationHref) router.replace(smsHref({ number: number.id, thread: receipt.conversationId }));
      router.refresh();
    } else if (receipt.sendState === "unknown" || receipt.sendState === "pending") {
      const intent = intentRef.current;
      if (intent) {
        const next: Intent = { ...intent, requestId: receipt.requestId || intent.requestId, state: receipt.sendState };
        intentRef.current = next; unresolvedRef.current = true; setUnresolved(true); setRequestId(next.requestId);
        try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Retain the original intent in memory. */ }
      }
    } else if (receipt.sendState === "rejected") {
      try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
      unresolvedRef.current = false; intentRef.current = null; setUnresolved(false); setRequestId(crypto.randomUUID());
    } else if (!unresolvedRef.current) {
      try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
    }
  }

  const [, sendAction, sending] = useActionState(async (state: SmsActionState, form: FormData) => {
    const receipt = await sendSmsMessageAction(state, form); applyReceipt(receipt); return receipt;
  }, initial);
  const [, checkAction, checking] = useActionState(async (state: SmsActionState, form: FormData) => {
    const receipt = await checkSmsSendAction(state, form); applyReceipt(receipt); return receipt;
  }, initial);
  const [draftState, draftAction, saving] = useActionState(saveSmsDraftAction, initial);
  const busy = sending || checking || saving;
  const blocked = permissionState === "blocked";
  const disabled = readOnly || !number.canSend || number.status !== "active" || blocked || busy || !requestId;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      const stored = raw ? JSON.parse(raw) as Partial<Intent> : null;
      if (stored && typeof stored.requestId === "string" && typeof stored.to === "string" && typeof stored.text === "string" && typeof stored.permissionEvidence === "string" && typeof stored.permissionConfirmed === "boolean" && ["pending", "unknown"].includes(stored.state || "")) {
        intentRef.current = stored as Intent; unresolvedRef.current = true; setUnresolved(true); setRequestId(stored.requestId); setTo(stored.to); setText(stored.text); setPermissionConfirmed(stored.permissionConfirmed); setPermissionEvidence(stored.permissionEvidence); return;
      }
    } catch { /* Browser storage may be unavailable. */ }
    setRequestId(crypto.randomUUID());
  }, [storageKey]);

  const envelopeFields = <><div className="inbox-from"><span>From</span><strong>{number.phone}</strong></div><label className="inbox-field"><span>Recipient phone *</span><input type="tel" name="to" aria-label="Recipient phone *" aria-describedby="sms-recipient-note" required maxLength={50} value={to} readOnly={Boolean(conversationId) || unresolved} onChange={(event) => setTo(event.target.value)} placeholder="+1 678 555 0123" autoComplete="tel" /><small id="sms-recipient-note">Include the country code, such as +1 for the United States.</small></label></>;
  return <section className="inbox-composer sms-composer" aria-labelledby="sms-composer-title"><div className="inbox-composer-heading"><h2 id="sms-composer-title">{conversationId ? "Send a text" : "New text message"}</h2><span><LockKeyhole size={13} aria-hidden="true" />Private draft</span></div><form action={unresolved ? checkAction : sendAction} aria-label={conversationId ? "Send SMS reply" : "Compose SMS"} aria-busy={busy} onSubmit={(event) => {
    if ((event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-intent") !== "send" || unresolved) return;
    const intent: Intent = { requestId, to, text, permissionConfirmed, permissionEvidence, state: "pending" };
    intentRef.current = intent;
    try { sessionStorage.setItem(storageKey, JSON.stringify(intent)); } catch { /* Keep the same intent in memory. */ }
  }}><input type="hidden" name="numberId" value={number.id} /><input type="hidden" name="conversationId" value={conversationId || ""} /><input type="hidden" name="requestId" value={requestId} />
    <fieldset className="inbox-composer-fields" disabled={readOnly || busy}>{compact && conversationId ? <details className="conversation-reply-details"><summary>Text details<span>{to}</span></summary><div>{envelopeFields}</div></details> : envelopeFields}<label className="inbox-field inbox-message-field"><span>Text message *</span><textarea name="text" required maxLength={1600} value={text} readOnly={unresolved} onChange={(event) => setText(event.target.value)} placeholder="Write a personal text message…" /></label><div className="sms-character-count"><span>Long messages may use multiple billable SMS segments.</span><strong>{text.length.toLocaleString()} / 1,600</strong></div>
      {needsPermission ? <><label className="sms-settings-check"><input type="checkbox" name="permissionConfirmed" required checked={permissionConfirmed} disabled={unresolved} onChange={(event) => setPermissionConfirmed(event.target.checked)} /><span>I have permission to text this recipient about this conversation.</span></label><label className="inbox-field"><span>Permission evidence *</span><textarea name="permissionEvidence" required minLength={5} maxLength={2000} value={permissionEvidence} readOnly={unresolved} onChange={(event) => setPermissionEvidence(event.target.value)} placeholder="When and how did this person agree to receive texts?" /></label></> : null}
    </fieldset>{unresolved && needsPermission ? <input type="hidden" name="permissionConfirmed" value={permissionConfirmed ? "on" : ""} /> : null}
    {blocked ? <p className="sms-recipient-optout"><ShieldAlert size={16} aria-hidden="true" />Sending is blocked because this recipient has opted out.</p> : null}
    {readOnly ? <p className="inbox-form-help">Your dashboard access is read-only.</p> : number.status === "paused" ? <p className="inbox-form-help">This number is paused. An administrator can resume it in Settings.</p> : !number.canSend ? <p className="inbox-form-help">Your number access allows reading. Sending requires an explicit send grant.</p> : null}
    {unresolved ? <p className="inbox-send-pending" role="status">The previous send has not been confirmed. Check its status before starting another message. A status check does not send the message again.</p> : null}
    <p className={`inbox-action-message is-${draftState.status}`} role={draftState.status === "error" ? "alert" : "status"}>{draftState.message}</p><p className={`inbox-action-message is-${feedback.status}`} role={feedback.status === "error" ? "alert" : "status"}>{feedback.message}</p>
    <div className="inbox-composer-actions"><button type="submit" className="inbox-button" formAction={draftAction} formNoValidate disabled={readOnly || busy} data-intent="draft">{saving ? <LoaderCircle className="signin-spinner" size={15} aria-hidden="true" /> : <FilePenLine size={15} aria-hidden="true" />}Save private draft</button><button type="submit" className="inbox-button inbox-button-primary" disabled={unresolved ? readOnly || busy || !requestId : disabled} formNoValidate={unresolved} data-intent={unresolved ? "check" : "send"}>{sending || checking ? <LoaderCircle className="signin-spinner" size={15} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}{checking ? "Checking…" : sending ? "Sending…" : unresolved ? "Check SMS status" : "Send text"}</button></div><p className="inbox-delivery-help">Twilio acceptance, carrier delivery, and delivery failures appear separately in the conversation.</p>
  </form></section>;
}
