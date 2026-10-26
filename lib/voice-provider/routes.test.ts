import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import twilio from "twilio";
vi.mock("server-only", () => ({}));
const service = vi.hoisted(() => ({
  phone: vi.fn(),
  outbound: vi.fn(),
  incoming: vi.fn(),
  status: vi.fn(),
  dial: vi.fn(),
  record: vi.fn(),
  complete: vi.fn(),
  staff: vi.fn(),
  download: vi.fn(),
  context: vi.fn(),
  media: vi.fn(),
}));
vi.mock("@/lib/voice/service", () => ({
  receivePhoneAnswer: service.phone,
  receiveVoiceOutbound: service.outbound,
  receiveVoiceIncoming: service.incoming,
  receiveVoiceStatus: service.status,
  receiveVoiceDialAction: service.dial,
  receiveVoicemailStatus: service.record,
  receiveVoicemailAction: service.complete,
  receiveVoiceStaffAnswer: service.staff,
  getVoicemailDownload: service.download,
}));
vi.mock("@/lib/dashboard/data", () => ({
  requireDashboardContext: service.context,
}));
vi.mock("@/lib/voice-provider/provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./provider")>()),
  fetchVoicemailMedia: service.media,
  fetchCallRecordingMedia: service.media,
}));
vi.mock("@/lib/voice/recordings",()=>({receiveCallRecording:service.record,getCallRecordingDownload:service.download}));
import { VoiceAccessError, VoiceInputError } from "@/lib/voice/data";
import { POST as phoneAnswer } from "@/app/api/integrations/twilio/voice/callback-answer/route";
import { POST as phoneAccept } from "@/app/api/integrations/twilio/voice/callback-accept/route";
import { POST as outbound } from "@/app/api/integrations/twilio/voice/outbound/route";
import { POST as incoming } from "@/app/api/integrations/twilio/voice/incoming/route";
import { POST as status } from "@/app/api/integrations/twilio/voice/status/route";
import { POST as dial } from "@/app/api/integrations/twilio/voice/dial-result/route";
import { POST as record } from "@/app/api/integrations/twilio/voice/voicemail/route";
import { POST as complete } from "@/app/api/integrations/twilio/voice/voicemail-complete/route";
import { POST as staff } from "@/app/api/integrations/twilio/voice/staff-answer/route";
import { GET as media } from "@/app/api/dashboard/voice/voicemails/[id]/route";
import { GET as callMedia } from "@/app/api/dashboard/voice/recordings/[id]/route";
import { POST as callRecording } from "@/app/api/integrations/twilio/voice/recordings/route";
const origin = "https://agency.example.test",
  account = "AC" + "a".repeat(32),
  auth = "b".repeat(32),
  callId = "00000000-0000-4000-8000-000000000123",
  sid = "CA" + "e".repeat(32),
  identity = "ta_" + "f".repeat(48),
  phone = "+15555550123",
  to = "+15555550456";
const params = { AccountSid: account, CallSid: sid, From: to, To: phone };
const signed = (path: string, p: Record<string, string> = params) =>
  new Request(origin + "/api/integrations/twilio/voice/" + path, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": twilio.getExpectedTwilioSignature(
        auth,
        origin + "/api/integrations/twilio/voice/" + path,
        p,
      ),
    },
    body: new URLSearchParams(p),
  });
describe("voice signed route boundaries and protected audio", () => {
  it("screens signed handset answers and returns business caller ID only after authorized acceptance",async()=>{
    service.phone.mockResolvedValue(null);
    const screen=await phoneAnswer(signed(`callback-answer?call=${callId}`));
    expect(screen.status).toBe(200);expect(await screen.text()).toContain("Press 1 to call your customer");
    expect(service.phone).toHaveBeenCalledWith(callId,params,false);
    const denied=await phoneAccept(signed(`callback-accept?call=${callId}`,{...params,Digits:"2"}));
    expect(await denied.text()).toContain("<Hangup/>");
    service.phone.mockResolvedValue({intentId:callId,callId,from:phone,to,recordCalls:true,recordingAnnouncement:false});
    const accepted=await phoneAccept(signed(`callback-accept?call=${callId}`,{...params,Digits:"1"}));
    const xml=await accepted.text();expect(xml).toContain(`callerId="${phone}"`);expect(xml).toContain(to);expect(xml).toContain('record="record-from-answer-dual"');expect(xml).toContain("/recordings?call=");
    const unsigned=signed(`callback-accept?call=${callId}`);unsigned.headers.delete("x-twilio-signature");
    service.phone.mockClear();expect((await phoneAccept(unsigned)).status).toBe(401);expect(service.phone).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    for (const [key, value] of Object.entries({
      TWILIO_ACCOUNT_SID: account,
      TWILIO_AUTH_TOKEN: auth,
      TWILIO_API_KEY_SID: "SK" + "c".repeat(32),
      TWILIO_API_KEY_SECRET: "d".repeat(32),
      TWILIO_PHONE_NUMBER: phone,
      TWILIO_VOICE_APP_SID: "AP" + "0".repeat(32),
      TWILIO_VOICE_ENABLED: "true",
      BETTER_AUTH_URL: origin,
      NODE_ENV: "production",
    }))
      vi.stubEnv(key, value);
    service.outbound.mockResolvedValue({
      intentId: callId,
      callId,
      from: phone,
      to,
    });
    service.incoming.mockResolvedValue({
      callId,
      targets: [{ identity, userId: "actor" }],
      voicemail: true,
      greeting: "Tailored Agents",
      timeout: 20,
    });
    service.dial.mockResolvedValue({
      voicemail: true,
      greeting: "Please leave a message",
    });
    service.status.mockResolvedValue(undefined);
    service.record.mockResolvedValue(undefined);
    service.complete.mockResolvedValue(undefined);
    service.staff.mockResolvedValue(undefined);
    service.context.mockResolvedValue({
      user: { id: "actor" },
      workspace: { id: "workspace" },
    });
    service.download.mockResolvedValue({
      recordingSid: "RE" + "a".repeat(32),
      callSid: sid,
    });
    service.media.mockImplementation(
      async () =>
        new Response("synthetic audio", {
          headers: {
            "content-type": "audio/mpeg",
            "cache-control": "private, no-store",
          },
        }),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it("validates before backend work and derives outbound routing only from the consumed intent", async () => {
    const forged = signed("outbound", {
      ...params,
      From: "client:" + identity,
      IntentToken: callId + ".signature",
      To: "+19999999999",
    });
    const result = await outbound(forged);
    expect(result.status).toBe(200);
    expect(await result.text()).toContain(">" + to + "</Number>");
    expect(service.outbound).toHaveBeenCalledOnce();
    const bad = signed("incoming");
    bad.headers.set("x-twilio-signature", "invalid");
    expect((await incoming(bad)).status).toBe(401);
    expect(service.incoming).not.toHaveBeenCalled();
  });
  it("rings scoped staff, falls back deliberately and completes voicemail without issuing a second recording", async () => {
    expect(await (await incoming(signed("incoming"))).text()).toContain(
      "<Client",
    );
    service.incoming.mockResolvedValue({
      callId,
      targets: [],
      voicemail: true,
      greeting: "Unavailable",
    });
    expect(await (await incoming(signed("incoming"))).text()).toContain(
      "<Record",
    );
    expect(
      await (
        await dial(
          signed("dial-result?call=" + callId, {
            ...params,
            DialCallStatus: "no-answer",
          }),
        )
      ).text(),
    ).toContain("<Record");
    service.dial.mockResolvedValue({ voicemail: false, greeting: "" });
    expect(
      await (
        await dial(
          signed("dial-result?call=" + callId, {
            ...params,
            DialCallStatus: "completed",
          }),
        )
      ).text(),
    ).not.toContain("<Record");
    const finished = await complete(
      signed("voicemail-complete?call=" + callId, {
        ...params,
        RecordingDuration: "20",
        Digits: "#",
      }),
    );
    expect(await finished.text()).toContain("<Hangup/>");
    expect(service.complete).toHaveBeenCalledWith(
      callId,
      expect.objectContaining({ RecordingDuration: "20" }),
    );
    expect(service.record).not.toHaveBeenCalled();
  });
  it("keeps status and recording callbacks content-free and translates domain rejection safely", async () => {
    expect(
      (
        await status(
          signed("status?call=" + callId + "&leg=customer", {
            ...params,
            CallStatus: "completed",
          }),
        )
      ).status,
    ).toBe(200);
    expect(service.status).toHaveBeenCalledWith(expect.any(Object), {
      callId,
      leg: "customer",
    });
    expect(
      (
        await record(
          signed("voicemail?call=" + callId, {
            ...params,
            RecordingSid: "RE" + "a".repeat(32),
            RecordingStatus: "completed",
            RecordingSource: "RecordVerb",
          }),
        )
      ).status,
    ).toBe(200);
    service.incoming.mockRejectedValue(
      new VoiceInputError("PRIVATE_PROVIDER_PAYLOAD"),
    );
    const invalid = await incoming(signed("incoming"));
    expect(invalid.status).toBe(400);
    expect(await invalid.text()).not.toContain("PRIVATE");
    service.incoming.mockRejectedValue(new VoiceAccessError("PRIVATE_ACTOR"));
    expect((await incoming(signed("incoming"))).status).toBe(403);
  });
  it("checks current staff authorization before bridging and hangs up when revoked", async () => {
    const call = () =>
      signed("staff-answer?call=" + callId + "&user=actor", {
        ...params,
        To: "client:" + identity,
        ParentCallSid: sid,
      });
    const allowed = await staff(call());
    expect(await allowed.text()).toContain("<Response></Response>");
    expect(service.staff).toHaveBeenCalledWith(
      callId,
      "actor",
      expect.any(Object),
    );
    service.staff.mockRejectedValue(new VoiceAccessError("Revoked"));
    const denied = await staff(call());
    expect(denied.status).toBe(200);
    expect(await denied.text()).toContain("<Hangup/>");
  });
  it("returns retryable service failures without exposing payloads in responses or logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    service.incoming.mockRejectedValue(new Error("PRIVATE_PHONE_TOKEN_CALLER"));
    const response = await incoming(signed("incoming"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
    expect(log).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ event: "voice_webhook_unavailable" }),
    );
  });
  it("authenticates connected-call recording callbacks and rejects voicemail-source substitution",async()=>{
    const fields={...params,RecordingSid:"RE"+"a".repeat(32),RecordingStatus:"completed",RecordingSource:"DialVerb"};
    expect((await callRecording(signed(`recordings?call=${callId}`,fields))).status).toBe(200);expect(service.record).toHaveBeenCalledWith(callId,fields);
    expect((await callRecording(signed(`recordings?call=${callId}`,{...fields,RecordingSource:"RecordVerb"}))).status).toBe(400);
    const forged=signed(`recordings?call=${callId}`,fields);forged.headers.set("x-twilio-signature","a".repeat(27)+"=");expect((await callRecording(forged)).status).toBe(401);
  });
  it("protects connected-call media before and after provider IO and validates ranges",async()=>{
    const context={params:Promise.resolve({id:callId})};const request=new Request(origin+"/api/dashboard/voice/recordings/"+callId);
    service.download.mockRejectedValueOnce(new VoiceAccessError("Revoked"));expect((await callMedia(request,context)).status).toBe(403);expect(service.media).not.toHaveBeenCalled();
    expect((await callMedia(request,context)).status).toBe(200);
    service.download.mockResolvedValueOnce({recordingSid:"RE"+"a".repeat(32),callSid:sid}).mockRejectedValueOnce(new VoiceAccessError("Revoked during read"));expect((await callMedia(request,context)).status).toBe(403);
    expect((await callMedia(new Request(request.url,{headers:{range:"bytes=0-1,3-5"}}),context)).status).toBe(416);
  });
  it("requires current private download permission before provider IO, validates ranges and rechecks before releasing audio", async () => {
    const routeContext = { params: Promise.resolve({ id: callId }) },
      request = new Request(
        origin + "/api/dashboard/voice/voicemails/" + callId,
        { headers: { range: "bytes=0-2" } },
      );
    service.download.mockRejectedValueOnce(new VoiceAccessError("Revoked"));
    expect((await media(request, routeContext)).status).toBe(403);
    expect(service.media).not.toHaveBeenCalled();
    const response = await media(request, routeContext);
    expect(response.status).toBe(200);
    expect(service.media).toHaveBeenCalledWith(
      { recordingSid: "RE" + "a".repeat(32), callSid: sid },
      { range: "bytes=0-2" },
    );
    expect(service.download).toHaveBeenCalledTimes(3);
    const count = service.media.mock.calls.length;
    expect(
      (
        await media(
          new Request(request.url, { headers: { range: "bytes=0-1,3-5" } }),
          routeContext,
        )
      ).status,
    ).toBe(416);
    expect(service.media).toHaveBeenCalledTimes(count);
    service.download
      .mockResolvedValueOnce({
        recordingSid: "RE" + "a".repeat(32),
        callSid: sid,
      })
      .mockRejectedValueOnce(
        new VoiceAccessError("Revoked during provider IO"),
      );
    expect((await media(request, routeContext)).status).toBe(403);
  });
});
