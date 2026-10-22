"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import type { ConversationActionState } from "@/lib/conversations/types";
import { conversationHref } from "./shared";

export const initialConversationState: ConversationActionState = { status: "idle", message: "" };

export function ConversationActionForm({ action, label, children, disabled = false, className = "", resetOnSuccess = false, followConversation = false }: {
  action: (state: ConversationActionState, form: FormData) => Promise<ConversationActionState>;
  label: string; children: React.ReactNode; disabled?: boolean; className?: string; resetOnSuccess?: boolean; followConversation?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialConversationState);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state.status !== "success") return;
    if (resetOnSuccess) ref.current?.reset();
    if (followConversation && state.conversationId) router.replace(conversationHref({ conversation: state.conversationId, view: "team" }));
  }, [state, resetOnSuccess, followConversation, router]);
  return <form ref={ref} action={formAction} className={`conversation-form ${className}`} aria-label={label} aria-busy={pending}>
    <fieldset disabled={disabled || pending}>{children}</fieldset>
    <div className="conversation-form-footer"><p className={`conversation-feedback is-${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p><button className="conversation-button" type="submit" disabled={disabled || pending}>{pending ? <LoaderCircle className="signin-spinner" size={15} aria-hidden="true" /> : null}{pending ? "Saving…" : label}</button></div>
  </form>;
}
