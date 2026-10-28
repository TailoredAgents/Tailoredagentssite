import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { conversionPayload, sendMetaConversion } from "./conversion-provider";
import { metaConversionConfiguration } from "./conversion-config";

const event = { id: "00000000-0000-4000-8000-000000000042", providerLeadId: "12345678901234567", stage: "qualified" as const, occurredAt: new Date() };
const config = { ready: true, configured: true, mode: "live" as const, datasetId: "123456789", pageId: "987654321", accessToken: "synthetic-test-token-only", version: "v26.0", testEventCode: "TEST42" };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Meta CRM conversion transport", () => {
  it("preserves the original event identity/time and uses only the Meta lead ID", () => {
    const payload = conversionPayload(event);
    expect(payload).toEqual({ data: [{ event_name: "QualifiedLead", event_time: Math.floor(event.occurredAt.getTime()/1000), event_id: event.id,
      action_source: "system_generated", user_data: { lead_id: event.providerLeadId }, custom_data: { event_source: "crm", lead_event_source: "Tailored Agents CRM" } }] });
    expect(conversionPayload(event)).toEqual(payload);
    expect(conversionPayload({ ...event, stage: "won" }).data[0].event_name).toBe("Won");
    expect(conversionPayload(event, "TEST42")).toMatchObject({ test_event_code: "TEST42", data: [{ event_id: `test:${event.id}` }] });
  });
  it("rejects stale/future events without changing their dates", () => {
    expect(() => conversionPayload({ ...event, occurredAt: new Date(Date.now()-8*86400000) })).toThrow("event_outside_upload_window");
    expect(() => conversionPayload({ ...event, occurredAt: new Date(Date.now()+86400000) })).toThrow("event_outside_upload_window");
  });
  it("defaults to paused and requires a test code in test mode", () => {
    vi.stubEnv("META_CAPI_MODE", ""); vi.stubEnv("META_CAPI_DATASET_ID", config.datasetId);
    vi.stubEnv("META_PAGE_ID", config.pageId); vi.stubEnv("META_CAPI_ACCESS_TOKEN", config.accessToken);
    vi.stubEnv("META_GRAPH_API_VERSION", config.version); vi.stubEnv("META_CAPI_TEST_EVENT_CODE", "");
    expect(metaConversionConfiguration()).toMatchObject({ mode: "paused", ready: false });
    vi.stubEnv("META_CAPI_MODE", "test"); expect(metaConversionConfiguration().ready).toBe(false);
    vi.stubEnv("META_CAPI_TEST_EVENT_CODE", "TEST42"); expect(metaConversionConfiguration().ready).toBe(true);
  });
  it("requires an accepted event and keeps credentials out of the URL/body", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ events_received: 1 })));
    vi.stubGlobal("fetch", fetcher);
    await sendMetaConversion(event, config);
    expect(fetcher.mock.calls[0][0]).toBe("https://graph.facebook.com/v26.0/123456789/events");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error", headers: { Authorization: `Bearer ${config.accessToken}` } });
    expect(fetcher.mock.calls[0][1].body).not.toContain(config.accessToken);
    fetcher.mockResolvedValue(new Response(JSON.stringify({ events_received: 0 })));
    await expect(sendMetaConversion(event, config)).rejects.toMatchObject({ code: "http_200", retryable: false });
  });
  it("sanitizes provider errors and treats timeouts as retryable with the same event", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 190, message: config.accessToken } }), { status: 400 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(sendMetaConversion(event, config)).rejects.toMatchObject({ message: "meta_190", retryable: false });
    fetcher.mockRejectedValue(new Error(config.accessToken));
    await expect(sendMetaConversion(event, config)).rejects.toMatchObject({ message: "response_unconfirmed", retryable: true });
    fetcher.mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(sendMetaConversion(event, config)).rejects.toMatchObject({ code: "http_429", retryable: true });
  });
});
