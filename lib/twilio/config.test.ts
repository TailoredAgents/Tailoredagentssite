import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  getTwilioConfiguration,
  getTwilioPublicConfiguration,
  smsStatusCallbackUrl,
} from "./config";

const environment = {
  TWILIO_ACCOUNT_SID: "AC" + "a".repeat(32),
  TWILIO_AUTH_TOKEN: "b".repeat(32),
  TWILIO_API_KEY_SID: "SK" + "c".repeat(32),
  TWILIO_API_KEY_SECRET: "d".repeat(32),
  TWILIO_PHONE_NUMBER: "+15555550123",
  BETTER_AUTH_URL: "https://agency.example.test",
  NODE_ENV: "production",
};
describe("Twilio server configuration", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("requires every credential and an explicit valid public origin", () => {
    expect(getTwilioConfiguration({})).toMatchObject({
      ready: false,
      enabled: false,
    });
    for (const key of Object.keys(environment)) {
      if (key === "NODE_ENV") continue;
      const partial = { ...environment, [key]: "" };
      expect(getTwilioConfiguration(partial).missing).toContain(key);
    }
    expect(
      getTwilioConfiguration({ ...environment, TWILIO_SMS_ENABLED: "true" }),
    ).toMatchObject({ ready: true, enabled: true });
    expect(getTwilioConfiguration(environment)).toMatchObject({
      ready: true,
      enabled: false,
    });
    expect(
      getTwilioConfiguration({ ...environment, TWILIO_SMS_ENABLED: "TRUE" }),
    ).toMatchObject({ enabled: false });
  });
  it("keeps authenticated webhooks available while REST credentials rotate", () => {
    expect(
      getTwilioConfiguration({
        ...environment,
        TWILIO_API_KEY_SID: "",
        TWILIO_API_KEY_SECRET: "",
      }),
    ).toMatchObject({ ready: false, enabled: false, webhookReady: true });
    expect(
      getTwilioConfiguration({ ...environment, TWILIO_AUTH_TOKEN: "" }),
    ).toMatchObject({ ready: false, enabled: false, webhookReady: false });
  });
  it("rejects credentials and URLs that would make callbacks ambiguous", () => {
    for (const value of [
      "http://agency.example.test",
      "https://user:pass@agency.example.test",
      "https://agency.example.test/path",
      "https://agency.example.test?query=1",
      "https://agency.example.test/#frag",
      "javascript:alert(1)",
    ]) {
      expect(
        getTwilioConfiguration({ ...environment, BETTER_AUTH_URL: value })
          .missing,
      ).toContain("BETTER_AUTH_URL");
    }
    expect(
      getTwilioConfiguration({
        ...environment,
        NODE_ENV: "development",
        BETTER_AUTH_URL: "http://localhost:3121",
      }).ready,
    ).toBe(true);
    expect(
      getTwilioConfiguration({
        ...environment,
        NODE_ENV: "development",
        BETTER_AUTH_URL: "http://untrusted.example.test",
      }).ready,
    ).toBe(false);
    expect(
      getTwilioConfiguration({
        ...environment,
        TWILIO_PHONE_NUMBER: "whatsapp:+15555550123",
      }).ready,
    ).toBe(false);
    expect(
      getTwilioConfiguration({
        ...environment,
        TWILIO_ACCOUNT_SID: "SK" + "a".repeat(32),
      }).ready,
    ).toBe(false);
  });
  it("only projects safe setup data and derives attempt callbacks from the trusted origin", () => {
    for (const [key, value] of Object.entries(environment))
      vi.stubEnv(key, value);
    vi.stubEnv("TWILIO_SMS_ENABLED", "true");
    const publicData = getTwilioPublicConfiguration();
    expect(publicData).toMatchObject({
      ready: true,
      enabled: true,
      phoneNumber: environment.TWILIO_PHONE_NUMBER,
      incomingUrl:
        "https://agency.example.test/api/integrations/twilio/sms/incoming",
    });
    expect(JSON.stringify(publicData)).not.toMatch(
      /bbbbbbbb|cccccccc|dddddddd|authToken|apiKeySecret|accountSid/,
    );
    expect(smsStatusCallbackUrl("00000000-0000-4000-8000-000000000123")).toBe(
      "https://agency.example.test/api/integrations/twilio/sms/status?attempt=00000000-0000-4000-8000-000000000123",
    );
    expect(() => smsStatusCallbackUrl("?attempt=evil")).toThrow();
  });
});
