import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const sdk = vi.hoisted(() => {
  const callFetch = vi.fn(),
    update = vi.fn(),
    recordFetch = vi.fn(),
    remove = vi.fn(),
    list = vi.fn();
  const calls = vi.fn(() => ({ fetch: callFetch, update })),
    recordings = vi.fn(() => ({ fetch: recordFetch, remove }));
  const constructor = vi.fn(() => ({
    calls,
    recordings,
    incomingPhoneNumbers: { list },
  }));
  return {
    callFetch,
    update,
    recordFetch,
    remove,
    list,
    calls,
    recordings,
    constructor,
  };
});
vi.mock("twilio", () => ({ default: sdk.constructor }));
import {
  deleteVoicemailMedia,
  endVoiceCall,
  fetchVoiceCall,
  fetchVoicemailMedia,
  fetchVoicemailRecording,
  lookupOwnedVoiceNumber,
  validMediaRange,
} from "./provider";
const account = "AC" + "a".repeat(32),
  key = "SK" + "c".repeat(32),
  secret = "d".repeat(32),
  sid = "CA" + "e".repeat(32),
  recordingSid = "RE" + "f".repeat(32),
  phone = "+15555550123",
  to = "+15555550456";
const reference = { recordingSid, callSid: sid };
const call = {
  sid,
  accountSid: account,
  parentCallSid: null,
  from: phone,
  to,
  status: "in-progress",
  direction: "outbound-dial",
  duration: "30",
  price: "SECRET_PRICE",
  uri: "SECRET_PROVIDER_URL",
};
const recording = {
  sid: recordingSid,
  accountSid: account,
  callSid: sid,
  source: "RecordVerb",
  channels: 1,
  duration: "30",
  status: "completed",
  mediaUrl: "https://evil.invalid/media.mp3",
};
describe("voice provider transport and private voicemail media", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const [keyName, value] of Object.entries({
      TWILIO_ACCOUNT_SID: account,
      TWILIO_AUTH_TOKEN: "b".repeat(32),
      TWILIO_API_KEY_SID: key,
      TWILIO_API_KEY_SECRET: secret,
      TWILIO_PHONE_NUMBER: phone,
      TWILIO_VOICE_APP_SID: "AP" + "0".repeat(32),
      TWILIO_VOICE_ENABLED: "true",
      BETTER_AUTH_URL: "https://agency.example.test",
      NODE_ENV: "production",
    }))
      vi.stubEnv(keyName, value);
    sdk.callFetch.mockResolvedValue(call);
    sdk.update.mockResolvedValue({ ...call, status: "completed" });
    sdk.recordFetch.mockResolvedValue(recording);
    sdk.remove.mockResolvedValue(true);
    sdk.list.mockResolvedValue([
      {
        sid: "PN" + "a".repeat(32),
        accountSid: account,
        phoneNumber: phone,
        capabilities: { voice: true },
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () =>
          new Response("synthetic audio", {
            headers: {
              "content-type": "audio/mpeg",
              "content-length": "15",
              "x-secret-provider-header": "secret",
            },
          }),
      ),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("reads exact provider resources using API keys, fixed timeout and no SDK mutation retries", async () => {
    expect(await lookupOwnedVoiceNumber(phone)).toEqual({
      accountSid: account,
      phone,
      providerSid: "PN" + "a".repeat(32),
      voiceEnabled: true,
    });
    const read = await fetchVoiceCall(sid);
    expect(read).toEqual({
      sid,
      accountSid: account,
      parentCallSid: null,
      from: phone,
      to,
      status: "in-progress",
      direction: "outbound-dial",
      duration: 30,
    });
    expect(JSON.stringify(read)).not.toMatch(/SECRET|price|uri/);
    expect(sdk.constructor).toHaveBeenCalledWith(key, secret, {
      accountSid: account,
      timeout: 15000,
      autoRetry: false,
      maxRetries: 0,
      logLevel: "error",
    });
    expect(sdk.calls).toHaveBeenCalledWith(sid);
    expect(sdk.update).not.toHaveBeenCalled();
    await expect(
      fetchVoiceCall("https://evil.invalid/call"),
    ).rejects.toMatchObject({ outcome: "rejected" });
    sdk.callFetch.mockResolvedValue({
      ...call,
      accountSid: "AC" + "9".repeat(32),
    });
    await expect(fetchVoiceCall(sid)).rejects.toMatchObject({
      outcome: "rejected",
    });
  });
  it("ends only an existing call, reconciles terminal state by read and classifies uncertain POST outcomes", async () => {
    expect((await endVoiceCall(sid)).status).toBe("completed");
    expect(sdk.update).toHaveBeenCalledExactlyOnceWith({ status: "completed" });
    sdk.update.mockClear();
    sdk.callFetch.mockResolvedValue({ ...call, status: "ringing" });
    sdk.update.mockResolvedValue({ ...call, status: "canceled" });
    await endVoiceCall(sid);
    expect(sdk.update).toHaveBeenCalledExactlyOnceWith({ status: "canceled" });
    sdk.update.mockClear();
    sdk.callFetch.mockResolvedValue({ ...call, status: "completed" });
    await endVoiceCall(sid);
    expect(sdk.update).not.toHaveBeenCalled();
    sdk.callFetch.mockResolvedValue(call);
    sdk.update.mockRejectedValue({ status: 503, message: "PRIVATE_DETAILS" });
    await expect(endVoiceCall(sid)).rejects.toMatchObject({
      outcome: "unknown",
    });
    expect(sdk.update).toHaveBeenCalledTimes(1);
    sdk.update.mockRejectedValue({ status: 403, message: "PRIVATE_DETAILS" });
    await expect(endVoiceCall(sid)).rejects.toMatchObject({
      outcome: "rejected",
    });
    sdk.update.mockResolvedValue({
      ...call,
      accountSid: "AC" + "9".repeat(32),
    });
    await expect(endVoiceCall(sid)).rejects.toMatchObject({
      outcome: "unknown",
    });
  });
  it("constructs one exact media URL after verifying call/account/RecordVerb and strips all private provider headers", async () => {
    expect(await fetchVoicemailRecording(reference)).toEqual({
      recordingSid,
      callSid: sid,
      status: "completed",
      duration: 30,
      channels: 1,
    });
    const audio = await fetchVoicemailMedia(reference);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      `https://api.twilio.com/2010-04-01/Accounts/${account}/Recordings/${recordingSid}.mp3`,
      expect.objectContaining({
        headers: {
          authorization:
            "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
        },
        redirect: "error",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(await audio.text()).toBe("synthetic audio");
    expect(audio.headers.get("content-type")).toBe("audio/mpeg");
    expect(audio.headers.get("cache-control")).toBe("private, no-store");
    expect(audio.headers.get("x-secret-provider-header")).toBeNull();
    expect(audio.headers.get("content-disposition")).toBe(
      'inline; filename="voicemail.mp3"',
    );
  });
  it.each([408, 500, 502, 503, 504, undefined])(
    "never retries an uncertain call-end POST after HTTP/network %s",
    async (status) => {
      sdk.update.mockRejectedValue({
        status,
        message: "PRIVATE_CREDENTIAL_AND_BODY",
      });
      await expect(endVoiceCall(sid)).rejects.toMatchObject({
        outcome: "unknown",
        message:
          "The provider has not confirmed this change. Refresh the existing call before trying again.",
      });
      expect(sdk.update).toHaveBeenCalledTimes(1);
    },
  );
  it("never fetches untrusted URLs or media from another account/call or a connected-call recording", async () => {
    for (const altered of [
      { accountSid: "AC" + "0".repeat(32) },
      { callSid: "CA" + "0".repeat(32) },
      { sid: "RE" + "0".repeat(32) },
      { source: "DialVerb" },
      { channels: 2 },
      { duration: "9999" },
      { status: "processing" },
    ]) {
      sdk.recordFetch.mockResolvedValue({ ...recording, ...altered });
      await expect(fetchVoicemailMedia(reference)).rejects.toMatchObject({
        outcome: "rejected",
      });
    }
    expect(fetch).not.toHaveBeenCalled();
    await expect(
      fetchVoicemailMedia({
        recordingSid: "https://evil.invalid",
        callSid: sid,
      }),
    ).rejects.toMatchObject({ outcome: "rejected" });
  });
  it("checks byte ranges and caps both declared and streaming media sizes", async () => {
    for (const range of [
      "bytes=0-1,2-3",
      "bytes=-0",
      "bytes=10-2",
      "bytes=99999999-",
      "items=0-1",
      "bytes=-",
    ])
      expect(() => validMediaRange(range)).toThrow();
    vi.mocked(fetch).mockResolvedValue(
      new Response("abc", {
        status: 206,
        headers: {
          "content-type": "audio/mpeg",
          "content-length": "3",
          "content-range": "bytes 0-2/15",
        },
      }),
    );
    const partial = await fetchVoicemailMedia(reference, {
      range: "bytes=0-2",
    });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe("bytes 0-2/15");
    expect(await partial.text()).toBe("abc");
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.headers).toMatchObject({
      range: "bytes=0-2",
    });
    for (const response of [
      new Response("x", {
        status: 302,
        headers: {
          location: "https://evil.invalid/media",
          "content-type": "audio/mpeg",
        },
      }),
      new Response("html", { headers: { "content-type": "text/html" } }),
      new Response("x", {
        headers: {
          "content-type": "audio/mpeg",
          "content-length": String(6 * 1024 * 1024),
        },
      }),
    ]) {
      vi.mocked(fetch).mockResolvedValue(response);
      await expect(fetchVoicemailMedia(reference)).rejects.toMatchObject({
        outcome: "rejected",
      });
    }
    vi.mocked(fetch).mockResolvedValue(
      new Response(new Uint8Array(5 * 1024 * 1024 + 1), {
        headers: { "content-type": "audio/mpeg" },
      }),
    );
    const large = await fetchVoicemailMedia(reference);
    await expect(large.arrayBuffer()).rejects.toThrow(/size limit/);
  });
  it("marks deletion confirmed only on provider success or exact scoped404, never on timeout or false result", async () => {
    expect(await deleteVoicemailMedia(reference)).toEqual({ deleted: true });
    expect(sdk.remove).toHaveBeenCalledTimes(1);
    sdk.recordFetch.mockResolvedValue({
      ...recording,
      status: "failed",
      duration: null,
      channels: null,
    });
    expect(await deleteVoicemailMedia(reference)).toEqual({ deleted: true });
    sdk.recordFetch.mockResolvedValue(recording);
    sdk.remove.mockResolvedValue(false);
    await expect(deleteVoicemailMedia(reference)).rejects.toMatchObject({
      outcome: "unknown",
    });
    sdk.remove.mockRejectedValue({ status: 503, message: "PRIVATE_DETAILS" });
    await expect(deleteVoicemailMedia(reference)).rejects.toMatchObject({
      outcome: "unknown",
    });
    sdk.recordFetch.mockRejectedValue({ status: 404 });
    sdk.remove.mockClear();
    expect(await deleteVoicemailMedia(reference)).toEqual({ deleted: true });
    expect(sdk.remove).not.toHaveBeenCalled();
    sdk.recordFetch.mockResolvedValue({ ...recording, source: "DialVerb" });
    await expect(deleteVoicemailMedia(reference)).rejects.toMatchObject({
      outcome: "rejected",
    });
    expect(sdk.remove).not.toHaveBeenCalled();
  });
});
