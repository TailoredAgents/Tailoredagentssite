import "server-only";
import twilio from "twilio";
import { E164_PHONE } from "@/lib/twilio/config";
import {
  CALL_SID,
  RECORDING_SID,
  VOICE_IDENTITY,
  VOICE_PATHS,
  VOICE_UUID,
  getVoiceConfiguration,
  type VoiceCallbackContext,
} from "./config";

export class VoiceWebhookError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
export const voiceResponseHeaders = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};
const MAX_BYTES = 64 * 1024;
async function boundedText(request: Request) {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES))
    throw new VoiceWebhookError(
      Number(length) > MAX_BYTES ? 413 : 400,
      "invalid_body",
    );
  if (!request.body) return "";
  const reader = request.body.getReader(),
    decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0,
    result = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new VoiceWebhookError(413, "invalid_body");
      }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } catch (error) {
    if (error instanceof VoiceWebhookError) throw error;
    throw new VoiceWebhookError(400, "invalid_body");
  } finally {
    reader.releaseLock();
  }
}
const caller = (value: string) =>
  E164_PHONE.test(value) ||
  (value.startsWith("client:") && VOICE_IDENTITY.test(value.slice(7))) ||
  ["anonymous", "restricted", "unknown", "unavailable", "private"].includes(
    value.toLowerCase(),
  );
/** Includes every bounded field in the SDK signature; never trusts host headers. */
export async function validateVoiceWebhook(
  request: Request,
  kind: keyof typeof VOICE_PATHS,
) {
  if (request.method !== "POST")
    throw new VoiceWebhookError(405, "method_not_allowed");
  const config = getVoiceConfiguration();
  if (!config.webhookReady) throw new VoiceWebhookError(503, "unavailable");
  if (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/x-www-form-urlencoded" ||
    ![null, "identity"].includes(request.headers.get("content-encoding"))
  )
    throw new VoiceWebhookError(415, "invalid_content_type");
  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (!/^[A-Za-z0-9+/]{27}=$/.test(signature))
    throw new VoiceWebhookError(401, "invalid_signature");
  const url = new URL(request.url),
    context: VoiceCallbackContext = {};
  if (url.pathname !== VOICE_PATHS[kind] || url.hash)
    throw new VoiceWebhookError(400, "invalid_url");
  for (const key of url.searchParams.keys())
    if (
      !["call", "intent", "leg", "user"].includes(key) ||
      url.searchParams.getAll(key).length !== 1
    )
      throw new VoiceWebhookError(400, "invalid_url");
  const callId = url.searchParams.get("call"),
    intentId = url.searchParams.get("intent"),
    leg = url.searchParams.get("leg"),
    userId = url.searchParams.get("user");
  if (
    (callId !== null && !VOICE_UUID.test(callId)) ||
    (intentId !== null && !VOICE_UUID.test(intentId)) ||
    (callId && intentId) ||
    (leg !== null && !["parent", "browser", "customer", "staff"].includes(leg))
  )
    throw new VoiceWebhookError(400, "invalid_binding");
  if (kind === "incoming" || kind === "outbound") {
    if (url.search) throw new VoiceWebhookError(400, "invalid_url");
  } else if (kind !== "status" && (!callId || intentId || leg))
    throw new VoiceWebhookError(400, "invalid_binding");
  if (
    kind === "staffAnswer"
      ? // Reject control characters in signed callback actor bindings.
        // eslint-disable-next-line no-control-regex
        !userId || userId.length > 200 || /[\x00-\x20\x7f]/.test(userId)
      : userId !== null
  )
    throw new VoiceWebhookError(400, "invalid_binding");
  if (leg && !callId && !intentId)
    throw new VoiceWebhookError(400, "invalid_binding");
  if (callId) context.callId = callId;
  if (intentId) context.intentId = intentId;
  if (leg) context.leg = leg as VoiceCallbackContext["leg"];
  if (userId) context.userId = userId;
  const encoded = new URLSearchParams(await boundedText(request));
  if (!encoded.size || encoded.size > 128)
    throw new VoiceWebhookError(400, "invalid_fields");
  const params: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;
  for (const [key, value] of encoded) {
    if (
      !key ||
      key.length > 128 ||
      /[^\x21-\x7e]/.test(key) ||
      Object.hasOwn(params, key) ||
      value.length > 4096
    )
      throw new VoiceWebhookError(400, "invalid_fields");
    params[key] = value;
  }
  if (
    !twilio.validateRequest(
      config.authToken,
      signature,
      config.baseUrl + VOICE_PATHS[kind] + url.search,
      params,
    )
  )
    throw new VoiceWebhookError(401, "invalid_signature");
  if (
    params.AccountSid !== config.accountSid ||
    !CALL_SID.test(params.CallSid ?? "") ||
    (params.ParentCallSid !== undefined &&
      !CALL_SID.test(params.ParentCallSid)) ||
    (params.DialCallSid !== undefined && !CALL_SID.test(params.DialCallSid))
  )
    throw new VoiceWebhookError(400, "invalid_call");
  if (
    kind === "incoming" &&
    (params.To !== config.phoneNumber ||
      !params.From ||
      !caller(params.From) ||
      params.From.startsWith("client:"))
  )
    throw new VoiceWebhookError(400, "invalid_call");
  if (
    kind === "outbound" &&
    (!params.From?.startsWith("client:") ||
      !VOICE_IDENTITY.test(params.From.slice(7)) ||
      !params.IntentToken ||
      params.IntentToken.length > 1024 ||
      /\s/.test(params.IntentToken) ||
      (params.ApplicationSid !== undefined &&
        params.ApplicationSid !== config.appSid))
  )
    throw new VoiceWebhookError(400, "invalid_intent");
  if (
    kind !== "outbound" &&
    ((params.From !== undefined && !caller(params.From)) ||
      (params.To !== undefined &&
        !(kind === "status" && params.To === "") &&
        !caller(params.To)))
  )
    throw new VoiceWebhookError(400, "invalid_call");
  if (
    (kind === "voicemail" || kind === "recording") &&
    (!RECORDING_SID.test(params.RecordingSid ?? "") ||
      !["completed", "absent", "failed", "in-progress"].includes(
        params.RecordingStatus ?? "",
      ) ||
      (params.RecordingSource !== undefined &&
        params.RecordingSource !== (kind === "recording" ? "DialVerb" : "RecordVerb")))
  )
    throw new VoiceWebhookError(400, "invalid_voicemail");
  return { params, context };
}
export async function handleVoiceWebhook(
  request: Request,
  kind: keyof typeof VOICE_PATHS,
  receive: (
    params: Record<string, string>,
    context: VoiceCallbackContext,
  ) => Promise<string | void>,
) {
  try {
    const { params, context } = await validateVoiceWebhook(request, kind);
    const twiml = await receive(params, context);
    return typeof twiml === "string"
      ? new Response(twiml, {
          headers: {
            ...voiceResponseHeaders,
            "content-type": "text/xml; charset=utf-8",
          },
        })
      : new Response(null, { status: 200, headers: voiceResponseHeaders });
  } catch (error) {
    if (error instanceof VoiceWebhookError)
      return Response.json(
        { error: error.code },
        { status: error.status, headers: voiceResponseHeaders },
      );
    console.error(JSON.stringify({ event: "voice_webhook_unavailable" }));
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: voiceResponseHeaders },
    );
  }
}
