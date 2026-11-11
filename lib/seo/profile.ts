import { coreServices, servicePricing } from "@/lib/services";
export function businessProfile(markets: string[]) {
  return {
    name: "Tailored Agents",
    website: "https://www.tailoredagents.com",
    audience:
      "Business owners in the United States seeking custom AI agents, business automation, integrations and connected software, with focused service areas in Georgia. Websites and SEO are optional services, not required entry points.",
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
      "Lead with custom AI, automation and software partnerships. Keep partnership and revenue-sharing terms private; invite a conversation without percentages or guarantees. Preserve published offers. Do not promise search positions, invent credentials, claim all products are generally available, or copy competitor text. Distinguish founding-client offerings from established services. The SEO agent may only propose changes to registered public marketing pages.",
  };
}
