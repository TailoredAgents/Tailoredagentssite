import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import twilio from "twilio";
import { z } from "zod";
vi.mock("server-only", () => ({}));
const handlers = vi.hoisted(() => ({ incoming: vi.fn(), status: vi.fn() }));
vi.mock("@/lib/sms/service", () => ({
  receiveSmsWebhook: handlers.incoming,
  receiveSmsStatus: handlers.status,
  SmsInputError: class SmsInputError extends Error {},
}));
vi.mock("@/lib/sms/data", () => ({
  SmsAccessError: class SmsAccessError extends Error {},
}));
import { SmsInputError } from "@/lib/sms/service";
import { SmsAccessError } from "@/lib/sms/data";
import { POST as incoming } from "@/app/api/integrations/twilio/sms/incoming/route";
import { POST as status } from "@/app/api/integrations/twilio/sms/status/route";

const accountSid = "AC" + "a".repeat(32),
  authToken = "b".repeat(32),
  origin = "https://agency.example.test",
  attempt = "00000000-0000-4000-8000-000000000123";
const params = {
  AccountSid: accountSid,
  MessageSid: "SM" + "e".repeat(32),
  From: "+15555550456",
  To: "+15555550123",
  Body: "STOP",
  MessageStatus: "received",
};
const request = (kind: "incoming" | "status", signature?: string) => {
  const url =
    origin +
    "/api/integrations/twilio/sms/" +
    kind +
    (kind === "status" ? "?attempt=" + attempt : "");
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature":
        signature ?? twilio.getExpectedTwilioSignature(authToken, url, params),
    },
    body: new URLSearchParams(params),
  });
};
describe("Twilio webhook route boundaries", () => {
  beforeEach(() => {
    handlers.incoming.mockReset().mockResolvedValue({});
    handlers.status.mockReset().mockResolvedValue({});
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
    vi.restoreAllMocks();
  });
  it("passes no unauthenticated payload to either database receiver", async () => {
    expect((await incoming(request("incoming", "invalid"))).status).toBe(401);
    expect((await status(request("status", "invalid"))).status).toBe(401);
    expect(handlers.incoming).not.toHaveBeenCalled();
    expect(handlers.status).not.toHaveBeenCalled();
  });
  it("routes the signed callback attempt exactly and sends empty incoming TwiML", async () => {
    const received = await incoming(request("incoming"));
    expect(received.status).toBe(200);
    expect(await received.text()).not.toContain("<Message>");
    expect((await status(request("status"))).status).toBe(204);
    expect(handlers.incoming).toHaveBeenCalledExactlyOnceWith(params);
    expect(handlers.status).toHaveBeenCalledExactlyOnceWith(attempt, params);
  });
  it.each(["incoming", "status"] as const)(
    "returns permanent %s input/permission errors without leaking details",
    async (kind) => {
      const handler = kind === "incoming" ? incoming : status,
        mock = handlers[kind];
      mock.mockRejectedValueOnce(new SmsInputError("PRIVATE input"));
      let response = await handler(request(kind));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_message" });
      mock.mockRejectedValueOnce(new SmsAccessError("PRIVATE account"));
      response = await handler(request(kind));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "message_not_allowed" });
      const invalid = z.string().safeParse(123);
      if (invalid.success) throw new Error("fixture");
      mock.mockRejectedValueOnce(invalid.error);
      response = await handler(request(kind));
      expect(response.status).toBe(400);
    },
  );
  it("keeps genuine database failures retryable and emits only a fixed operational event", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    handlers.incoming.mockRejectedValue(new Error("PRIVATE credentials/body"));
    const response = await incoming(request("incoming"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
    expect(JSON.stringify(log.mock.calls)).toBe(
      JSON.stringify([[JSON.stringify({ event: "sms_webhook_unavailable" })]]),
    );
  });
});
