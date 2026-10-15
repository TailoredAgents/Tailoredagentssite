import { describe, expect, it } from "vitest";
import { calculatePackageBreakdown, growthPackages } from "./packages";

const growthFoundation = growthPackages.find((plan) => plan.id === "growth-foundation")!;

describe("calculatePackageBreakdown", () => {
  it("starts every package at its paid-in-full amount", () => {
    for (const plan of growthPackages) {
      expect(plan.defaultUpfront).toBe(plan.websitePrice);
    }
  });

  it("builds the recommended Growth Foundation example", () => {
    expect(calculatePackageBreakdown(growthFoundation, 1000)).toEqual({
      upfront: 1000,
      deferredWebsite: 1250,
      flexCost: 44.14,
      websiteMonthly: 215.69,
      combinedMonthly: 615.69,
      ongoingMonthly: 400,
      websiteFlexTotal: 2294.14,
    });
  });

  it("removes the flex premium when the website is paid in full", () => {
    const result = calculatePackageBreakdown(growthFoundation, 2250);
    expect(result.flexCost).toBe(0);
    expect(result.combinedMonthly).toBe(400);
    expect(result.websiteFlexTotal).toBe(2250);
  });

  it("clamps an upfront amount to the package boundaries", () => {
    expect(calculatePackageBreakdown(growthFoundation, 100).upfront).toBe(1000);
    expect(calculatePackageBreakdown(growthFoundation, 5000).upfront).toBe(2250);
  });
});
