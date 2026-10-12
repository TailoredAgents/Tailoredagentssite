import { describe, expect, it } from "vitest";
import { validateContact } from "./contact";

const valid = {
  name: "Alex Morgan",
  organization: "Example Manufacturing",
  email: "alex@example.com",
  phone: "+1 404 555 0123",
  interest: "Connected AI systems",
  description: "We need to connect intake, qualification, and follow-up across our current CRM workflow.",
  website: "",
  startedAt: Date.now() - 5000,
  submissionId: "submission_123456789",
};

describe("validateContact", () => {
  it("accepts a complete valid inquiry", () => expect(validateContact(valid).data).toBeDefined());
  it("rejects malformed email and short descriptions", () => {
    const result = validateContact({ ...valid, email: "not-an-email", description: "too short" });
    expect(result.errors?.email).toBeDefined();
    expect(result.errors?.description).toBeDefined();
  });
  it("rejects an unknown area of interest", () => expect(validateContact({ ...valid, interest: "Magic" }).errors?.interest).toBeDefined());
});
