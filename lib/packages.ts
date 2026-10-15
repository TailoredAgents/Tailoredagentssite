export const FLEX_MONTHS = 6;
export const FLEX_ANNUAL_RATE = 0.12;

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
    defaultUpfront: 1500,
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
    defaultUpfront: 2250,
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
    defaultUpfront: 2250,
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
    defaultUpfront: 4000,
    features: ["Advanced website scope", "Integration planning", "Active SEO program", "Growth setup included"],
    featured: false,
  },
] as const satisfies readonly GrowthPackage[];

export function calculatePackageBreakdown(plan: GrowthPackage, requestedUpfront: number) {
  const upfront = Math.min(plan.websitePrice, Math.max(plan.minimumUpfront, requestedUpfront));
  const deferredWebsite = plan.websitePrice - upfront;
  const monthlyRate = FLEX_ANNUAL_RATE / 12;
  const growthFactor = (1 + monthlyRate) ** FLEX_MONTHS;
  const websiteMonthly = deferredWebsite === 0
    ? 0
    : Math.round((deferredWebsite * ((monthlyRate * growthFactor) / (growthFactor - 1))) * 100) / 100;
  const flexCost = Math.round(((websiteMonthly * FLEX_MONTHS) - deferredWebsite) * 100) / 100;

  return {
    upfront,
    deferredWebsite,
    flexCost,
    websiteMonthly,
    combinedMonthly: Math.round((websiteMonthly + plan.seoMonthly) * 100) / 100,
    ongoingMonthly: plan.seoMonthly,
    websiteFlexTotal: Math.round((upfront + deferredWebsite + flexCost) * 100) / 100,
  };
}
