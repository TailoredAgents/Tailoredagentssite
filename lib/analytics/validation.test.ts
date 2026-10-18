import { describe, expect, it } from "vitest";
import {
  analyticsEventSchema,
  analyticsRangeDays,
  parseAnalyticsRange,
} from "./validation";

const validEvent = {
  id: "a7ba927e-6c58-4f22-84b7-77491a8af5ef",
  sessionId: "8ac0d0f4-fd4e-49c4-b1ec-af8e46022d68",
  eventName: "page_view",
  path: "/pricing",
  landingPath: "/",
};

describe("analytics validation", () => {
  it("accepts a narrow first-party event payload", () => {
    expect(analyticsEventSchema.parse({
      ...validEvent,
      utmSource: "google",
      utmCampaign: "woodstock-websites",
    })).toMatchObject({ eventName: "page_view", path: "/pricing" });
  });

  it("rejects external URLs and unknown fields", () => {
    expect(analyticsEventSchema.safeParse({ ...validEvent, path: "https://example.com" }).success).toBe(false);
    expect(analyticsEventSchema.safeParse({ ...validEvent, email: "visitor@example.com" }).success).toBe(false);
  });

  it("uses a bounded reporting range", () => {
    expect(parseAnalyticsRange("7d")).toBe("7d");
    expect(parseAnalyticsRange("all-time")).toBe("30d");
    expect(analyticsRangeDays(parseAnalyticsRange("90d"))).toBe(90);
  });
});
