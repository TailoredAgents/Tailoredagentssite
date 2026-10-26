"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { VoiceAccessError, VoiceInputError, getVoiceCall } from "./data";
import { VoiceProviderError } from "@/lib/voice-provider/provider";
import * as service from "./service";
import type { VoiceActionState } from "./types";
import { saveRecordingPreferences, requestCallAnalysis, deleteCallRecording } from "./recordings";
function failure(e: unknown): VoiceActionState {
  return {
    status: "error",
    message:
      e instanceof ZodError
        ? (e.issues[0]?.message ?? "Review the call details.")
        : e instanceof VoiceAccessError ||
            e instanceof VoiceInputError ||
            e instanceof VoiceProviderError
          ? e.message
          : "The call change could not be confirmed. Refresh the existing call before trying again.",
  };
}
async function change(
  form: FormData,
  work: (
    context: Awaited<ReturnType<typeof requireDashboardContext>>,
    input: Record<string, unknown>,
  ) => Promise<unknown>,
  message: string,
) {
  const context = await requireDashboardContext();
  try {
    const i: Record<string, unknown> = Object.fromEntries(form.entries());
    for (const key of [
      "canRead",
      "canCall",
      "canReceive",
      "canManageVoicemail",
      "recordCalls",
      "recordingAnnouncement",
      "autoTranscribe",
      "always",
    ])
      i[key] = form.get(key) === "on" || form.get(key) === "true";
    if (form.has("days"))
      i.days = String(form.get("days")).split(",").filter(Boolean).map(Number);
    await work(context, i);
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard", "layout");
    return { status: "success", message } as VoiceActionState;
  } catch (e) {
    return failure(e);
  }
}
export async function connectVoiceLineAction(_: VoiceActionState, f: FormData) {
  return change(
    f,
    service.connectVoiceLine,
    "Voice line verified. Only your own voice grant was added.",
  );
}
export async function saveVoiceGrantAction(_: VoiceActionState, f: FormData) {
  return change(f, service.saveVoiceGrant, "Voice permissions updated.");
}
export async function saveCallingPhoneAction(_: VoiceActionState, f: FormData) {
  return change(f,service.saveCallingPhone,"Personal calling phone saved.");
}
export async function saveVoiceRoutingAction(_: VoiceActionState, f: FormData) {
  return change(f, service.saveVoiceRouting, "Call routing updated.");
}
export async function saveRecordingPreferencesAction(_: VoiceActionState, f: FormData) {
  return change(f,saveRecordingPreferences,"Call recording preferences updated. Changes apply to new calls.");
}
export async function requestCallAnalysisAction(_: VoiceActionState, f: FormData) {
  return change(f,requestCallAnalysis,"Transcript and summary queued.");
}
export async function deleteCallRecordingAction(_: VoiceActionState, f: FormData) {
  return change(f,(context,input)=>deleteCallRecording(context,String(input.recordingId||"")),"Recording deletion requested. Audio and analysis are now hidden.");
}
export async function deleteVoicemailAction(_: VoiceActionState, f: FormData) {
  return change(
    f,
    (c, i) => service.deleteVoicemail(c, String(i.voicemailId ?? "")),
    "Voicemail deleted.",
  );
}
export async function issueVoiceTokenAction(lineId: string) {
  return service.issueVoiceToken(await requireDashboardContext(), lineId);
}
export async function updateVoicePresenceAction(input: {
  lineId: string;
  available: boolean;
}) {
  return service.updateVoicePresence(await requireDashboardContext(), input);
}
export async function getOwnPhoneCallAction() {
  const {getOwnPhoneCall} = await import("./data");
  return getOwnPhoneCall(await requireDashboardContext());
}
export async function startPhoneCallAction(callId: string): Promise<VoiceActionState> {
  try {
    const result = await service.startPhoneCall(await requireDashboardContext(), {callId});
    return {status: "success", message: result, callId};
  } catch (error) { return failure(error); }
}

export async function createVoiceIntentAction(input: {
  mode?: "browser" | "phone";
  lineId: string;
  to: string;
  conversationId?: string;
  recipient?: { kind: "contact" | "lead"; id: string };
  requestId: string;
}) {
  return service.createVoiceIntent(await requireDashboardContext(), input);
}
export async function getVoiceCallAction(callId: string) {
  return getVoiceCall(await requireDashboardContext(), callId);
}
export async function acceptVoiceCallAction(input: { callId: string }) {
  return service.acceptVoiceCall(await requireDashboardContext(), input);
}
export async function endVoiceCallAction(input: {
  callId: string;
}): Promise<VoiceActionState> {
  try {
    await service.endCall(await requireDashboardContext(), input);
    revalidatePath("/dashboard/inbox");
    return {
      status: "success",
      message: "The call has ended.",
      callId: input.callId,
    };
  } catch (e) {
    return failure(e);
  }
}

export async function saveVoiceForwardingAction(_: VoiceActionState, f: FormData) {
  return change(f, service.saveVoiceForwarding, "Incoming call destination saved. Applies to new calls.");
}
