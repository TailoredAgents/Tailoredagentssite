"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Sparkles } from "lucide-react";
import { startFactoryAction } from "@/lib/factory/actions";
import type { FactoryActionState } from "@/lib/factory/types";

export function StartFactoryButton({ leadId, disabled = false }: { leadId: string; disabled?: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (previous: FactoryActionState, form: FormData) => {
    try {
      const result = await startFactoryAction(previous, form);
      // Revalidation can replace this button with the existing-plan link before
      // an effect runs. Navigate from the action result even if it unmounts.
      if (result.status === "success" && result.projectId) router.push(`/dashboard/sales/factory/${result.projectId}`);
      return result;
    }
    catch { return { status: "error", message: "The workspace could not be opened. Please try again." } as FactoryActionState; }
  }, { status: "idle" });
  return <form action={action} className="factory-start" aria-label="Create website mockup"><input type="hidden" name="leadId" value={leadId} /><button className="dashboard-secondary-button" disabled={disabled || pending} type="submit">{pending ? <LoaderCircle size={16} className="signin-spinner" /> : <Sparkles size={16} aria-hidden="true" />}{pending ? "Opening…" : "Create website mockup"}</button>{state.message && state.status === "error" ? <p role="alert">{state.message}</p> : null}</form>;
}
