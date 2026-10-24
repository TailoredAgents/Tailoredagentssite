"use server";
import { bindSentRecipient } from "@/lib/conversations/service";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { TwilioProviderError } from "@/lib/twilio/provider";
import { SmsAccessError } from "./data";
import * as sms from "./service";
import { smsFormValues } from "./validation";
import type { SmsActionState } from "./types";
async function change(
  form: FormData,
  work: (
    context: Awaited<ReturnType<typeof requireDashboardContext>>,
    raw: Record<string, unknown>,
  ) => Promise<unknown>,
  message: string,
): Promise<SmsActionState> {
  const context = await requireDashboardContext();
  try {
    await work(context, smsFormValues(form));
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard/settings");
    return { status: "success", message };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof ZodError
          ? (error.issues[0]?.message ?? "Review the form fields.")
          : error instanceof SmsAccessError ||
              error instanceof sms.SmsInputError ||
              error instanceof TwilioProviderError
            ? error.message
            : "This change could not be saved. Refresh and try again.",
    };
  }
}
export async function connectSmsNumberAction(
  _state: SmsActionState,
  form: FormData,
) {
  return change(
    form,
    sms.connectSmsNumber,
    "Owned business number verified and connected. Only your account has been granted access.",
  );
}
export async function saveSmsGrantAction(
  _state: SmsActionState,
  form: FormData,
) {
  return change(form, sms.saveSmsGrant, "Number access updated.");
}
export async function setSmsNumberStatusAction(
  _state: SmsActionState,
  form: FormData,
) {
  return change(
    form,
    sms.setSmsNumberStatus,
    "Business number sending status updated.",
  );
}
export async function saveSmsConversationAction(
  _state: SmsActionState,
  form: FormData,
) {
  return change(form, sms.saveSmsConversation, "SMS conversation updated.");
}
export async function saveSmsDraftAction(
  _state: SmsActionState,
  form: FormData,
) {
  return change(
    form,
    sms.saveSmsDraft,
    "Private draft saved. No text was sent.",
  );
}
export async function addSmsNoteAction(_state: SmsActionState, form: FormData) {
  return change(form, sms.addSmsNote, "Internal note added. No text was sent.");
}
export async function markSmsReadAction(
  _state: SmsActionState,
  form: FormData,
) {
  return change(form, sms.markSmsRead, "Marked read for your account.");
}
async function sendAction(
  form: FormData,
  work: typeof sms.sendSmsMessage,
): Promise<SmsActionState> {
  const context = await requireDashboardContext();
  try {
    const result = await work(context, smsFormValues(form));
    if (result.sendState === "accepted" && result.conversationId && form.get("recipientId")) {
      try { result.crmConversationId = await bindSentRecipient(context, form, { channel: "sms", id: result.conversationId }); }
      catch { result.message += " Your message was accepted, but the CRM link could not be saved. Open the channel history to review it."; }
    }
    revalidatePath("/dashboard/inbox");
    return result;
  } catch (error) {
    const known =
      error instanceof ZodError ||
      error instanceof SmsAccessError ||
      error instanceof sms.SmsInputError ||
      error instanceof TwilioProviderError;
    const requestId = String(form.get("requestId") ?? "");
    return {
      status: "error",
      ...(!known &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requestId,
      )
        ? { sendState: "unknown" as const, requestId }
        : {}),
      message:
        error instanceof ZodError
          ? (error.issues[0]?.message ?? "Review the message.")
          : error instanceof SmsAccessError ||
              error instanceof sms.SmsInputError ||
              error instanceof TwilioProviderError
            ? error.message
            : "This send could not be checked. Keep the original request and refresh.",
    };
  }
}
export async function sendSmsMessageAction(
  _state: SmsActionState,
  form: FormData,
) {
  return sendAction(form, sms.sendSmsMessage);
}
export async function checkSmsSendAction(
  _state: SmsActionState,
  form: FormData,
) {
  return sendAction(form, sms.checkSmsSend);
}
