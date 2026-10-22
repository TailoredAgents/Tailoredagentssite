import { coreServices, servicePricing } from "@/lib/services";
export function businessProfile(markets: string[]) {
  return {
    name: "Tailored Agents",
    website: "https://www.tailoredagents.com",
    audience:
      "Businesses seeking website development, SEO and practical AI-agent/business-automation services in the United States.",
    services: coreServices.map((s) => ({
      name: s.title,
      description: s.summary,
      scope: s.detail,
      source: s.href,
    })),
    publicPricing: servicePricing,
    localServiceAreas: markets.map((v) => v.split(",")[0]),
    localPolicy:
      "These are service-area targets, not claims of offices or physical addresses.",
    proof: [
      {
        source: "/work/stonegateos",
        scope:
          "Only describe the case study's published facts. Do not invent customer results, reviews or revenue.",
      },
    ],
    rules:
      "Preserve published offers. Do not promise search positions, invent credentials, claim all products are generally available, or copy competitor text. Distinguish founding-client offerings from established services. The SEO agent may only propose changes to registered public marketing pages.",
  };
}
