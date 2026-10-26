import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import twilio from "twilio";
vi.mock("server-only", () => ({}));
import { validateVoiceWebhook, handleVoiceWebhook } from "./webhook";
import { VOICE_PATHS } from "./config";
const origin = "https://agency.example.test",
  account = "AC" + "a".repeat(32),
  auth = "b".repeat(32),
  callSid = "CA" + "f".repeat(32),
  callId = "00000000-0000-4000-8000-000000000123",
  identity = "ta_" + "e".repeat(48);
const incoming = {
  AccountSid: account,
  CallSid: callSid,
  From: "+15555550456",
  To: "+15555550123",
  FutureProviderParameter: "must-be-signed",
};
function signed(
  kind: keyof typeof VOICE_PATHS,
  params: Record<string, string> = incoming,
  query = "",
  extra: {
    body?: string;
    signatureOrigin?: string;
    urlOrigin?: string;
    headers?: Record<string, string>;
  } = {},
) {
  const path = VOICE_PATHS[kind] + query;
  return new Request((extra.urlOrigin ?? origin) + path, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": twilio.getExpectedTwilioSignature(
        auth,
        (extra.signatureOrigin ?? origin) + path,
        params,
      ),
      ...extra.headers,
    },
    body: extra.body ?? new URLSearchParams(params).toString(),
  });
}
describe("signed voice callbacks", () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries({
      TWILIO_ACCOUNT_SID: account,
      TWILIO_AUTH_TOKEN: auth,
      TWILIO_API_KEY_SID: "SK" + "c".repeat(32),
      TWILIO_API_KEY_SECRET: "d".repeat(32),
      TWILIO_PHONE_NUMBER: incoming.To,
      TWILIO_VOICE_APP_SID: "AP" + "e".repeat(32),
      TWILIO_VOICE_ENABLED: "true",
      BETTER_AUTH_URL: origin,
      NODE_ENV: "production",
    }))
      vi.stubEnv(key, value);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("binds signed forwarding screens and digit acceptance to the call",async()=>{
    for(const kind of ["forwardAnswer","forwardAccept","callbackAnswer","callbackAccept"] as const) {
      const p={...incoming,Digits:"1"};
      expect((await validateVoiceWebhook(signed(kind,p,`?call=${callId}`),kind)).context.callId).toBe(callId);
      await expect(validateVoiceWebhook(signed(kind,p),kind)).rejects.toThrow();
      await expect(validateVoiceWebhook(signed(kind,p,`?call=${callId}`,{body:new URLSearchParams({...p,Digits:"2"}).toString()}),kind)).rejects.toThrow();
    }
  });
  it("authenticates every unknown field with the exact configured URL and ignores forged proxy origins", async () => {
    expect(
      (await validateVoiceWebhook(signed("incoming"), "incoming")).params
        .FutureProviderParameter,
    ).toBe("must-be-signed");
    await expect(
      validateVoiceWebhook(
        signed("incoming", incoming, "", {
          body: new URLSearchParams({
            ...incoming,
            FutureProviderParameter: "tampered",
          }).toString(),
        }),
        "incoming",
      ),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      validateVoiceWebhook(
        signed("incoming", incoming, "", {
          signatureOrigin: "https://evil.example.test",
          headers: {
            "x-forwarded-host": "evil.example.test",
            "x-forwarded-proto": "https",
          },
        }),
        "incoming",
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(
      (
        await validateVoiceWebhook(
          signed("incoming", incoming, "", {
            urlOrigin: "http://internal-proxy:3000",
          }),
          "incoming",
        )
      ).params.CallSid,
    ).toBe(callSid);
  });
  it("binds exact callback IDs and legs and rejects query tampering/duplicates/unknown keys", async () => {
    const query = "?call=" + callId + "&leg=staff";
    expect(
      (await validateVoiceWebhook(signed("status", incoming, query), "status"))
        .context,
    ).toEqual({ callId, leg: "staff" });
    for (const bad of [
      "?call=" + callId + "&call=" + callId,
      "?call=" + callId + "&redirect=https://evil.test",
      "?call=nope",
      "?leg=staff",
      "?user=actor",
    ])
      await expect(
        validateVoiceWebhook(signed("status", incoming, bad), "status"),
      ).rejects.toMatchObject({ status: 400 });
    const request = signed("status", incoming, query);
    const changed = new Request(
      origin +
        VOICE_PATHS.status +
        "?call=00000000-0000-4000-8000-000000000999&leg=staff",
      request,
    );
    await expect(validateVoiceWebhook(changed, "status")).rejects.toMatchObject(
      { status: 401 },
    );
    await expect(
      validateVoiceWebhook(
        signed("incoming", incoming, "?call=" + callId),
        "incoming",
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("accepts a signed SDK parent completion with a blank destination without weakening incoming routing", async () => {
    const parent = {
      ...incoming,
      From: "client:" + identity,
      To: "",
      CallStatus: "completed",
    };
    expect(
      (await validateVoiceWebhook(signed("status", parent), "status")).params
        .To,
    ).toBe("");
    await expect(
      validateVoiceWebhook(
        signed("incoming", { ...incoming, To: "" }),
        "incoming",
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("rejects duplicate form keys, encoding ambiguity and bounded body/field overflow before service mutation", async () => {
    for (const body of [
      new URLSearchParams(incoming) + "&CallSid=" + callSid,
      new URLSearchParams({
        ...incoming,
        Padding: "x".repeat(4097),
      }).toString(),
      Array.from({ length: 129 }, (_, i) => "p" + i + "=v").join("&"),
    ])
      await expect(
        validateVoiceWebhook(
          signed("incoming", incoming, "", { body }),
          "incoming",
        ),
      ).rejects.toMatchObject({ status: 400 });
    await expect(
      validateVoiceWebhook(
        signed("incoming", incoming, "", { body: "x".repeat(65537) }),
        "incoming",
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      validateVoiceWebhook(
        signed("incoming", incoming, "", {
          headers: { "content-encoding": "gzip" },
        }),
        "incoming",
      ),
    ).rejects.toMatchObject({ status: 415 });
    const receive = vi.fn();
    const response = await handleVoiceWebhook(
      signed("incoming", incoming, "", {
        headers: { "x-twilio-signature": "invalid" },
      }),
      "incoming",
      receive,
    );
    expect(response.status).toBe(401);
    expect(receive).not.toHaveBeenCalled();
  });
  it("accepts only the configured account/number, a browser intent identity, and RecordVerb voicemail callbacks", async () => {
    for (const params of [
      { ...incoming, AccountSid: "AC" + "0".repeat(32) },
      { ...incoming, To: "+15555550999" },
      { ...incoming, From: "client:" + identity },
    ])
      await expect(
        validateVoiceWebhook(signed("incoming", params), "incoming"),
      ).rejects.toMatchObject({ status: 400 });
    expect(
      (
        await validateVoiceWebhook(
          signed("incoming", { ...incoming, From: "anonymous" }),
          "incoming",
        )
      ).params.From,
    ).toBe("anonymous");
    const outgoing = {
      ...incoming,
      From: "client:" + identity,
      IntentToken: callId + "." + "x".repeat(43),
      To: "untrusted-browser-destination",
    };
    expect(
      (await validateVoiceWebhook(signed("outbound", outgoing), "outbound"))
        .params.To,
    ).toBe("untrusted-browser-destination");
    await expect(
      validateVoiceWebhook(
        signed("outbound", { ...outgoing, IntentToken: "" }),
        "outbound",
      ),
    ).rejects.toMatchObject({ status: 400 });
    const recording = {
      AccountSid: account,
      CallSid: callSid,
      RecordingSid: "RE" + "a".repeat(32),
      RecordingStatus: "completed",
      RecordingSource: "RecordVerb",
      RecordingUrl: "https://untrusted.invalid/never-fetch",
    };
    expect(
      (
        await validateVoiceWebhook(
          signed("voicemail", recording, "?call=" + callId),
          "voicemail",
        )
      ).params.RecordingSid,
    ).toBe(recording.RecordingSid);
    await expect(
      validateVoiceWebhook(
        signed(
          "voicemail",
          { ...recording, RecordingSource: "DialVerb" },
          "?call=" + callId,
        ),
        "voicemail",
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      (
        await validateVoiceWebhook(
          signed("voicemailComplete", incoming, "?call=" + callId),
          "voicemailComplete",
        )
      ).params.RecordingSid,
    ).toBeUndefined();
  });
  it("keeps callbacks authenticated while calling is paused or REST credentials are unavailable", async () => {
    vi.stubEnv("TWILIO_VOICE_ENABLED", "false");
    vi.stubEnv("TWILIO_API_KEY_SID", "");
    vi.stubEnv("TWILIO_API_KEY_SECRET", "");
    vi.stubEnv("TWILIO_VOICE_APP_SID", "");
    const receive = vi.fn().mockResolvedValue(undefined);
    const response = await handleVoiceWebhook(
      signed("status", incoming),
      "status",
      receive,
    );
    expect(response.status).toBe(200);
    expect(receive).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    await expect(
      validateVoiceWebhook(signed("status"), "status"),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("signs each prebridge user binding and supports non-UUID stable actor IDs", async () => {
    const query = "?call=" + callId + "&user=actor%3A123";
    expect(
      (
        await validateVoiceWebhook(
          signed(
            "staffAnswer",
            { ...incoming, To: "client:" + identity, ParentCallSid: callSid },
            query,
          ),
          "staffAnswer",
        )
      ).context,
    ).toEqual({ callId, userId: "actor:123" });
    await expect(
      validateVoiceWebhook(
        signed("staffAnswer", incoming, "?call=" + callId),
        "staffAnswer",
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
