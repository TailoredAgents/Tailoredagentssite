import "server-only";
import { createHmac } from "node:crypto";
import { metaConfiguration, metaId } from "./config";
import { boundedBody } from "./validation";

export class MetaProviderError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export async function fetchMetaLead(id: string) {
  const config = metaConfiguration();
  if (!config.ready || !metaId.test(id))
    throw new MetaProviderError("configuration_required");
  const url = new URL(`https://graph.facebook.com/${config.version}/${id}`);
  url.searchParams.set(
    "fields",
    "id,created_time,form_id,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,platform,is_organic",
  );
  url.searchParams.set(
    "appsecret_proof",
    createHmac("sha256", config.appSecret)
      .update(config.accessToken)
      .digest("hex"),
  );
  try {
    const options: RequestInit = {
      headers: { Authorization: `Bearer ${config.accessToken}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    };
    let response = await fetch(url, options);
    if ([400, 403].includes(response.status)) {
      // Ad metadata can require additional permissions. Retrieve the actual
      // submitted lead even when those optional fields are unavailable.
      await response.body?.cancel();
      url.searchParams.set("fields", "id,created_time,form_id,field_data");
      response = await fetch(url, options);
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new MetaProviderError(`provider_http_${response.status}`);
    }
    return JSON.parse(
      (await boundedBody(response.body, 256_000)).toString("utf8"),
    ) as unknown;
  } catch (error) {
    if (error instanceof MetaProviderError) throw error;
    throw new MetaProviderError("provider_unavailable");
  }
}
