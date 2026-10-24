import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireDraftConfiguration, writeSuggestedDraft } from "./draft-provider";
vi.mock("server-only", () => ({}));
const request = vi.fn();
const completed = (text = "Hi Jordan, what would you like your website to do?") => new Response(JSON.stringify({
  status: "completed", output: [{type:"message",content:[{type:"output_text",text:JSON.stringify({subject:"Your website",text})}]}],
}));
beforeEach(() => { vi.stubEnv("OPENAI_API_KEY", "synthetic-key"); vi.stubEnv("CRM_AI_DRAFTS_ENABLED", "true"); vi.stubGlobal("fetch", request); request.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("client message draft provider", () => {
  it("uses structured, non-stored responses without tools and returns a bounded SMS", async () => {
    request.mockResolvedValue(completed());
    const result = await writeSuggestedDraft("sms", {staffDirection:"Set up a meeting",history:[{text:"Customer question"}]});
    expect(result.subject).toBe(""); expect(result.text).toContain("Jordan");
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    expect(body.store).toBe(false); expect(body.tools).toBeUndefined();
    expect(body.text.format.strict).toBe(true); expect(body.max_output_tokens).toBe(2200);
    expect(body.instructions).toContain("untrusted reference data");
  });
  it("keeps provider errors generic and rejects refusals, incomplete and invalid output", async () => {
    request.mockResolvedValueOnce(new Response("Sensitive provider error",{status:429}));
    await expect(writeSuggestedDraft("email",{})).rejects.toThrow("temporarily unavailable");
    request.mockResolvedValueOnce(new Response(JSON.stringify({status:"incomplete",output:[]})));
    await expect(writeSuggestedDraft("email",{})).rejects.toThrow();
    request.mockResolvedValueOnce(new Response(JSON.stringify({status:"completed",output:[{type:"message",content:[{type:"refusal"}]}]})));
    await expect(writeSuggestedDraft("email",{})).rejects.toThrow();
    request.mockResolvedValueOnce(completed("x".repeat(1601)));
    await expect(writeSuggestedDraft("sms",{})).rejects.toThrow("too long");
    request.mockResolvedValueOnce(completed(""));
    await expect(writeSuggestedDraft("email",{})).rejects.toThrow();
  });
  it("bounds input and response bytes and makes no request when disabled or missing a key", async () => {
    await expect(writeSuggestedDraft("email",{text:"x".repeat(120001)})).rejects.toThrow("too much context");
    vi.stubEnv("CRM_AI_DRAFTS_ENABLED", "false");
    expect(requireDraftConfiguration).toThrow("not configured");
    vi.stubEnv("CRM_AI_DRAFTS_ENABLED", "true"); vi.stubEnv("OPENAI_API_KEY", "");
    expect(requireDraftConfiguration).toThrow("not configured"); expect(request).not.toHaveBeenCalled();
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key");
    request.mockResolvedValue(new Response("x".repeat(128001)));
    await expect(writeSuggestedDraft("email",{})).rejects.toThrow("too large");
  });
});
