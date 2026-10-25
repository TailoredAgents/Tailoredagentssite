"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { deleteLeadAction } from "@/lib/operations/actions";
import { initialOperationActionState } from "@/lib/operations/validation";
import styles from "./delete-lead-button.module.css";

export function DeleteLeadButton({ leadId, name }: { leadId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteLeadAction, initialOperationActionState);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirming) cancel.current?.focus(); }, [confirming]);
  return <section className={styles.panel} aria-label="Delete lead">
    {confirming ? <form action={action} aria-label="Confirm lead deletion" aria-busy={pending}>
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="confirmed" value="yes" />
      <strong>Delete {name}?</strong>
      <p>This permanently removes the lead, its linked Inbox history, notes, drafts, follow-up tasks and AI memory from the CRM. Call recordings are queued for deletion. Converted customers, projects and sales records are kept. Original email and SMS records in Mail and Twilio are separate.</p>
      {state.status === "error" ? <p role="alert" className={styles.error}>{state.message}</p> : null}
      <div className={styles.actions}>
        <button ref={cancel} type="button" disabled={pending} onClick={() => { setConfirming(false); requestAnimationFrame(() => trigger.current?.focus()); }}>Cancel</button>
        <button type="submit" className={styles.danger} disabled={pending}>
          {pending ? <LoaderCircle size={16} className="signin-spinner" /> : <Trash2 size={16} />}
          {pending ? "Deleting…" : "Permanently delete lead"}
        </button>
      </div>
    </form> : <button ref={trigger} type="button" className={styles.danger} onClick={() => setConfirming(true)}><Trash2 size={16} />Delete lead</button>}
  </section>;
}
