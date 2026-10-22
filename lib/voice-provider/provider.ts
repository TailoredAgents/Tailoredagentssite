import "server-only";
import twilio from "twilio";
import { E164_PHONE } from "@/lib/twilio/config";
import {
  CALL_SID,
  RECORDING_SID,
  VOICE_IDENTITY,
  getVoiceConfiguration,
} from "./config";

export class VoiceProviderError extends Error {
  constructor(
    readonly outcome: "rejected" | "unknown",
    message: string,
    readonly providerCode?: number,
  ) {
    super(message);
  }
}
const callStatuses = new Set([
  "queued",
  "ringing",
  "in-progress",
  "canceled",
  "completed",
  "busy",
  "no-answer",
  "failed",
]);
function client() {
  const config = getVoiceConfiguration();
  if (!config.restReady)
    throw new VoiceProviderError(
      "rejected",
      "The calling provider connection is incomplete.",
    );
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
function providerError(error: unknown, mutating = false) {
  if (error instanceof VoiceProviderError) return error;
  const info =
    error && typeof error === "object"
      ? (error as { status?: unknown; code?: unknown })
      : {};
  const status = typeof info.status === "number" ? info.status : 0;
  const code =
    typeof info.code === "number" && Number.isInteger(info.code)
      ? info.code
      : undefined;
  const definite = status >= 400 && status < 500 && status !== 408;
  return new VoiceProviderError(
    mutating && !definite ? "unknown" : "rejected",
    mutating && !definite
      ? "The provider has not confirmed this change. Refresh the existing call before trying again."
      : "The calling provider could not complete this request. Review its connection and try again.",
    code,
  );
}
export type VoiceCallResult = {
  sid: string;
  accountSid: string;
  parentCallSid: string | null;
  from: string;
  to: string;
  status: string;
  direction: string;
  duration: number | null;
};
function participant(value: string) {
  return (
    value === "" ||
    E164_PHONE.test(value) ||
    (value.startsWith("client:") && VOICE_IDENTITY.test(value.slice(7))) ||
    ["anonymous", "restricted", "unknown", "unavailable", "private"].includes(
      value.toLowerCase(),
    )
  );
}
function callResult(
  raw: {
    sid: string;
    accountSid: string;
    parentCallSid: string;
    from: string;
    to: string;
    status: string;
    direction: string;
    duration: string;
  },
  account: string,
  mutating = false,
): VoiceCallResult {
  const duration = /^\d{1,6}$/.test(raw.duration ?? "")
    ? Number(raw.duration)
    : null;
  if (
    !CALL_SID.test(raw.sid) ||
    raw.accountSid !== account ||
    (raw.parentCallSid && !CALL_SID.test(raw.parentCallSid)) ||
    !participant(raw.from) ||
    !participant(raw.to) ||
    !callStatuses.has(raw.status) ||
    !["inbound", "outbound-api", "outbound-dial"].includes(raw.direction) ||
    (duration !== null && duration > 86400)
  )
    throw new VoiceProviderError(
      mutating ? "unknown" : "rejected",
      "The provider call identity could not be verified.",
    );
  return {
    sid: raw.sid,
    accountSid: raw.accountSid,
    parentCallSid: raw.parentCallSid || null,
    from: raw.from,
    to: raw.to,
    status: raw.status,
    direction: raw.direction,
    duration,
  };
}
export async function lookupOwnedVoiceNumber(phone: string) {
  const { api, config } = client();
  if (!E164_PHONE.test(phone) || phone !== config.phoneNumber)
    throw new VoiceProviderError(
      "rejected",
      "Choose the configured business number.",
    );
  try {
    const found = (
      await api.incomingPhoneNumbers.list({ phoneNumber: phone, limit: 2 })
    ).find(
      (n) =>
        n.phoneNumber === phone &&
        n.accountSid === config.accountSid &&
        /^PN[0-9a-f]{32}$/i.test(n.sid),
    );
    if (!found)
      throw new VoiceProviderError(
        "rejected",
        "The business number could not be verified in this account.",
      );
    return {
      accountSid: found.accountSid,
      phone: found.phoneNumber,
      providerSid: found.sid,
      voiceEnabled: found.capabilities.voice === true,
    };
  } catch (error) {
    throw providerError(error);
  }
}
export const verifyVoiceNumber = lookupOwnedVoiceNumber;
export async function fetchVoiceCall(sid: string): Promise<VoiceCallResult> {
  if (!CALL_SID.test(sid))
    throw new VoiceProviderError("rejected", "Choose a valid call.");
  const { api, config } = client();
  try {
    const result = callResult(await api.calls(sid).fetch(), config.accountSid);
    if (result.sid !== sid)
      throw new VoiceProviderError(
        "rejected",
        "The provider returned a different call.",
      );
    return result;
  } catch (error) {
    throw providerError(error);
  }
}
/** Ends one already-authorized call; never creates or redirects a call. */
export async function endVoiceCall(sid: string): Promise<VoiceCallResult> {
  if (!CALL_SID.test(sid))
    throw new VoiceProviderError("rejected", "Choose a valid call.");
  const current = await fetchVoiceCall(sid);
  if (!["queued", "ringing", "in-progress"].includes(current.status))
    return current;
  const { api, config } = client();
  try {
    const result = callResult(
      await api.calls(sid).update({
        status: current.status === "in-progress" ? "completed" : "canceled",
      }),
      config.accountSid,
      true,
    );
    if (result.sid !== sid)
      throw new VoiceProviderError(
        "unknown",
        "The provider call change could not be verified.",
      );
    return result;
  } catch (error) {
    throw providerError(error, true);
  }
}
export type VoicemailReference = { recordingSid: string; callSid: string; kind?: "call" };
async function recording(reference: VoicemailReference) {
  if (
    !RECORDING_SID.test(reference.recordingSid) ||
    !CALL_SID.test(reference.callSid)
  )
    throw new VoiceProviderError("rejected", "Choose a valid voicemail.");
  const { api, config } = client();
  const raw = await api.recordings(reference.recordingSid).fetch();
  if (
    raw.sid !== reference.recordingSid ||
    raw.accountSid !== config.accountSid ||
    raw.callSid !== reference.callSid ||
    raw.source !== (reference.kind === "call" ? "DialVerb" : "RecordVerb") ||
    (raw.status === "completed"
      ? raw.channels !== (reference.kind === "call" ? 2 : 1) ||
        !/^\d{1,4}$/.test(raw.duration ?? "") ||
        Number(raw.duration) > (reference.kind === "call" ? 3610 : 185)
      : !["processing", "absent", "failed", "in-progress"].includes(raw.status))
  )
    throw new VoiceProviderError(
      "rejected",
      "The voicemail recording could not be verified.",
    );
  return { api, config, raw };
}
export async function fetchVoicemailRecording(reference: VoicemailReference) {
  try {
    const { raw } = await recording(reference);
    return {
      recordingSid: raw.sid,
      callSid: raw.callSid,
      status: raw.status,
      duration: /^\d{1,4}$/.test(raw.duration ?? "")
        ? Number(raw.duration)
        : null,
      channels: raw.channels,
    };
  } catch (error) {
    throw providerError(error);
  }
}
export async function deleteVoicemailMedia(
  reference: VoicemailReference,
): Promise<{ deleted: true }> {
  try {
    const { api } = await recording(reference);
    if ((await api.recordings(reference.recordingSid).remove()) !== true)
      throw new VoiceProviderError(
        "unknown",
        "The provider has not confirmed voicemail deletion.",
      );
    return { deleted: true };
  } catch (error) {
    // A scoped resource 404 confirms that this recording is already absent.
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404 &&
      RECORDING_SID.test(reference.recordingSid) &&
      CALL_SID.test(reference.callSid)
    )
      return { deleted: true };
    throw providerError(error, true);
  }
}
const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
export const MAX_CALL_MEDIA_BYTES = 64 * 1024 * 1024;
export function validMediaRange(value: string | null, maximum = MAX_MEDIA_BYTES) {
  if (value === null) return undefined;
  const match = /^bytes=(\d{1,8})?-(\d{1,8})?$/.exec(value);
  if (
    !match ||
    (!match[1] && !match[2]) ||
    (!match[1] && Number(match[2]) === 0) ||
    (match[1] && match[2] && Number(match[1]) > Number(match[2])) ||
    Number(match[1] ?? 0) >= maximum ||
    Number(match[2] ?? 0) > maximum
  )
    throw new VoiceProviderError(
      "rejected",
      "Choose a valid voicemail audio range.",
    );
  return value;
}
/** URLs and credentials stay server-side. The caller must verify live grants. */
export async function fetchVoicemailMedia(
  reference: VoicemailReference,
  input: { range?: string } = {},
): Promise<Response> {
  try {
    const { config, raw } = await recording(reference);
    if (raw.status !== "completed")
      throw new VoiceProviderError(
        "rejected",
        "The voicemail audio is not ready.",
      );
    const maximum = reference.kind === "call" ? MAX_CALL_MEDIA_BYTES : MAX_MEDIA_BYTES;
    const range = validMediaRange(input.range ?? null, maximum);
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Recordings/${reference.recordingSid}.mp3`,
      {
        headers: {
          authorization:
            "Basic " +
            Buffer.from(config.apiKeySid + ":" + config.apiKeySecret).toString(
              "base64",
            ),
          ...(range ? { range } : {}),
        },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    const type = response.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    const length = response.headers.get("content-length");
    const contentRange = response.headers.get("content-range");
    if (
      ![200, 206].includes(response.status) ||
      !["audio/mpeg", "audio/mp3"].includes(type ?? "") ||
      !response.body ||
      (length !== null &&
        (!/^\d+$/.test(length) || Number(length) > maximum)) ||
      (response.status === 206 &&
        (!range ||
          !contentRange ||
          !/^bytes \d+-\d+\/\d+$/.test(contentRange) ||
          Number(contentRange.split("/")[1]) > maximum))
    ) {
      await response.body?.cancel();
      throw new VoiceProviderError(
        "rejected",
        "The voicemail audio could not be safely retrieved.",
      );
    }
    let bytes = 0;
    const bounded = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          bytes += chunk.byteLength;
          if (bytes > maximum)
            throw new Error("Voicemail audio exceeds its size limit.");
          controller.enqueue(chunk);
        },
      }),
    );
    return new Response(bounded, {
      status: response.status,
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "content-disposition": reference.kind === "call" ? 'inline; filename="call.mp3"' : 'inline; filename="voicemail.mp3"',
        ...(length ? { "content-length": length } : {}),
        ...(response.status === 206 && contentRange
          ? { "content-range": contentRange, "accept-ranges": "bytes" }
          : {}),
      },
    });
  } catch (error) {
    throw providerError(error);
  }
}
export const fetchCallRecording = (ref: VoicemailReference) => fetchVoicemailRecording({ ...ref, kind: "call" });
export const fetchCallRecordingMedia = (ref: VoicemailReference, input: { range?: string } = {}) => fetchVoicemailMedia({ ...ref, kind: "call" }, input);
export const deleteCallRecordingMedia = (ref: VoicemailReference) => deleteVoicemailMedia({ ...ref, kind: "call" });
export async function findCallRecording(callSid: string) {
  await fetchVoiceCall(callSid);
  const {api,config}=client();
  try {
    const found=await api.recordings.list({callSid,limit:20});
    const matches=found.filter(r=>r.callSid===callSid && r.accountSid===config.accountSid && r.source==='DialVerb');
    if (matches.length>1) throw new VoiceProviderError("rejected","Multiple call recordings require review.");
    return matches[0]?fetchCallRecording({recordingSid:matches[0].sid,callSid}):null;
  } catch(error) { throw providerError(error); }
}
