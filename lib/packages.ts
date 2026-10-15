export const FLEX_MONTHS = 6;
export const FLEX_PREMIUM_RATE = 0.056;

export type GrowthPackage = {
  id: string;
  name: string;
  kicker: string;
  description: string;
  websiteName: string;
  websitePrice: number;
  seoName: string;
  seoMonthly: number;
  seoSetupValue: number;
  minimumUpfront: number;
  defaultUpfront: number;
  features: readonly string[];
  featured?: boolean;
};

export const growthPackages = [
  {
    id: "launch-visibility",
    name: "Launch Visibility",
    kicker: "Focused local launch",
    description: "A professional five-page website paired with the essentials for ongoing local-search visibility.",
    websiteName: "Launch Website",
    websitePrice: 1500,
    seoName: "SEO Essentials",
    seoMonthly: 400,
    seoSetupValue: 350,
    minimumUpfront: 750,
    defaultUpfront: 750,
    features: ["Up to five website pages", "Foundational analytics", "Managed local SEO", "SEO foundation setup included"],
    featured: false,
  },
  {
    id: "growth-foundation",
    name: "Growth Foundation",
    kicker: "Best place to start",
    description: "A more tailored website and a measured monthly SEO cadence for an established local business.",
    websiteName: "Custom Growth Website",
    websitePrice: 2250,
    seoName: "SEO Essentials",
    seoMonthly: 400,
    seoSetupValue: 350,
    minimumUpfront: 1000,
    defaultUpfront: 1000,
    features: ["Expanded website structure", "Conversion planning", "Managed local SEO", "SEO foundation setup included"],
    featured: true,
  },
  {
    id: "growth-advantage",
    name: "Growth Advantage",
    kicker: "More active improvement",
    description: "The Custom Growth Website with a stronger optimization, content, competitor, and measurement cadence.",
    websiteName: "Custom Growth Website",
    websitePrice: 2250,
    seoName: "SEO Growth",
    seoMonthly: 650,
    seoSetupValue: 500,
    minimumUpfront: 1000,
    defaultUpfront: 1000,
    features: ["Expanded website structure", "Active page optimization", "Competitor analysis", "Growth setup included"],
    featured: false,
  },
  {
    id: "advanced-growth",
    name: "Advanced Growth",
    kicker: "Technical growth platform",
    description: "An advanced website starting point paired with a more active search and conversion-improvement program.",
    websiteName: "Advanced Website",
    websitePrice: 4000,
    seoName: "SEO Growth",
    seoMonthly: 650,
    seoSetupValue: 500,
    minimumUpfront: 1750,
    defaultUpfront: 1750,
    features: ["Advanced website scope", "Integration planning", "Active SEO program", "Growth setup included"],
    featured: false,
  },
] as const satisfies readonly GrowthPackage[];

export function calculatePackageBreakdown(plan: GrowthPackage, requestedUpfront: number) {
  const upfront = Math.min(plan.websitePrice, Math.max(plan.minimumUpfront, requestedUpfront));
  const deferredWebsite = plan.websitePrice - upfront;
  const flexPremium = deferredWebsite * FLEX_PREMIUM_RATE;
  const websiteMonthly = (deferredWebsite + flexPremium) / FLEX_MONTHS;

  return {
    upfront,
    deferredWebsite,
    flexPremium,
    websiteMonthly,
    combinedMonthly: websiteMonthly + plan.seoMonthly,
    ongoingMonthly: plan.seoMonthly,
    websiteFlexTotal: upfront + deferredWebsite + flexPremium,
  };
}
