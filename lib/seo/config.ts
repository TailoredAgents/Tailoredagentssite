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
    ai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    research: Boolean(
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
  "gpt-6.1-sol": { input: 2, output: 10 },
  "gpt-6-astra": { input: 10, output: 50 },
  "gpt-6-luna": { input: 0.1, output: 0.5 },
} as const;
export type SeoModel = keyof typeof modelRates;
// Rates in microdollars/token, equivalent to USD/million tokens. Ignore cache
// discounts when reserving. Providers are never given arbitrary tools or code.
export function modelCost(model: SeoModel, input: number, output: number) {
  const p = modelRates[model];
  return Math.ceil(input * p.input + output * p.output);
}
export function dollars(micros: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(micros) / 1_000_000);
}
