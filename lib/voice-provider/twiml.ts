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
  recordCalls?: boolean;
  recordingAnnouncement?: boolean;
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
  if (input.recordCalls && input.recordingAnnouncement) response.say(RECORDING_ANNOUNCEMENT);
  const dial = response.dial({
    callerId: input.from,
    answerOnBridge: true,
    timeout: 25,
    timeLimit: 3600,
    ...recordingAttributes(input),
    action: voiceCallbackUrl("dial", { callId: input.callId }),
    method: "POST",
  });
  dial.number(
    {
      ...(input.recordCalls && input.recordingAnnouncement ? { url: voiceCallbackUrl("customerAnswer", { callId: input.callId }), method: "POST" } : {}),
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
  forwardPhone?: string | null;
  voicemail: boolean;
  greeting?: string;
  timeout?: number;
  recordCalls?: boolean;
  recordingAnnouncement?: boolean;
}) {
  if (
    !VOICE_UUID.test(input.callId) ||
    input.targets.length > 10 ||
    (input.forwardPhone && (!/^\+1[0-9]{10}$/.test(input.forwardPhone) || input.forwardPhone === getVoiceConfiguration().phoneNumber || input.targets.length > 0)) ||
    input.targets.some((t) => !VOICE_IDENTITY.test(t.identity) || !t.userId) ||
    new Set(input.targets.map((t) => t.identity)).size !== input.targets.length
  )
    throw new Error("Approved calling targets are required.");
  if (!getVoiceConfiguration().enabled)
    return hangupTwiml(
      "We are unable to take your call right now. Please try again later.",
    );
  if (!input.targets.length && !input.forwardPhone)
    return input.voicemail ? voicemailTwiml(input) : hangupTwiml();
  const response = new twilio.twiml.VoiceResponse();
  if (input.recordCalls && input.recordingAnnouncement) response.say(RECORDING_ANNOUNCEMENT);
  const dial = response.dial({
    ...(input.forwardPhone ? {callerId: getVoiceConfiguration().phoneNumber} : {}),
    answerOnBridge: true,
    timeout: Math.min(
      30,
      Math.max(10, Number.isInteger(input.timeout) ? input.timeout! : 25),
    ),
    timeLimit: 3600,
    ...recordingAttributes(input),
    action: voiceCallbackUrl("dial", { callId: input.callId }),
    method: "POST",
  });
  if (input.forwardPhone) dial.number({
    url: voiceCallbackUrl("forwardAnswer", {callId:input.callId}), method:"POST",
    statusCallback: voiceCallbackUrl("status", {callId:input.callId,leg:"staff"}),
    statusCallbackEvent:["initiated","ringing","answered","completed"], statusCallbackMethod:"POST",
  }, input.forwardPhone);
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
export const RECORDING_ANNOUNCEMENT = "This call will be recorded by Tailored Agents.";
function recordingAttributes(input: { callId: string; recordCalls?: boolean }) {
  return input.recordCalls ? {
    record: "record-from-answer-dual" as const,
    recordingStatusCallback: voiceCallbackUrl("recording", { callId: input.callId }),
    recordingStatusCallbackMethod: "POST" as const,
    recordingStatusCallbackEvent: ["completed", "absent"] as ("completed" | "absent")[],
  } : { record: "do-not-record" as const };
}
export function recordingAnswerTwiml(announce: boolean) {
  if (!announce) return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  const response = new twilio.twiml.VoiceResponse();
  if (announce) response.say(RECORDING_ANNOUNCEMENT);
  return response.toString();
}

export function callbackScreenTwiml(callId: string) {
  if (!VOICE_UUID.test(callId)) throw new Error("A valid call is required.");
  const response = new twilio.twiml.VoiceResponse();
  response.gather({input:["dtmf"], numDigits:1, timeout:8, action:voiceCallbackUrl("callbackAccept",{callId}), method:"POST"})
    .say("Tailored Agents. Press 1 to call your customer.");
  response.hangup();
  return response.toString();
}

export function forwardScreenTwiml(callId: string) {
  const response = new twilio.twiml.VoiceResponse();
  const gather = response.gather({input:["dtmf"],numDigits:1,timeout:6,action:voiceCallbackUrl("forwardAccept",{callId}),method:"POST"});
  gather.say("Tailored Agents call. Press 1 to accept.");
  response.hangup();
  return response.toString();
}
