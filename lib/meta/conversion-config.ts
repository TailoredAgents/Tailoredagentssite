import "server-only";
import { metaId } from "./config";

export function metaConversionConfiguration() {
  const requested = process.env.META_CAPI_MODE?.trim();
  const mode = requested === "live" || requested === "test" ? requested : "paused";
  const datasetId = process.env.META_CAPI_DATASET_ID?.trim() || "";
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim() || "";
  const pageId = process.env.META_PAGE_ID?.trim() || "";
  const version = process.env.META_GRAPH_API_VERSION?.trim() || "v26.0";
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim() || "";
  const configured = metaId.test(datasetId) && metaId.test(pageId) && accessToken.length > 20 && /^v\d+\.0$/.test(version);
  return { mode, datasetId, accessToken, pageId, version, testEventCode, configured,
    ready: configured && mode !== "paused" && (mode !== "test" || /^[A-Za-z0-9_-]{1,100}$/.test(testEventCode)) };
}
