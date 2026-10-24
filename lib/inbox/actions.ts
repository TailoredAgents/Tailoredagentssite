"use server";
import { bindSentRecipient } from "@/lib/conversations/service";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { InboxAccessError } from "./data";
import { MailProviderError } from "./mail-provider";
import * as inbox from "./service";
import { inboxFormValues, type InboxActionState } from "./validation";

function failure(error: unknown): InboxActionState {
  return {
    status: "error",
    message:
      error instanceof ZodError
        ? (error.issues[0]?.message ?? "Review the form fields.")
        : error instanceof InboxAccessError ||
            error instanceof inbox.InboxInputError ||
            error instanceof MailProviderError
          ? error.message
          : "This change could not be saved. Refresh and try again.",
  };
}
async function change(
  form: FormData,
  work: (
    context: Awaited<ReturnType<typeof requireDashboardContext>>,
    input: Record<string, unknown>,
  ) => Promise<unknown>,
  message: string,
): Promise<InboxActionState> {
  const context = await requireDashboardContext();
  try {
    await work(context, inboxFormValues(form));
    revalidatePath("/dashboard/inbox");
    return { status: "success", message };
  } catch (error) {
    return failure(error);
  }
}
export async function saveConversationAction(
  _state: InboxActionState,
  form: FormData,
) {
  return change(form, inbox.saveConversation, "Conversation updated.");
}
export async function saveDraftAction(
  _state: InboxActionState,
  form: FormData,
) {
  return change(
    form,
    inbox.saveDraft,
    "Private draft saved. No email was sent.",
  );
}
export async function addInboxNoteAction(
  _state: InboxActionState,
  form: FormData,
) {
  return change(
    form,
    inbox.addInboxNote,
    "Internal note added. No email was sent.",
  );
}
export async function markInboxReadAction(
  _state: InboxActionState,
  form: FormData,
) {
  return change(form, inbox.markInboxRead, "Marked read for your account.");
}
export async function sendInboxMessageAction(
  _state: InboxActionState,
  form: FormData,
): Promise<InboxActionState> {
  const context = await requireDashboardContext();
  try {
    const result = await inbox.sendInboxMessage(context, inboxFormValues(form));
    if (result.sendState === "accepted" && result.threadId && form.get("recipientId")) {
      try { result.crmConversationId = await bindSentRecipient(context, form, { channel: "email", id: result.threadId }); }
      catch { result.message += " Your message was accepted, but the CRM link could not be saved. Open the channel history to review it."; }
    }
    revalidatePath("/dashboard/inbox");
    return result;
  } catch (error) {
    return failure(error);
  }
}
