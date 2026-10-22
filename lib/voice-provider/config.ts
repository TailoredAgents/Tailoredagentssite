import "server-only";
import { getTwilioConfiguration } from "@/lib/twilio/config";

export const VOICE_PATHS = {
  incoming: "/api/integrations/twilio/voice/incoming",
  outbound: "/api/integrations/twilio/voice/outbound",
  status: "/api/integrations/twilio/voice/status",
  dial: "/api/integrations/twilio/voice/dial-result",
  voicemail: "/api/integrations/twilio/voice/voicemail",
  voicemailComplete: "/api/integrations/twilio/voice/voicemail-complete",
  staffAnswer: "/api/integrations/twilio/voice/staff-answer",
  recording: "/api/integrations/twilio/voice/recordings",
  customerAnswer: "/api/integrations/twilio/voice/customer-answer",
} as const;
export const CALL_SID = /^CA[0-9a-f]{32}$/i;
export const RECORDING_SID = /^RE[0-9a-f]{32}$/i;
export const VOICE_IDENTITY = /^ta_[0-9a-f]{48}$/;
export const VOICE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const VOICE_TOKEN_TTL = 300;
export const VOICEMAIL_MAX_SECONDS = 180;
type Environment = NonNullable<Parameters<typeof getTwilioConfiguration>[0]> & {
  TWILIO_VOICE_ENABLED?: string;
  TWILIO_VOICE_APP_SID?: string;
};

export function getVoiceConfiguration(environment: Environment = process.env) {
  const base = getTwilioConfiguration(environment);
  const appSid = environment.TWILIO_VOICE_APP_SID?.trim() ?? "";
  const missing = [...base.missing];
  if (!/^AP[0-9a-f]{32}$/i.test(appSid)) missing.push("TWILIO_VOICE_APP_SID");
  const ready = missing.length === 0;
  return {
    ready,
    restReady: base.ready,
    webhookReady: base.webhookReady,
    enabled: ready && environment.TWILIO_VOICE_ENABLED === "true",
    missing,
    accountSid: base.accountSid,
    authToken: base.authToken,
    apiKeySid: base.apiKeySid,
    apiKeySecret: base.apiKeySecret,
    phoneNumber: base.phoneNumber,
    appSid,
    baseUrl: base.baseUrl,
    urls: Object.fromEntries(
      Object.entries(VOICE_PATHS).map(([key, path]) => [
        key,
        base.baseUrl ? base.baseUrl + path : "",
      ]),
    ) as Record<keyof typeof VOICE_PATHS, string>,
  };
}
export function getVoicePublicConfiguration() {
  const { ready, webhookReady, enabled, missing, phoneNumber, urls } =
    getVoiceConfiguration();
  return {
    ready,
    webhookReady,
    enabled,
    missing,
    phoneNumber: /^\+[1-9]\d{7,14}$/.test(phoneNumber) ? phoneNumber : "",
    urls,
    tokenTtlSeconds: VOICE_TOKEN_TTL,
  };
}
export type VoiceCallbackContext = {
  callId?: string;
  intentId?: string;
  userId?: string;
  leg?: "parent" | "browser" | "customer" | "staff";
};
export function voiceCallbackUrl(
  kind: keyof typeof VOICE_PATHS,
  context: VoiceCallbackContext = {},
) {
  const config = getVoiceConfiguration();
  if (!config.baseUrl)
    throw new Error("The calling callback origin is not configured.");
  if (
    (context.callId && !VOICE_UUID.test(context.callId)) ||
    (context.intentId && !VOICE_UUID.test(context.intentId)) ||
    (context.callId && context.intentId) ||
    (context.leg &&
      !["parent", "browser", "customer", "staff"].includes(context.leg))
  )
    throw new Error("A valid calling callback binding is required.");
  if (
    context.userId &&
    (kind !== "staffAnswer" ||
      context.userId.length > 200 ||
      // Reject control characters in a provider callback actor binding.
      // eslint-disable-next-line no-control-regex
      /[\x00-\x20\x7f]/.test(context.userId))
  )
    throw new Error("A valid staff answer binding is required.");
  const query = new URLSearchParams();
  if (context.callId) query.set("call", context.callId);
  if (context.intentId) query.set("intent", context.intentId);
  if (context.leg) query.set("leg", context.leg);
  if (context.userId) query.set("user", context.userId);
  return config.urls[kind] + (query.size ? "?" + query.toString() : "");
}
