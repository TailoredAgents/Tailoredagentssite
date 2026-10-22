import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import { transcribeCallAudio, summarizeCallTranscript, validateCallSummary } from "./analysis-provider";
describe("bounded call analysis provider",()=>{
  const transcript="Please send a website proposal next week.";
  const summary={summary:"The customer asked for a proposal.",highlights:[],followUps:[{text:"Draft the proposal",quote:transcript}]};
  beforeEach(()=>{vi.stubEnv("CALL_ANALYSIS_ENABLED","true");vi.stubEnv("OPENAI_API_KEY","synthetic-key");});
  afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
  it("sends an audio file to the current transcription API without leaking secrets in fields",async()=>{
    const request=vi.fn().mockResolvedValue(Response.json({text:transcript,languages:[{code:"en"}]}));vi.stubGlobal("fetch",request);
    expect((await transcribeCallAudio(new Uint8Array([1,2,3]))).text).toBe(transcript);
    const [url,options]=request.mock.calls[0];expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");expect(options.redirect).toBe("error");expect(options.body.get("model")).toBe("gpt-transcribe");expect(options.body.get("file").name).toBe("call.mp3");
  });
  it("requires enabled configuration and bounds media and transcript size",async()=>{
    const request=vi.fn().mockResolvedValue(Response.json({text:"x".repeat(150001)}));vi.stubGlobal("fetch",request);
    await expect(transcribeCallAudio(new Uint8Array())).rejects.toThrow();await expect(transcribeCallAudio(new Uint8Array(24*1024*1024+1))).rejects.toThrow();expect(request).not.toHaveBeenCalled();
    await expect(transcribeCallAudio(new Uint8Array([1]))).rejects.toThrow();
    vi.stubEnv("CALL_ANALYSIS_ENABLED","false");await expect(transcribeCallAudio(new Uint8Array([1]))).rejects.toThrow();expect(request).toHaveBeenCalledTimes(1);
  });
  it("uses structured summaries with nonstored responses, quoted evidence and no tools",async()=>{
    const request=vi.fn().mockResolvedValue(Response.json({status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(summary)}]}]}));vi.stubGlobal("fetch",request);
    expect((await summarizeCallTranscript(transcript)).summary).toEqual(summary);
    const body=JSON.parse(request.mock.calls[0][1].body);expect(body.store).toBe(false);expect(body.model).toBe("gpt-6-luna");expect(body.text.format.strict).toBe(true);expect(body.tools).toBeUndefined();expect(body.instructions).toContain("untrusted data");
  });
  it("rejects invented evidence, refusal, incomplete and malformed responses",async()=>{
    expect(()=>validateCallSummary({...summary,highlights:[{text:"Invented",quote:"Not in this call."}]},transcript)).toThrow();
    const request=vi.fn().mockResolvedValueOnce(Response.json({status:"incomplete",output:[]})).mockResolvedValueOnce(Response.json({status:"completed",output:[{type:"message",content:[{type:"refusal"}]}]})).mockResolvedValueOnce(new Response("bad",{status:500}));vi.stubGlobal("fetch",request);
    for(let i=0;i<3;i++) await expect(summarizeCallTranscript(transcript)).rejects.toThrow();
  });
});
