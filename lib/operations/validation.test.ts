import { describe, expect, it } from "vitest";
import {
  asDatabaseDate,
  clientSchema,
  projectSchema,
  siteSchema,
  updateLeadSchema,
} from "./validation";

describe("operations validation", () => {
  it("accepts an operational lead update", () => {
    const result = updateLeadSchema.safeParse({
      leadId: "4f843c64-ff86-45d7-8c15-0ca8518ba5b2",
      status: "qualified",
      ownerUserId: "",
      nextAction: "Schedule discovery call",
      nextActionAt: "2026-10-20",
      outcomeSummary: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid workspace records", () => {
    expect(clientSchema.safeParse({ name: "A", status: "active" }).success).toBe(false);
    expect(siteSchema.safeParse({ name: "Site", url: "not-a-url" }).success).toBe(false);
    expect(projectSchema.safeParse({ clientId: "wrong", name: "Project" }).success).toBe(false);
  });

  it("stores date-only values without server timezone drift", () => {
    expect(asDatabaseDate("2026-10-20")).toBe("2026-10-20T12:00:00.000Z");
    expect(asDatabaseDate(undefined)).toBeNull();
  });
});
