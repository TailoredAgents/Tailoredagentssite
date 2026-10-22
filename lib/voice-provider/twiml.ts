import "server-only";
import twilio from "twilio";
import { E164_PHONE } from "@/lib/twilio/config";
import {
  getVoiceConfiguration,
  voiceCallbackUrl,
  VOICE_IDENTITY,
  VOICE_UUID,
  VOICEMAIL_MAX_SECONDS,
} from "./config";

export function hangupTwiml(message?: string) {
  const response = new twilio.twiml.VoiceResponse();
  if (message) response.say(message.slice(0, 500));
  response.hangup();
  return response.toString();
}
export function outboundCallTwiml(input: {
  intentId: string;
  callId: string;
  from: string;
  to: string;
}) {
  const config = getVoiceConfiguration();
  if (
    !config.enabled ||
    !VOICE_UUID.test(input.intentId) ||
    !VOICE_UUID.test(input.callId) ||
    input.from !== config.phoneNumber ||
    !E164_PHONE.test(input.to)
  )
    throw new Error("An authorized calling intent is required.");
  const response = new twilio.twiml.VoiceResponse();
  const dial = response.dial({
    callerId: input.from,
    answerOnBridge: true,
    timeout: 25,
    timeLimit: 3600,
    record: "do-not-record",
    action: voiceCallbackUrl("dial", { callId: input.callId }),
    method: "POST",
  });
  dial.number(
    {
      statusCallback: voiceCallbackUrl("status", {
        callId: input.callId,
        leg: "customer",
      }),
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
    },
    input.to,
  );
  return response.toString();
}
export function voicemailTwiml(input: { callId: string; greeting?: string }) {
  if (!VOICE_UUID.test(input.callId))
    throw new Error("A valid voicemail call is required.");
  if (!getVoiceConfiguration().enabled)
    return hangupTwiml(
      "We are unable to take your call right now. Please try again later.",
    );
  const response = new twilio.twiml.VoiceResponse();
  response.say(
    (input.greeting?.trim() || "Thank you for calling Tailored Agents.").slice(
      0,
      1500,
    ),
  );
  response.say(
    "Your voicemail will be recorded. Please leave your name, phone number and a short message after the tone. Press pound when you are finished.",
  );
  response.record({
    action: voiceCallbackUrl("voicemailComplete", { callId: input.callId }),
    method: "POST",
    maxLength: VOICEMAIL_MAX_SECONDS,
    timeout: 5,
    finishOnKey: "#",
    playBeep: true,
    transcribe: false,
    trim: "trim-silence",
    recordingStatusCallback: voiceCallbackUrl("voicemail", {
      callId: input.callId,
    }),
    recordingStatusCallbackMethod: "POST",
    recordingStatusCallbackEvent: ["completed", "absent"],
  });
  return response.toString();
}
export function inboundCallTwiml(input: {
  callId: string;
  targets: { identity: string; userId: string }[];
  voicemail: boolean;
  greeting?: string;
  timeout?: number;
}) {
  if (
    !VOICE_UUID.test(input.callId) ||
    input.targets.length > 10 ||
    input.targets.some((t) => !VOICE_IDENTITY.test(t.identity) || !t.userId) ||
    new Set(input.targets.map((t) => t.identity)).size !== input.targets.length
  )
    throw new Error("Approved calling targets are required.");
  if (!getVoiceConfiguration().enabled)
    return hangupTwiml(
      "We are unable to take your call right now. Please try again later.",
    );
  if (!input.targets.length)
    return input.voicemail ? voicemailTwiml(input) : hangupTwiml();
  const response = new twilio.twiml.VoiceResponse();
  const dial = response.dial({
    answerOnBridge: true,
    timeout: Math.min(
      30,
      Math.max(10, Number.isInteger(input.timeout) ? input.timeout! : 25),
    ),
    timeLimit: 3600,
    record: "do-not-record",
    action: voiceCallbackUrl("dial", { callId: input.callId }),
    method: "POST",
  });
  for (const target of input.targets) {
    const client = dial.client({
      url: voiceCallbackUrl("staffAnswer", {
        callId: input.callId,
        userId: target.userId,
      }),
      method: "POST",
      statusCallback: voiceCallbackUrl("status", {
        callId: input.callId,
        leg: "staff",
      }),
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
    });
    client.identity(target.identity);
    client.parameter({ name: "CallId", value: input.callId });
  }
  return response.toString();
}
