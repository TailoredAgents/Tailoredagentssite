import { describe, expect, it } from "vitest";
import { validateContact } from "./contact";

const valid = {
  inquiryType: "project",
  name: "Alex Morgan",
  organization: "Example Manufacturing",
  email: "alex@example.com",
  phone: "+1 404 555 0123",
  interest: "Business automation and AI",
  description: "We need to connect intake, qualification, and follow-up across our current CRM workflow.",
  website: "",
  startedAt: Date.now() - 5000,
  submissionId: "submission_123456789",
};

const validReview = {
  inquiryType: "website-review",
  name: "Jamie Taylor",
  organization: "Taylor Comfort Services",
  email: "jamie@example.com",
  phone: "",
  interest: "",
  description: "",
  websiteUrl: "taylorcomfort.example.com",
  website: "",
  startedAt: Date.now() - 5000,
  submissionId: "review_123456789012",
};

describe("validateContact", () => {
  it("accepts a complete valid inquiry", () => expect(validateContact(valid).data).toBeDefined());
  it("rejects malformed email and short descriptions", () => {
    const result = validateContact({ ...valid, email: "not-an-email", description: "too short" });
    expect(result.errors?.email).toBeDefined();
    expect(result.errors?.description).toBeDefined();
  });
  it("rejects an unknown area of interest", () => expect(validateContact({ ...valid, interest: "Magic" }).errors?.interest).toBeDefined());
  it("accepts a website review without a project description", () => {
    const result = validateContact(validReview);
    expect(result.errors).toBeUndefined();
    expect(result.data?.websiteUrl).toBe("https://taylorcomfort.example.com/");
  });
  it("rejects missing, malformed, and unsafe website review URLs", () => {
    expect(validateContact({ ...validReview, websiteUrl: "" }).errors?.websiteUrl).toBeDefined();
    expect(validateContact({ ...validReview, websiteUrl: "not a public url" }).errors?.websiteUrl).toBeDefined();
    expect(validateContact({ ...validReview, websiteUrl: "javascript:alert(1)" }).errors?.websiteUrl).toBeDefined();
  });
  it("limits the optional website review concern", () => {
    expect(validateContact({ ...validReview, description: "x".repeat(1001) }).errors?.description).toBeDefined();
  });
});
