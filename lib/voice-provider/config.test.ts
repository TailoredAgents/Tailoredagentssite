import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
vi.mock("server-only", () => ({}));
import {
  getVoiceConfiguration,
  getVoicePublicConfiguration,
  voiceCallbackUrl,
} from "./config";
import { createVoiceAccessToken, voiceIdentity } from "./token";
const environment = {
  TWILIO_ACCOUNT_SID: "AC" + "a".repeat(32),
  TWILIO_AUTH_TOKEN: "b".repeat(32),
  TWILIO_API_KEY_SID: "SK" + "c".repeat(32),
  TWILIO_API_KEY_SECRET: "d".repeat(32),
  TWILIO_PHONE_NUMBER: "+15555550123",
  TWILIO_VOICE_APP_SID: "AP" + "e".repeat(32),
  TWILIO_VOICE_ENABLED: "true",
  BETTER_AUTH_URL: "https://agency.example.test",
  NODE_ENV: "production",
};
describe("voice server configuration and browser capabilities", () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(environment))
      vi.stubEnv(key, value);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("requires a separate explicit voice gate and app while callback verification survives key rotation", () => {
    expect(getVoiceConfiguration(environment)).toMatchObject({
      ready: true,
      enabled: true,
      restReady: true,
      webhookReady: true,
    });
    expect(
      getVoiceConfiguration({
        ...environment,
        TWILIO_VOICE_ENABLED: "false",
        TWILIO_SMS_ENABLED: "true",
      }),
    ).toMatchObject({ ready: true, enabled: false });
    expect(
      getVoiceConfiguration({ ...environment, TWILIO_VOICE_APP_SID: "" }),
    ).toMatchObject({
      ready: false,
      enabled: false,
      restReady: true,
      webhookReady: true,
      missing: ["TWILIO_VOICE_APP_SID"],
    });
    expect(
      getVoiceConfiguration({
        ...environment,
        TWILIO_API_KEY_SID: "",
        TWILIO_API_KEY_SECRET: "",
      }),
    ).toMatchObject({ ready: false, restReady: false, webhookReady: true });
    expect(
      getVoiceConfiguration({ ...environment, TWILIO_AUTH_TOKEN: "" })
        .webhookReady,
    ).toBe(false);
  });
  it("rejects untrusted origins and exposes no credentials in public status", () => {
    for (const url of [
      "https://user:pass@agency.example.test",
      "http://agency.example.test",
      "https://agency.example.test/path",
      "https://agency.example.test?x=1",
    ])
      expect(
        getVoiceConfiguration({ ...environment, BETTER_AUTH_URL: url }).ready,
      ).toBe(false);
    expect(
      getVoiceConfiguration({
        ...environment,
        NODE_ENV: "development",
        BETTER_AUTH_URL: "http://localhost:3131",
      }).ready,
    ).toBe(true);
    const safe = getVoicePublicConfiguration();
    expect(safe.urls.incoming).toBe(
      environment.BETTER_AUTH_URL + "/api/integrations/twilio/voice/incoming",
    );
    expect(JSON.stringify(safe)).not.toMatch(
      /bbbbbbbb|cccccccc|dddddddd|accountSid|appSid|apiKey/,
    );
    expect(
      voiceCallbackUrl("status", {
        callId: "00000000-0000-4000-8000-000000000123",
        leg: "staff",
      }),
    ).toBe(
      environment.BETTER_AUTH_URL +
        "/api/integrations/twilio/voice/status?call=00000000-0000-4000-8000-000000000123&leg=staff",
    );
    expect(() =>
      voiceCallbackUrl("dial", { callId: "https://evil.test" }),
    ).toThrow();
  });
  it("derives stable opaque workspace-specific identities and five-minute least-privilege SDK tokens", () => {
    const identity = voiceIdentity("workspace-a", "user-a");
    expect(identity).toMatch(/^ta_[0-9a-f]{48}$/);
    expect(identity).toBe(voiceIdentity("workspace-a", "user-a"));
    expect(identity).not.toBe(voiceIdentity("workspace-b", "user-a"));
    const result = createVoiceAccessToken(identity, { canReceive: true });
    const [header, payload, signature] = result.token.split(".");
    expect(signature).toBe(
      createHmac("sha256", environment.TWILIO_API_KEY_SECRET)
        .update(header + "." + payload)
        .digest("base64url"),
    );
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims.exp - claims.iat).toBe(300);
    expect(claims).toMatchObject({
      iss: environment.TWILIO_API_KEY_SID,
      sub: environment.TWILIO_ACCOUNT_SID,
      grants: {
        identity,
        voice: {
          incoming: { allow: true },
          outgoing: { application_sid: environment.TWILIO_VOICE_APP_SID },
        },
      },
    });
    expect(result.expiresAt).toBe(new Date(claims.exp * 1000).toISOString());
    expect(
      JSON.parse(
        Buffer.from(
          createVoiceAccessToken(identity).token.split(".")[1],
          "base64url",
        ).toString(),
      ).grants.voice.incoming,
    ).toBeUndefined();
    vi.stubEnv("TWILIO_VOICE_ENABLED", "false");
    expect(() => createVoiceAccessToken(identity)).toThrow();
    vi.stubEnv("TWILIO_VOICE_ENABLED", "true");
    expect(() => createVoiceAccessToken("client:forged")).toThrow();
  });
});
