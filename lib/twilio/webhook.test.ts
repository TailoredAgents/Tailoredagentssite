import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import twilio from "twilio";
vi.mock("server-only", () => ({}));
import { handleSmsWebhook, validateSmsWebhook } from "./webhook";

const accountSid = "AC" + "a".repeat(32),
  authToken = "b".repeat(32),
  origin = "https://agency.example.test";
const incoming = origin + "/api/integrations/twilio/sms/incoming",
  attempt = "00000000-0000-4000-8000-000000000123",
  status = origin + "/api/integrations/twilio/sms/status?attempt=" + attempt;
const params = {
  AccountSid: accountSid,
  MessageSid: "SM" + "e".repeat(32),
  From: "+15555550456",
  To: "+15555550123",
  Body: "A real-looking synthetic enquiry.",
  SmsStatus: "received",
};
function request(
  values: Record<string, string> = params,
  url = incoming,
  signedUrl = url,
  raw?: string,
  extraHeaders: Record<string, string> = {},
) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": twilio.getExpectedTwilioSignature(
        authToken,
        signedUrl,
        values,
      ),
      ...extraHeaders,
    },
    body: raw ?? new URLSearchParams(values).toString(),
  });
}
describe("Signed Twilio SMS webhooks", () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries({
      TWILIO_ACCOUNT_SID: accountSid,
      TWILIO_AUTH_TOKEN: authToken,
      TWILIO_API_KEY_SID: "SK" + "c".repeat(32),
      TWILIO_API_KEY_SECRET: "d".repeat(32),
      TWILIO_PHONE_NUMBER: params.To,
      TWILIO_SMS_ENABLED: "false",
      BETTER_AUTH_URL: origin,
      NODE_ENV: "production",
    }))
      vi.stubEnv(key, value);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it("uses the actual SDK signature calculation, including unknown fields and Unicode", async () => {
    const complete = {
      ...params,
      Body: "Hello ☀️ & café",
      FutureTwilioField: "signed value",
    };
    expect(
      (await validateSmsWebhook(request(complete), "incoming")).params,
    ).toEqual(complete);
    const unsigned = request(
      params,
      incoming,
      incoming,
      new URLSearchParams(complete).toString(),
    );
    await expect(
      validateSmsWebhook(unsigned, "incoming"),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("derives the canonical public origin from configuration and ignores proxy host claims", async () => {
    const internal =
      "http://127.0.0.1:3000/api/integrations/twilio/sms/incoming";
    const spoofed = {
      "x-forwarded-host": "evil.example.test",
      "x-forwarded-proto": "http",
      host: "evil.example.test",
    };
    await expect(
      validateSmsWebhook(
        request(params, internal, incoming, undefined, spoofed),
        "incoming",
      ),
    ).resolves.toHaveProperty("params.MessageSid", params.MessageSid);
    await expect(
      validateSmsWebhook(
        request(params, internal, internal, undefined, spoofed),
        "incoming",
      ),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      validateSmsWebhook(
        request(
          params,
          incoming,
          "https://evil.example.test/api/integrations/twilio/sms/incoming",
          undefined,
          spoofed,
        ),
        "incoming",
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("binds the status signature to the exact attempt query and rejects ambiguous URLs", async () => {
    const delivery = { ...params, MessageStatus: "delivered" };
    expect(
      (await validateSmsWebhook(request(delivery, status), "status")).attemptId,
    ).toBe(attempt);
    await expect(
      validateSmsWebhook(
        request(delivery, status.replace(/123$/, "124"), status),
        "status",
      ),
    ).rejects.toMatchObject({ status: 401 });
    for (const url of [
      status + "&attempt=" + attempt,
      status + "&other=value",
      status.replace("?attempt=" + attempt, ""),
      incoming + "?attempt=" + attempt,
    ]) {
      await expect(
        validateSmsWebhook(
          request(delivery, url),
          url.includes("/status") ? "status" : "incoming",
        ),
      ).rejects.toMatchObject({ status: 400 });
    }
  });
  it("rejects duplicate decoded form keys even when their values agree", async () => {
    for (const addition of [
      "&From=%2B15555550456",
      "&%41ccountSid=" + accountSid,
    ]) {
      await expect(
        validateSmsWebhook(
          request(
            params,
            incoming,
            incoming,
            new URLSearchParams(params) + addition,
          ),
          "incoming",
        ),
      ).rejects.toMatchObject({ status: 400 });
    }
  });
  it("enforces field count, per-field limits, media type and actual byte limits", async () => {
    const tooMany = {
      ...params,
      ...Object.fromEntries(
        Array.from({ length: 128 }, (_, i) => ["Field" + i, "value"]),
      ),
    };
    await expect(
      validateSmsWebhook(request(tooMany), "incoming"),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      validateSmsWebhook(
        request({ ...params, FutureTwilioField: "x".repeat(4097) }),
        "incoming",
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      validateSmsWebhook(
        request(params, incoming, incoming, undefined, {
          "content-type": "application/json",
        }),
        "incoming",
      ),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      validateSmsWebhook(
        request(params, incoming, incoming, undefined, {
          "content-length": "65537",
        }),
        "incoming",
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      validateSmsWebhook(
        request(params, incoming, incoming, "x=" + "x".repeat(65536)),
        "incoming",
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("rejects authenticated but wrong-account, non-SMS or conflicting-ID payloads", async () => {
    const changes: Record<string, string>[] = [
      { AccountSid: "AC" + "0".repeat(32) },
      { From: "whatsapp:" + params.From },
      { To: "whatsapp:" + params.To },
      { MessageSid: "CA" + "e".repeat(32) },
      { SmsSid: "SM" + "0".repeat(32) },
    ];
    for (const change of changes) {
      await expect(
        validateSmsWebhook(request({ ...params, ...change }), "incoming"),
      ).rejects.toMatchObject({ status: 400 });
    }
  });
  it("validates before mutation, returns empty TwiML and never fetches passed media URLs", async () => {
    const receive = vi.fn(async () => {}),
      fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const bad = await handleSmsWebhook(
      request(params, incoming, incoming, undefined, {
        "x-twilio-signature": "invalid",
      }),
      "incoming",
      receive,
    );
    expect(bad.status).toBe(401);
    expect(receive).not.toHaveBeenCalled();
    const values = {
      ...params,
      NumMedia: "1",
      MediaUrl0: "http://169.254.169.254/latest/meta-data",
    };
    const good = await handleSmsWebhook(request(values), "incoming", receive);
    expect(good.status).toBe(200);
    expect(await good.text()).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    );
    expect(receive).toHaveBeenCalledExactlyOnceWith(values, undefined);
    expect(fetch).not.toHaveBeenCalled();
    expect(good.headers.get("cache-control")).toContain("no-store");
  });
  it("accepts delivery reconciliation while sends are paused and returns retryable safe database failures", async () => {
    const receive = vi.fn(async () => {});
    expect(
      (await handleSmsWebhook(request(params, status), "status", receive))
        .status,
    ).toBe(204);
    expect(receive).toHaveBeenCalledExactlyOnceWith(params, attempt);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleSmsWebhook(request(), "incoming", async () => {
      throw new Error("PRIVATE database credential body");
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /PRIVATE|credential|enquiry|1555555/,
    );
  });
  it("accepts signed status subsets but does not invent missing participants", async () => {
    const subset = {
      AccountSid: accountSid,
      MessageSid: params.MessageSid,
      MessageStatus: "delivered",
    };
    expect(
      (await validateSmsWebhook(request(subset, status), "status")).params,
    ).toEqual(subset);
    await expect(
      validateSmsWebhook(
        request({ ...subset, From: "whatsapp:" + params.From }, status),
        "status",
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      validateSmsWebhook(
        request({ ...subset, ChannelPrefix: "whatsapp" }, status),
        "status",
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("still receives STOP during REST key rotation, but requires the account signing token", async () => {
    vi.stubEnv("TWILIO_API_KEY_SID", "");
    vi.stubEnv("TWILIO_API_KEY_SECRET", "");
    const receive = vi.fn(async () => {});
    expect(
      (
        await handleSmsWebhook(
          request({ ...params, Body: "STOP" }),
          "incoming",
          receive,
        )
      ).status,
    ).toBe(200);
    expect(receive).toHaveBeenCalledTimes(1);
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    expect(
      (
        await handleSmsWebhook(
          request({ ...params, Body: "STOP" }),
          "incoming",
          receive,
        )
      ).status,
    ).toBe(503);
    expect(receive).toHaveBeenCalledTimes(1);
  });
});
