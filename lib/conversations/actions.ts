"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { ConversationAccessError } from "./access";
import * as work from "./service";
import { loadConversationSourceHistory } from "./records";
import { formValues, historySchema } from "./validation";
import type { ConversationActionState } from "./types";
async function change(
  form: FormData,
  fn: (
    context: Awaited<ReturnType<typeof requireDashboardContext>>,
    raw: unknown,
  ) => Promise<unknown>,
  message: string,
): Promise<ConversationActionState> {
  const context = await requireDashboardContext();
  try {
    const id = await fn(context, formValues(form));
    revalidatePath("/dashboard/inbox");
    return {
      status: "success",
      message,
      ...(typeof id === "string" ? { conversationId: id } : {}),
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof ZodError
          ? (error.issues[0]?.message ?? "Review the fields.")
          : error instanceof ConversationAccessError ||
              error instanceof work.ConversationInputError
            ? error.message
            : "This change could not be saved. Refresh and try again.",
    };
  }
}
export async function saveConversationWorkAction(
  _state: ConversationActionState,
  form: FormData,
) {
  return change(form, work.saveConversationWork, "Conversation work updated.");
}
export async function markConversationReadAction(
  _state: ConversationActionState,
  form: FormData,
) {
  return change(
    form,
    work.markConversationRead,
    "Marked read for your account.",
  );
}
export async function addConversationNoteAction(
  _state: ConversationActionState,
  form: FormData,
) {
  return change(
    form,
    work.addConversationNote,
    "Internal note saved for the selected audience. No message was sent.",
  );
}
export async function linkConversationContextAction(
  _state: ConversationActionState,
  form: FormData,
) {
  return change(form, work.linkConversationContext, "CRM context linked.");
}
export async function mergeConversationsAction(
  _state: ConversationActionState,
  form: FormData,
) {
  const result = await change(
    form,
    work.mergeConversations,
    "Conversation histories linked. Source permissions remain in effect.",
  );
  if (result.status === "success" && result.conversationId)
    redirect(
      `/dashboard/inbox?view=team&conversation=${result.conversationId}`,
    );
  return result;
}
export async function linkConversationSourceAction(
  _state: ConversationActionState,
  form: FormData,
) {
  return change(form, work.linkConversationSource, "Source linked.");
}
export async function loadConversationSourceHistoryAction(input: {
  sourceId: string;
  before?: string;
}) {
  const context = await requireDashboardContext();
  return loadConversationSourceHistory(context, historySchema.parse(input));
}
