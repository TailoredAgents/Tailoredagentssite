import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { inboundCallTwiml, outboundCallTwiml, voicemailTwiml } from "./twiml";
const callId = "00000000-0000-4000-8000-000000000123",
  identity = "ta_" + "f".repeat(48),
  origin = "https://agency.example.test";
describe("bounded voice TwiML", () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries({
      TWILIO_ACCOUNT_SID: "AC" + "a".repeat(32),
      TWILIO_AUTH_TOKEN: "b".repeat(32),
      TWILIO_API_KEY_SID: "SK" + "c".repeat(32),
      TWILIO_API_KEY_SECRET: "d".repeat(32),
      TWILIO_PHONE_NUMBER: "+15555550123",
      TWILIO_VOICE_APP_SID: "AP" + "e".repeat(32),
      TWILIO_VOICE_ENABLED: "true",
      BETTER_AUTH_URL: origin,
      NODE_ENV: "production",
    }))
      vi.stubEnv(key, value);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("dials only the authorized phone with fixed callbacks and explicit no connected-call recording", () => {
    const xml = outboundCallTwiml({
      callId,
      intentId: callId,
      from: "+15555550123",
      to: "+15555550456",
    });
    expect(xml).toContain('record="do-not-record"');
    expect(xml).toContain('timeout="25"');
    expect(xml).toContain('timeLimit="3600"');
    expect(xml).toContain(
      `<Number statusCallback="${origin}/api/integrations/twilio/voice/status?call=${callId}&amp;leg=customer"`,
    );
    expect(xml).toContain(">+15555550456</Number>");
    expect(xml).not.toMatch(/<Record|transcribe|recordingStatusCallback/);
    expect(() =>
      outboundCallTwiml({
        callId,
        intentId: callId,
        from: "+15555550999",
        to: "+15555550456",
      }),
    ).toThrow();
  });
  it("rings only approved distinct identities with signed per-user prebridge screens and minimal call context", () => {
    const xml = inboundCallTwiml({
      callId,
      targets: [{ identity, userId: "actor:123" }],
      voicemail: true,
      timeout: 60,
    });
    expect(xml).toContain(`<Identity>${identity}</Identity>`);
    expect(xml).toContain(`<Parameter name="CallId" value="${callId}"/>`);
    expect(xml).toContain(`staff-answer?call=${callId}&amp;user=actor%3A123`);
    expect(xml).toContain('timeout="30"');
    expect(xml).not.toContain("<Record");
    expect(() =>
      inboundCallTwiml({
        callId,
        targets: [{ identity: "forged", userId: "x" }],
        voicemail: true,
      }),
    ).toThrow();
    expect(() =>
      inboundCallTwiml({
        callId,
        targets: Array.from({ length: 11 }, () => ({ identity, userId: "x" })),
        voicemail: true,
      }),
    ).toThrow();
  });
  it("offers only explicit voicemail with a recording announcement, bounded length and nonlooping action", () => {
    const xml = inboundCallTwiml({
      callId,
      targets: [],
      voicemail: true,
      greeting: "Hello <friend> & welcome",
    });
    expect(xml).toContain("Hello &lt;friend&gt; &amp; welcome");
    expect(xml).toContain("Your voicemail will be recorded.");
    expect(xml).toContain('maxLength="180"');
    expect(xml).toContain('playBeep="true"');
    expect(xml).toContain('transcribe="false"');
    expect(xml).toContain(`/voicemail-complete?call=${callId}`);
    expect(xml).toContain(`/voicemail?call=${callId}`);
    expect(
      inboundCallTwiml({ callId, targets: [], voicemail: false }),
    ).not.toContain("<Record");
    vi.stubEnv("TWILIO_VOICE_ENABLED", "false");
    expect(voicemailTwiml({ callId })).toContain("<Hangup/>");
    expect(voicemailTwiml({ callId })).not.toContain("<Record");
  });
});
