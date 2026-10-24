"use client";

import { DraftAssistant } from "@/components/conversations/draft-assistant";
import type { ConversationRecipient } from "@/lib/conversations/types";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePenLine, LoaderCircle, LockKeyhole, Send } from "lucide-react";
import { saveDraftAction, sendInboxMessageAction } from "@/lib/inbox/actions";
import type { InboxDraft, InboxMailbox, InboxMessage } from "@/lib/inbox/types";
import type { InboxActionState } from "@/lib/inbox/validation";
import { inboxHref } from "./shared";

const initial: InboxActionState = { status: "idle", message: "" };
type SendIntent = { threadId?: string; requestId: string; to: string; subject: string; text: string; replyToMessageId: string; state: "pending" | "unknown" };

export function InboxComposer({ mailbox, threadId, subject: threadSubject = "", messages = [], draft, userId, readOnly, conversationHref, recipient, crmConversationId, compact = false }: { mailbox: InboxMailbox; threadId?: string; subject?: string; messages?: InboxMessage[]; draft?: InboxDraft | null; userId: string; readOnly: boolean; conversationHref?: string; recipient?: ConversationRecipient | null; crmConversationId?: string; compact?: boolean }) {
  const router = useRouter();
  const replyMessage = messages.find((message) => message.id === draft?.replyToMessageId && message.replyTargets.length) || [...messages].reverse().find((message) => message.replyTargets.length);
  const replyTargets = replyMessage?.replyTargets || [];
  const [to, setTo] = useState(draft?.to && (!threadId || replyTargets.includes(draft.to)) ? draft.to : replyTargets[0] || recipient?.email || "");
  const [subject, setSubject] = useState(draft?.subject || (threadId ? (/^re:/i.test(threadSubject) ? threadSubject : `Re: ${threadSubject}`) : ""));
  const [text, setText] = useState(draft?.text || "");
  const [replyToMessageId, setReplyToMessageId] = useState(replyMessage?.id || "");
  const [originalThreadId, setOriginalThreadId] = useState(threadId || "");
  const [requestId, setRequestId] = useState("");
  const [unresolved, setUnresolved] = useState(false);
  const [sendState, setSendState] = useState<"pending" | "unknown" | null>(null);
  const [sendResult, sendAction, sending] = useActionState(sendInboxMessageAction, initial);
  const [draftResult, draftAction, saving] = useActionState(saveDraftAction, initial);
  const submitted = useRef<SendIntent | null>(null);
  const unresolvedRef = useRef(false);
  const recoveredRecipientIntent = useRef(false);
  const acceptedRequestId = useRef<string | null>(null);
  const composeKey = recipient ? `${recipient.kind}:${recipient.id}` : undefined;
  const newRecipientKey = composeKey ? `tailored-inbox-send:${userId}:${mailbox.id}:${composeKey}` : undefined;
  const storageKey = `tailored-inbox-send:${userId}:${mailbox.id}:${threadId || composeKey || "compose"}`;
  const busy = sending || saving;
  const replyUnavailable = Boolean(threadId && !replyMessage);
  const sendDisabled = readOnly || !mailbox.canSend || busy || !requestId || replyUnavailable;

  useEffect(() => {
    let stored: SendIntent | null = null;
    try {
      const primary = sessionStorage.getItem(storageKey);
      const raw = primary || (newRecipientKey ? sessionStorage.getItem(newRecipientKey) : null);
      recoveredRecipientIntent.current = !primary && !!raw;
      const candidate = raw ? JSON.parse(raw) as Partial<SendIntent> : null;
      if (candidate && typeof candidate.requestId === "string" && typeof candidate.to === "string" && typeof candidate.subject === "string" && typeof candidate.text === "string" && typeof candidate.replyToMessageId === "string" && ["pending", "unknown"].includes(candidate.state || "")) stored = candidate as SendIntent;
    } catch { /* In-memory intent still protects retries when tab storage is unavailable. */ }
    if (stored) {
      submitted.current = stored;
      setOriginalThreadId(stored.threadId ?? threadId ?? "");
      unresolvedRef.current = true;
      setRequestId(stored.requestId); setTo(stored.to); setSubject(stored.subject); setText(stored.text); setReplyToMessageId(stored.replyToMessageId); setUnresolved(true); setSendState(stored.state);
    } else setRequestId(crypto.randomUUID());
  }, [storageKey, newRecipientKey, threadId]);

  useEffect(() => {
    if (sendResult.status === "idle") return;
    if (sendResult.sendState === "accepted") {
      // Refreshes from other channels can change effect dependencies after a new
      // draft has started. Process each accepted receipt only once.
      const receiptId = sendResult.requestId || submitted.current?.requestId;
      if (receiptId && acceptedRequestId.current === receiptId) return;
      acceptedRequestId.current = receiptId || null;
      try { sessionStorage.removeItem(storageKey); if (newRecipientKey && recoveredRecipientIntent.current) sessionStorage.removeItem(newRecipientKey); } catch { /* Storage is optional. */ }
      submitted.current = null; unresolvedRef.current = false; setUnresolved(false); setSendState(null); setText(""); setRequestId(crypto.randomUUID()); setOriginalThreadId(threadId || "");
      if (sendResult.crmConversationId) router.replace(`/dashboard/inbox?conversation=${sendResult.crmConversationId}`);
      else if (sendResult.threadId && !conversationHref) router.replace(inboxHref({ mailbox: mailbox.id, thread: sendResult.threadId }));
      router.refresh();
    } else if (sendResult.sendState === "pending" || sendResult.sendState === "unknown") {
      const intent = submitted.current;
      if (intent) {
        const next = { ...intent, requestId: sendResult.requestId || intent.requestId, state: sendResult.sendState };
        submitted.current = next; unresolvedRef.current = true; setRequestId(next.requestId); setUnresolved(true); setSendState(next.state);
        try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the current intent in memory. */ }
      }
    } else if (sendResult.sendState === "rejected") {
      try { sessionStorage.removeItem(storageKey); if (newRecipientKey && recoveredRecipientIntent.current) sessionStorage.removeItem(newRecipientKey); } catch { /* Storage is optional. */ }
      submitted.current = null; unresolvedRef.current = false; setUnresolved(false); setSendState(null); setRequestId(crypto.randomUUID());
    } else {
      // A grant or connectivity failure while checking a previous send does not
      // resolve that send. Its original payload and request key must survive.
      if (unresolvedRef.current) return;
      // A rejected validation/permission check did not submit a message. Keep all
      // text and the same key available to correct the draft and retry.
      try { sessionStorage.removeItem(storageKey); if (newRecipientKey && recoveredRecipientIntent.current) sessionStorage.removeItem(newRecipientKey); } catch { /* Storage is optional. */ }
      if (sendResult.requestId) setRequestId(sendResult.requestId);
    }
  }, [sendResult, storageKey, newRecipientKey, threadId, mailbox.id, router, conversationHref]);

  const envelopeFields = <><div className="inbox-from"><span>From</span><strong>{mailbox.email}</strong></div>
    {threadId ? <label className="inbox-field"><span>To</span><input name="to" type="email" value={to} readOnly aria-describedby="inbox-reply-target-note" /><small id="inbox-reply-target-note">Tailored Mail supplies the recipient and subject for this reply.</small></label> : <label className="inbox-field"><span>To *</span><input type="email" name="to" required maxLength={254} value={to} readOnly={unresolved} placeholder="name@business.com" onChange={(event) => setTo(event.target.value)} autoComplete="email" /></label>}
    <label className="inbox-field"><span>Subject{threadId ? "" : " *"}</span><input name="subject" required={!threadId} maxLength={500} value={subject} readOnly={Boolean(threadId) || unresolved} placeholder="A useful next step for your website" onChange={(event) => setSubject(event.target.value)} /></label></>;
  return <section className="inbox-composer" aria-labelledby="inbox-composer-title"><div className="inbox-composer-heading"><h2 id="inbox-composer-title">{threadId ? "Reply by email" : "New email"}</h2><span><LockKeyhole size={13} aria-hidden="true" />Drafts are private to you</span></div>
    <form action={sendAction} aria-label={threadId ? "Reply by email" : "Compose email"} aria-busy={busy} onSubmit={(event) => {
      if ((event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-intent") !== "send") return;
      const intent: SendIntent = { threadId: originalThreadId, requestId, to, subject, text, replyToMessageId, state: sendState || "pending" };
      submitted.current = intent;
      try { sessionStorage.setItem(storageKey, JSON.stringify(intent)); } catch { /* Keep the intent in memory. */ }
    }}>
      {recipient ? <><input type="hidden" name="recipientId" value={recipient.id} /><input type="hidden" name="recipientKind" value={recipient.kind} /><input type="hidden" name="composeKey" value={composeKey} /><input type="hidden" name="crmConversationId" value={crmConversationId || ""} /></> : null}<input type="hidden" name="mailboxId" value={mailbox.id} /><input type="hidden" name="threadId" value={unresolved ? originalThreadId : threadId || ""} /><input type="hidden" name="replyToMessageId" value={replyToMessageId} /><input type="hidden" name="requestId" value={requestId} />
      <fieldset disabled={readOnly || busy} className="inbox-composer-fields">
        {compact && threadId ? <details className="conversation-reply-details"><summary>Reply details<span>{to || "Recipient unavailable"}</span></summary><div>{envelopeFields}</div></details> : envelopeFields}
        <DraftAssistant key={`${storageKey}:${requestId}`} disabled={sendDisabled || unresolved} request={{ channel: "email", accountId: mailbox.id, to, threadId, conversationId: crmConversationId, recipient: recipient ? { kind: recipient.kind, id: recipient.id } : undefined, currentText: text, subject }} onApply={draft => { setText(draft.text); if (!threadId && draft.subject) setSubject(draft.subject); }} /><label className="inbox-field inbox-message-field"><span>Message *</span><textarea name="text" required maxLength={12000} value={text} readOnly={unresolved} placeholder={threadId ? "Write your reply…" : "Write your email…"} onChange={(event) => setText(event.target.value)} /></label>
      </fieldset>
      {readOnly ? <p className="inbox-form-help">Your dashboard access is read-only.</p> : !mailbox.canSend ? <p className="inbox-form-help">Your Mail grant allows reading this address. Sending requires send permission from a Tailored Mail administrator.</p> : null}
      {replyUnavailable ? <p className="inbox-form-help">Tailored Mail did not provide a valid reply target for this conversation.</p> : null}
      {unresolved ? <p className="inbox-send-pending" role="status">{sendState === "unknown" ? "The previous send has not been confirmed." : "This send is awaiting confirmation."} Check its status using the same request. The message stays unchanged to prevent a duplicate send.</p> : null}
      <div className="inbox-composer-feedback"><p className={`inbox-action-message is-${draftResult.status}`} role={draftResult.status === "error" ? "alert" : "status"}>{draftResult.message}</p><p className={`inbox-action-message is-${sendResult.status}`} role={sendResult.status === "error" ? "alert" : "status"}>{sendResult.message}</p></div>
      <div className="inbox-composer-actions"><button type="submit" formAction={draftAction} formNoValidate disabled={readOnly || busy} className="inbox-button" data-intent="draft">{saving ? <LoaderCircle size={15} className="signin-spinner" aria-hidden="true" /> : <FilePenLine size={15} aria-hidden="true" />}Save private draft</button><button type="submit" disabled={sendDisabled} className="inbox-button inbox-button-primary" data-intent="send">{sending ? <LoaderCircle size={15} className="signin-spinner" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}{sending ? "Sending…" : unresolved ? "Check send status" : threadId ? "Send reply" : "Send email"}</button></div>
      <p className="inbox-delivery-help">Service acceptance and delivery confirmation are shown separately in the conversation.</p>
    </form>
  </section>;
}
