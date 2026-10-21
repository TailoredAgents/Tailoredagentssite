import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getInquiryNotificationConfiguration } from "./inquiry-notifications";

const valid = { RESEND_API_KEY: "fake-test-key", CONTACT_FROM_EMAIL: "Website alerts <alerts@example.test>", CONTACT_TO_EMAIL: "first@example.test" };
describe("inquiry alert destinations", () => {
  it("accepts the existing single inbox and normalizes multiple unique team inboxes", () => {
    expect(getInquiryNotificationConfiguration(valid)?.to).toEqual(["first@example.test"]);
    expect(getInquiryNotificationConfiguration({ ...valid, CONTACT_TO_EMAIL: " First@example.test, second@example.test, FIRST@example.test, " })?.to).toEqual(["first@example.test", "second@example.test"]);
  });
  it("does not claim configuration is ready with a missing key, bad sender or invalid destination", () => {
    for (const change of [{ RESEND_API_KEY: " " }, { CONTACT_FROM_EMAIL: "not an email" }, { CONTACT_FROM_EMAIL: "Website\r\nBcc: other@example.test <alerts@example.test>" }, { CONTACT_TO_EMAIL: "" }, { CONTACT_TO_EMAIL: "first@example.test, broken" }]) {
      expect(getInquiryNotificationConfiguration({ ...valid, ...change })).toBeNull();
    }
  });
  it("bounds the configured recipient list", () => {
    expect(getInquiryNotificationConfiguration({ ...valid, CONTACT_TO_EMAIL: Array.from({ length: 11 }, (_, i) => `person${i}@example.test`).join(",") })).toBeNull();
  });
});
