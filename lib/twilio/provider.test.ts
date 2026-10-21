import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const sdk = vi.hoisted(() => {
  const create = vi.fn(),
    fetch = vi.fn(),
    list = vi.fn();
  const messages = Object.assign(
    vi.fn(() => ({ fetch })),
    { create },
  );
  const constructor = vi.fn(() => ({
    messages,
    incomingPhoneNumbers: { list },
  }));
  return { create, fetch, list, messages, constructor };
});
vi.mock("twilio", () => ({ default: sdk.constructor }));
import { createSms, fetchSms, lookupOwnedNumber } from "./provider";

const accountSid = "AC" + "a".repeat(32),
  apiKeySid = "SK" + "c".repeat(32),
  phone = "+15555550123",
  to = "+15555550456",
  sid = "SM" + "e".repeat(32);
const input = {
  from: phone,
  to,
  text: "A reviewed SMS.",
  attemptId: "00000000-0000-4000-8000-000000000123",
};
const result = {
  sid,
  status: "queued",
  accountSid,
  from: phone,
  to,
  body: "MUST_NOT_LEAK",
  price: "0.0075",
};
describe("Twilio SMS transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const [key, value] of Object.entries({
      TWILIO_ACCOUNT_SID: accountSid,
      TWILIO_AUTH_TOKEN: "b".repeat(32),
      TWILIO_API_KEY_SID: apiKeySid,
      TWILIO_API_KEY_SECRET: "d".repeat(32),
      TWILIO_PHONE_NUMBER: phone,
      TWILIO_SMS_ENABLED: "true",
      BETTER_AUTH_URL: "https://agency.example.test",
      NODE_ENV: "production",
    }))
      vi.stubEnv(key, value);
    sdk.create.mockResolvedValue(result);
    sdk.fetch.mockResolvedValue(result);
    sdk.list.mockResolvedValue([
      {
        sid: "PN" + "f".repeat(32),
        accountSid,
        phoneNumber: phone,
        capabilities: { sms: true },
      },
    ]);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("uses API-key credentials, bounded timeouts and disables automatic POST retries", async () => {
    expect(await createSms(input)).toEqual({
      sid,
      status: "queued",
      accountSid,
      from: phone,
      to,
    });
    expect(sdk.constructor).toHaveBeenCalledWith(apiKeySid, "d".repeat(32), {
      accountSid,
      timeout: 15000,
      autoRetry: false,
      maxRetries: 0,
      logLevel: "error",
    });
    expect(sdk.create).toHaveBeenCalledExactlyOnceWith({
      from: phone,
      to,
      body: input.text,
      statusCallback:
        "https://agency.example.test/api/integrations/twilio/sms/status?attempt=" +
        input.attemptId,
    });
    expect(sdk.create.mock.calls[0][0]).not.toHaveProperty("idempotencyKey");
  });
  it("never creates a message while paused or with forged sender, recipient or callback", async () => {
    vi.stubEnv("TWILIO_SMS_ENABLED", "false");
    await expect(createSms(input)).rejects.toMatchObject({
      outcome: "rejected",
    });
    vi.stubEnv("TWILIO_SMS_ENABLED", "true");
    for (const altered of [
      { from: "+15555550999" },
      { to: "whatsapp:" + to },
      { text: "x".repeat(1601) },
      { attemptId: "unbound" },
      { statusCallback: "https://evil.example.test/callback" },
    ])
      await expect(createSms({ ...input, ...altered })).rejects.toMatchObject({
        outcome: "rejected",
      });
    expect(sdk.create).not.toHaveBeenCalled();
  });
  it("checks number ownership and capability without provisioning or changing a number", async () => {
    vi.stubEnv("TWILIO_SMS_ENABLED", "false");
    expect(await lookupOwnedNumber(phone)).toEqual({
      accountSid,
      phone,
      providerSid: "PN" + "f".repeat(32),
      smsEnabled: true,
    });
    expect(sdk.list).toHaveBeenCalledExactlyOnceWith({
      phoneNumber: phone,
      limit: 2,
    });
    sdk.list.mockResolvedValue([
      {
        sid: "PN" + "f".repeat(32),
        accountSid: "AC" + "0".repeat(32),
        phoneNumber: phone,
        capabilities: { sms: true },
      },
    ]);
    await expect(lookupOwnedNumber(phone)).rejects.toMatchObject({
      outcome: "rejected",
    });
    sdk.list.mockResolvedValue([
      {
        sid: "PN" + "f".repeat(32),
        accountSid,
        phoneNumber: phone,
        capabilities: { sms: false },
      },
    ]);
    expect((await lookupOwnedNumber(phone)).smsEnabled).toBe(false);
    expect(sdk.create).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 404, 422, 429])(
    "classifies definitive HTTP %s rejection without leaking provider details",
    async (status) => {
      sdk.create.mockRejectedValue({
        status,
        code: 21610,
        message: "private body credential 123",
      });
      await expect(createSms(input)).rejects.toMatchObject({
        outcome: "rejected",
        providerCode: 21610,
      });
      await expect(createSms(input)).rejects.not.toThrow(
        /private body credential/,
      );
      expect(sdk.create).toHaveBeenCalledTimes(2);
    },
  );
  it.each([408, 500, 502, 503, 504, undefined])(
    "treats HTTP/network %s create failures as uncertain and sends only once",
    async (status) => {
      sdk.create.mockRejectedValue({
        status,
        code: "ETIMEDOUT",
        message: "secrets",
      });
      await expect(createSms(input)).rejects.toMatchObject({
        outcome: "unknown",
      });
      expect(sdk.create).toHaveBeenCalledTimes(1);
    },
  );
  it("fails uncertain on an accepted POST with unexpected identity instead of resending", async () => {
    sdk.create.mockResolvedValue({ ...result, to: "+15555550999" });
    await expect(createSms(input)).rejects.toMatchObject({
      outcome: "unknown",
    });
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });
  it("fetches only one exact SMS resource and projects no content or credentials", async () => {
    const fetched = await fetchSms(sid);
    expect(sdk.messages).toHaveBeenCalledWith(sid);
    expect(sdk.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(fetched)).not.toMatch(/MUST_NOT_LEAK|price/);
    await expect(
      fetchSms("https://evil.example.test/message"),
    ).rejects.toMatchObject({ outcome: "rejected" });
    sdk.fetch.mockResolvedValue({ ...result, from: "whatsapp:" + phone });
    await expect(fetchSms(sid)).rejects.toMatchObject({ outcome: "rejected" });
  });
});
