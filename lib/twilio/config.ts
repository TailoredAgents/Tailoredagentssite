import "server-only";

export const E164_PHONE = /^\+[1-9]\d{7,14}$/;
export const TWILIO_ACCOUNT_SID = /^AC[0-9a-f]{32}$/i;
export const TWILIO_MESSAGE_SID = /^(SM|MM)[0-9a-f]{32}$/i;
export const SMS_INCOMING_PATH = "/api/integrations/twilio/sms/incoming";
export const SMS_STATUS_PATH = "/api/integrations/twilio/sms/status";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Environment = Partial<
  Record<
    | "TWILIO_ACCOUNT_SID"
    | "TWILIO_AUTH_TOKEN"
    | "TWILIO_API_KEY_SID"
    | "TWILIO_API_KEY_SECRET"
    | "TWILIO_PHONE_NUMBER"
    | "TWILIO_SMS_ENABLED"
    | "BETTER_AUTH_URL"
    | "NODE_ENV",
    string | undefined
  >
>;

/** Server-only credentials. Use the explicit public projection in page data. */
export function getTwilioConfiguration(environment: Environment = process.env) {
  const accountSid = environment.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = environment.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const apiKeySid = environment.TWILIO_API_KEY_SID?.trim() ?? "";
  const apiKeySecret = environment.TWILIO_API_KEY_SECRET?.trim() ?? "";
  const phoneNumber = environment.TWILIO_PHONE_NUMBER?.trim() ?? "";
  const missing: string[] = [];
  if (!TWILIO_ACCOUNT_SID.test(accountSid)) missing.push("TWILIO_ACCOUNT_SID");
  if (authToken.length < 32 || authToken.length > 256 || /\s/.test(authToken))
    missing.push("TWILIO_AUTH_TOKEN");
  if (!/^SK[0-9a-f]{32}$/i.test(apiKeySid)) missing.push("TWILIO_API_KEY_SID");
  if (
    apiKeySecret.length < 20 ||
    apiKeySecret.length > 256 ||
    /\s/.test(apiKeySecret)
  )
    missing.push("TWILIO_API_KEY_SECRET");
  if (!E164_PHONE.test(phoneNumber)) missing.push("TWILIO_PHONE_NUMBER");
  let baseUrl = "";
  try {
    const parsed = new URL(environment.BETTER_AUTH_URL ?? "");
    const local =
      environment.NODE_ENV !== "production" &&
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (
      (!local && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !["", "/"].includes(parsed.pathname)
    )
      throw new Error("invalid_origin");
    baseUrl = parsed.origin;
  } catch {
    missing.push("BETTER_AUTH_URL");
  }
  const ready = missing.length === 0;
  const webhookReady = missing.every(
    (key) => key === "TWILIO_API_KEY_SID" || key === "TWILIO_API_KEY_SECRET",
  );
  return {
    ready,
    webhookReady,
    enabled: ready && environment.TWILIO_SMS_ENABLED === "true",
    missing,
    accountSid,
    authToken,
    apiKeySid,
    apiKeySecret,
    phoneNumber,
    baseUrl,
    incomingUrl: baseUrl ? baseUrl + SMS_INCOMING_PATH : "",
    statusUrl: baseUrl ? baseUrl + SMS_STATUS_PATH : "",
  };
}

export function getTwilioPublicConfiguration() {
  const {
    ready,
    webhookReady,
    enabled,
    missing,
    phoneNumber,
    incomingUrl,
    statusUrl,
  } = getTwilioConfiguration();
  return {
    ready,
    webhookReady,
    enabled,
    missing,
    phoneNumber: E164_PHONE.test(phoneNumber) ? phoneNumber : "",
    incomingUrl,
    statusUrl,
    statusUrlTemplate: statusUrl ? statusUrl + "?attempt={attempt-id}" : "",
  };
}

export function smsStatusCallbackUrl(attemptId: string) {
  if (!UUID.test(attemptId))
    throw new Error("A valid SMS attempt ID is required.");
  const config = getTwilioConfiguration();
  if (!config.baseUrl)
    throw new Error("The SMS callback origin is not configured.");
  return `${config.statusUrl}?attempt=${attemptId}`;
}

export const isSmsAttemptId = (value: string) => UUID.test(value);
