import "server-only";
import twilio from "twilio";
import {
  E164_PHONE,
  TWILIO_MESSAGE_SID,
  getTwilioConfiguration,
  smsStatusCallbackUrl,
} from "./config";

export class TwilioProviderError extends Error {
  constructor(
    readonly outcome: "rejected" | "unknown",
    message: string,
    readonly providerCode?: number,
  ) {
    super(message);
  }
}
export type TwilioSmsResult = {
  sid: string;
  status: string;
  accountSid: string;
  from: string;
  to: string;
};

function client() {
  const config = getTwilioConfiguration();
  if (!config.ready)
    throw new TwilioProviderError(
      "rejected",
      "Twilio SMS is not connected. Ask an administrator to complete the connection.",
    );
  // API keys authenticate REST requests. The separate account Auth Token is
  // retained only for validating signed webhooks. Never automatically retry a
  // message-creation POST: a timeout can happen after Twilio accepted it.
  return {
    config,
    api: twilio(config.apiKeySid, config.apiKeySecret, {
      accountSid: config.accountSid,
      timeout: 15_000,
      autoRetry: false,
      maxRetries: 0,
      logLevel: "error",
    }),
  };
}
function safeProviderError(
  error: unknown,
  creating = false,
): TwilioProviderError {
  if (error instanceof TwilioProviderError) return error;
  const details =
    error && typeof error === "object"
      ? (error as { status?: unknown; code?: unknown })
      : {};
  const status = typeof details.status === "number" ? details.status : 0;
  const code =
    typeof details.code === "number" && Number.isInteger(details.code)
      ? details.code
      : undefined;
  const rejected = status >= 400 && status < 500 && status !== 408;
  if (rejected)
    return new TwilioProviderError(
      "rejected",
      status === 429
        ? "Twilio is limiting requests. Wait before trying again."
        : "Twilio rejected this request. Review the number, sender approval and messaging settings.",
      code,
    );
  return new TwilioProviderError(
    creating ? "unknown" : "rejected",
    creating
      ? "Twilio has not confirmed whether it accepted this message. Keep the same send attempt while checking its status."
      : "Twilio could not be reached. Try again after checking the connection.",
    code,
  );
}
function normalized(
  result: {
    sid: string;
    status: string;
    accountSid: string;
    from: string;
    to: string;
  },
  expectedAccount: string,
  creating = false,
): TwilioSmsResult {
  if (
    !TWILIO_MESSAGE_SID.test(result.sid) ||
    result.accountSid !== expectedAccount ||
    !E164_PHONE.test(result.from) ||
    !E164_PHONE.test(result.to) ||
    !/^[a-z_]{1,32}$/.test(result.status)
  )
    throw new TwilioProviderError(
      creating ? "unknown" : "rejected",
      "Twilio returned a message that could not be safely verified.",
    );
  return {
    sid: result.sid,
    status: result.status,
    accountSid: result.accountSid,
    from: result.from,
    to: result.to,
  };
}

/** Read-only ownership/capability check. Never provisions or updates a number. */
export async function lookupOwnedNumber(
  phone: string,
): Promise<{
  accountSid: string;
  phone: string;
  providerSid: string;
  smsEnabled: boolean;
}> {
  if (!E164_PHONE.test(phone))
    throw new TwilioProviderError(
      "rejected",
      "Enter a phone number in international format.",
    );
  const { api, config } = client();
  try {
    const results = await api.incomingPhoneNumbers.list({
      phoneNumber: phone,
      limit: 2,
    });
    const match = results.find(
      (number) =>
        number.phoneNumber === phone &&
        number.accountSid === config.accountSid &&
        /^PN[0-9a-f]{32}$/i.test(number.sid),
    );
    if (!match)
      throw new TwilioProviderError(
        "rejected",
        "This number could not be verified in the configured Twilio account.",
      );
    return {
      accountSid: match.accountSid,
      phone: match.phoneNumber,
      providerSid: match.sid,
      smsEnabled: match.capabilities.sms === true,
    };
  } catch (error) {
    throw safeProviderError(error);
  }
}

export async function createSms(input: {
  from: string;
  to: string;
  text: string;
  attemptId: string;
  statusCallback?: string;
}): Promise<TwilioSmsResult> {
  const { api, config } = client();
  if (!config.enabled)
    throw new TwilioProviderError(
      "rejected",
      "SMS sending is paused. An administrator must enable it after setup is verified.",
    );
  if (
    !E164_PHONE.test(input.from) ||
    input.from !== config.phoneNumber ||
    !E164_PHONE.test(input.to) ||
    !input.text.trim() ||
    input.text.length > 1600
  ) {
    throw new TwilioProviderError(
      "rejected",
      "Choose the configured sender, a valid recipient and a message of 1–1,600 characters.",
    );
  }
  let statusCallback: string;
  try {
    statusCallback = smsStatusCallbackUrl(input.attemptId);
  } catch {
    throw new TwilioProviderError(
      "rejected",
      "A valid SMS send attempt is required.",
    );
  }
  if (
    input.statusCallback !== undefined &&
    input.statusCallback !== statusCallback
  )
    throw new TwilioProviderError(
      "rejected",
      "The SMS delivery callback is not valid.",
    );
  try {
    const result = normalized(
      await api.messages.create({
        from: input.from,
        to: input.to,
        body: input.text,
        statusCallback,
      }),
      config.accountSid,
      true,
    );
    if (result.from !== input.from || result.to !== input.to)
      throw new TwilioProviderError(
        "unknown",
        "Twilio returned a message with unexpected participants. Check this send attempt before trying again.",
      );
    return result;
  } catch (error) {
    throw safeProviderError(error, true);
  }
}

export async function fetchSms(sid: string): Promise<TwilioSmsResult> {
  if (!TWILIO_MESSAGE_SID.test(sid))
    throw new TwilioProviderError("rejected", "Choose a valid SMS message.");
  const { api, config } = client();
  try {
    return normalized(await api.messages(sid).fetch(), config.accountSid);
  } catch (error) {
    throw safeProviderError(error);
  }
}
