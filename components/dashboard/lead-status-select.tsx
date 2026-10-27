"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { updateLeadStatusAction } from "@/lib/operations/actions";
import { statusLabel } from "@/lib/operations/format";
import { initialOperationActionState, leadStatuses } from "@/lib/operations/validation";
import styles from "./lead-status-select.module.css";

export function LeadStatusSelect({ leadId, name, status }: { leadId: string; name: string; status: string }) {
  const [value, setValue] = useOptimistic(status);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState(initialOperationActionState);
  const feedbackId = useId();

  return <div className={styles.control} aria-busy={pending}>
    <select
      aria-label={`Status for ${name}`}
      aria-describedby={feedbackId}
      className={`dashboard-status status-${value} ${styles.select}`}
      value={value}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value;
        const form = new FormData();
        form.set("leadId", leadId);
        form.set("status", next);
        startTransition(async () => {
          setValue(next);
          try {
            setResult(await updateLeadStatusAction(initialOperationActionState, form));
          } catch {
            setResult({ status: "error", message: "Status could not be saved. Try again." });
          }
        });
      }}
    >
      {leadStatuses.map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}
    </select>
    <span id={feedbackId} className={styles.feedback} role={result.status === "error" && !pending ? "alert" : "status"}>
      {pending ? "Saving…" : result.message}
    </span>
  </div>;
}
