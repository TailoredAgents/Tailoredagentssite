"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";
import {
  initialOperationActionState,
  type OperationActionState,
} from "@/lib/operations/validation";

export function OperationForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving",
  className = "dashboard-operation-form",
  resetOnSuccess = false,
  disabled = false,
}: {
  action: (state: OperationActionState, formData: FormData) => Promise<OperationActionState>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
  disabled?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, initialOperationActionState);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") formRef.current?.reset();
  }, [resetOnSuccess, state.status]);

  return (
    <form ref={formRef} action={formAction} className={className} aria-label={submitLabel} aria-busy={pending}>
      <fieldset className="dashboard-operation-fields" disabled={disabled || pending}>{children}</fieldset>
      <div className="dashboard-form-footer">
        <p className={`dashboard-form-message is-${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>
        <button type="submit" disabled={disabled || pending}>
          {pending ? <LoaderCircle className="signin-spinner" size={15} /> : null}
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
