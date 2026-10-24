export const SEO_SITE_ID = "00000000-0000-4000-8000-000000000002";
export const SEO_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
export const SEO_ORIGIN = "https://www.tailoredagents.com";
export const managedPaths = [
  "/",
  "/websites",
  "/seo",
  "/automation",
  "/packages",
  "/pricing",
  "/industries/hvac",
  "/free-review",
  "/work",
  "/work/stonegateos",
  "/solutions",
  "/engineering",
  "/company",
  "/contact",
] as const;
export function managedPath(value: string) {
  return (managedPaths as readonly string[]).includes(value);
}
export function seoConfiguration() {
  return {
    ai: Boolean(process.env.SEO_OPENAI_API_KEY?.trim()),
    research: Boolean(
      process.env.SEO_EXTERNAL_RESEARCH_ENABLED === "true" &&
      process.env.DATAFORSEO_LOGIN?.trim() &&
        process.env.DATAFORSEO_PASSWORD?.trim(),
    ),
    worker: Boolean(
      (
        process.env.SEO_WORKER_SECRET ||
        process.env.SEARCH_CONSOLE_SYNC_SECRET ||
        ""
      ).trim().length >= 32,
    ),
  };
}
export const modelRates = {
  "gpt-6.1-sol": { input: 2, cached: 0.1, write: 2.5, output: 10 },
  "gpt-6-astra": { input: 10, cached: 1, write: 12.5, output: 50 },
  "gpt-6-luna": { input: 0.1, cached: 0.01, write: 0.125, output: 0.5 },
} as const;
export type SeoModel = keyof typeof modelRates;
export const SEO_MONTHLY_MAX = 10_000_000;
export const seoModelPolicy = { version: "2026-10-24-standard-30m", model: "gpt-6.1-sol", tier: "default", cacheTtl: "30m" } as const;
// Rates in microdollars/token, equivalent to USD/million tokens. Ignore cache
// discounts when reserving. Providers are never given arbitrary tools or code.
export function modelCost(model: SeoModel, input: number, output: number) {
  const p = modelRates[model];
  return Math.ceil(input * p.write + output * p.output);
}
export type ModelUsage = {
  input_tokens: number; output_tokens: number;
  input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number;
    cache_write_tokens_details?: { ttl_30m_tokens: number; ttl_12h_tokens: number } };
};
export function usageCost(model: SeoModel, usage: ModelUsage) {
  const p = modelRates[model], d = usage.input_tokens_details;
  // Older responses without detail are conservatively accounted at the write rate.
  if (!d) return modelCost(model, usage.input_tokens, usage.output_tokens);
  const cached = d.cached_tokens || 0, writes = d.cache_write_tokens || 0;
  const longWrites = d.cache_write_tokens_details?.ttl_12h_tokens || 0;
  if (cached + writes > usage.input_tokens || longWrites > writes ||
      (d.cache_write_tokens_details && d.cache_write_tokens_details.ttl_30m_tokens + longWrites !== writes))
    throw new Error("invalid_model_usage");
  return Math.ceil((usage.input_tokens-cached-writes)*p.input + cached*p.cached +
    (writes-longWrites)*p.write + longWrites*p.input*2.5 + usage.output_tokens*p.output);
}
export function dollars(micros: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(micros) / 1_000_000);
}
