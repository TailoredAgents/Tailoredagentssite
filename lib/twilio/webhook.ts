import "server-only";
import twilio from "twilio";
import {
  E164_PHONE,
  TWILIO_MESSAGE_SID,
  getTwilioConfiguration,
  isSmsAttemptId,
  SMS_INCOMING_PATH,
  SMS_STATUS_PATH,
} from "./config";

export class TwilioWebhookError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
const MAX_BYTES = 64 * 1024;
const MAX_FIELDS = 128;
const headers = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

async function boundedText(request: Request) {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES))
    throw new TwilioWebhookError(
      Number(length) > MAX_BYTES ? 413 : 400,
      "invalid_body",
    );
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0,
    result = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new TwilioWebhookError(413, "invalid_body");
      }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } catch (error) {
    if (error instanceof TwilioWebhookError) throw error;
    throw new TwilioWebhookError(400, "invalid_body");
  } finally {
    reader.releaseLock();
  }
}

/** Signature validation uses the configured public origin, never proxy headers. */
export async function validateSmsWebhook(
  request: Request,
  kind: "incoming" | "status",
) {
  if (request.method !== "POST")
    throw new TwilioWebhookError(405, "method_not_allowed");
  const config = getTwilioConfiguration();
  if (!config.webhookReady) throw new TwilioWebhookError(503, "unavailable");
  // Outbound pause never disables inbound opt-out handling or delivery updates.
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (
    contentType !== "application/x-www-form-urlencoded" ||
    ![null, "identity"].includes(request.headers.get("content-encoding"))
  )
    throw new TwilioWebhookError(415, "invalid_content_type");
  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (!/^[A-Za-z0-9+/]{27}=$/.test(signature))
    throw new TwilioWebhookError(401, "invalid_signature");
  const observed = new URL(request.url),
    path = kind === "incoming" ? SMS_INCOMING_PATH : SMS_STATUS_PATH;
  if (observed.pathname !== path)
    throw new TwilioWebhookError(400, "invalid_url");
  const attempts = observed.searchParams.getAll("attempt");
  let attemptId: string | undefined;
  if (kind === "incoming") {
    if (observed.search) throw new TwilioWebhookError(400, "invalid_url");
  } else {
    if (
      attempts.length !== 1 ||
      [...observed.searchParams.keys()].some((key) => key !== "attempt") ||
      !isSmsAttemptId(attempts[0])
    )
      throw new TwilioWebhookError(400, "invalid_attempt");
    attemptId = attempts[0];
  }
  const canonical = config.baseUrl + path + observed.search;
  const encoded = new URLSearchParams(await boundedText(request));
  if (encoded.size === 0 || encoded.size > MAX_FIELDS)
    throw new TwilioWebhookError(400, "invalid_fields");
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
      value.length > (key === "Body" ? 16000 : 4096)
    )
      throw new TwilioWebhookError(400, "invalid_fields");
    params[key] = value;
  }
  // Every received field, including fields unknown to this release, participates
  // in the SDK's signature calculation. Do not select a subset before verifying.
  if (!twilio.validateRequest(config.authToken, signature, canonical, params))
    throw new TwilioWebhookError(401, "invalid_signature");
  const messageId = params.MessageSid ?? params.SmsSid;
  if (
    params.AccountSid !== config.accountSid ||
    !messageId ||
    !TWILIO_MESSAGE_SID.test(messageId) ||
    (params.SmsSid !== undefined && params.SmsSid !== messageId) ||
    (params.ChannelPrefix !== undefined &&
      !["sms", "mms"].includes(params.ChannelPrefix.toLowerCase())) ||
    (kind === "incoming" && (!params.From || !params.To)) ||
    (params.From !== undefined && !E164_PHONE.test(params.From)) ||
    (params.To !== undefined && !E164_PHONE.test(params.To))
  )
    throw new TwilioWebhookError(400, "invalid_message");
  return { params, attemptId };
}

export async function handleSmsWebhook(
  request: Request,
  kind: "incoming" | "status",
  receive: (
    params: Record<string, string>,
    attemptId?: string,
  ) => Promise<unknown>,
) {
  try {
    const { params, attemptId } = await validateSmsWebhook(request, kind);
    await receive(params, attemptId);
    return kind === "incoming"
      ? new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          {
            headers: { ...headers, "content-type": "text/xml; charset=utf-8" },
          },
        )
      : new Response(null, { status: 204, headers });
  } catch (error) {
    if (error instanceof TwilioWebhookError)
      return Response.json(
        { error: error.code },
        { status: error.status, headers },
      );
    // Provider retries recover transient database failures; never log payloads,
    // tokens, message bodies, phone numbers or signature material.
    console.error(JSON.stringify({ event: "sms_webhook_unavailable" }));
    return Response.json({ error: "unavailable" }, { status: 503, headers });
  }
}
