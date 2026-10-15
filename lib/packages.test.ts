import { describe, expect, it } from "vitest";
import { calculatePackageBreakdown, growthPackages } from "./packages";

const growthFoundation = growthPackages.find((plan) => plan.id === "growth-foundation")!;

describe("calculatePackageBreakdown", () => {
  it("builds the recommended Growth Foundation example", () => {
    expect(calculatePackageBreakdown(growthFoundation, 1000)).toEqual({
      upfront: 1000,
      deferredWebsite: 1250,
      flexPremium: 70,
      websiteMonthly: 220,
      combinedMonthly: 620,
      ongoingMonthly: 400,
      websiteFlexTotal: 2320,
    });
  });

  it("removes the flex premium when the website is paid in full", () => {
    const result = calculatePackageBreakdown(growthFoundation, 2250);
    expect(result.flexPremium).toBe(0);
    expect(result.combinedMonthly).toBe(400);
    expect(result.websiteFlexTotal).toBe(2250);
  });

  it("clamps an upfront amount to the package boundaries", () => {
    expect(calculatePackageBreakdown(growthFoundation, 100).upfront).toBe(1000);
    expect(calculatePackageBreakdown(growthFoundation, 5000).upfront).toBe(2250);
  });
});
