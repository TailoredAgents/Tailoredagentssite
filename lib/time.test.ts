import { describe, expect, it } from "vitest";
import { easternInputCandidates, easternInputValue, formatEasternTime } from "./time";

describe("US Eastern CRM time", () => {
  it("uses EST in winter and EDT in summer, independent of the device zone", () => {
    expect(formatEasternTime("2026-01-15T15:30:00Z")).toBe("Jan 15, 2026, 10:30 AM EST");
    expect(formatEasternTime("2026-07-15T15:30:00Z")).toBe("Jul 15, 2026, 11:30 AM EDT");
    expect(easternInputCandidates("2026-01-15T10:30")).toEqual(["2026-01-15T15:30:00.000Z"]);
    expect(easternInputCandidates("2026-07-15T11:30")).toEqual(["2026-07-15T15:30:00.000Z"]);
  });
  it("handles Eastern midnight and preserves calendar-only deadlines", () => {
    expect(formatEasternTime("2026-11-01T02:30:00Z")).toBe("Oct 31, 2026, 10:30 PM EDT");
    expect(formatEasternTime("2026-11-01T02:30:00Z", { dateOnly: true })).toBe("Oct 31, 2026");
    expect(formatEasternTime("2026-11-01", { dateOnly: true })).toBe("Nov 1, 2026");
    expect(easternInputValue("2026-07-15T04:00:00Z")).toBe("2026-07-15T00:00");
  });
  it("rejects the nonexistent spring hour rather than shifting a scheduled time", () => {
    expect(easternInputCandidates("2026-03-08T02:30")).toEqual([]);
    expect(easternInputCandidates("2026-03-08T01:59")).toEqual(["2026-03-08T06:59:00.000Z"]);
    expect(easternInputCandidates("2026-03-08T03:00")).toEqual(["2026-03-08T07:00:00.000Z"]);
  });
  it("exposes both fall occurrences and identifies their offsets", () => {
    expect(easternInputCandidates("2026-11-01T01:30")).toEqual(["2026-11-01T05:30:00.000Z", "2026-11-01T06:30:00.000Z"]);
    expect(formatEasternTime("2026-11-01T05:30:00Z")).toContain("1:30 AM EDT");
    expect(formatEasternTime("2026-11-01T06:30:00Z")).toContain("1:30 AM EST");
    expect(easternInputValue("2026-11-01T06:30:29Z")).toBe("2026-11-01T01:30");
  });
  it("rejects invalid calendar dates and malformed wall times", () => {
    for (const value of ["", "bad", "2026-02-30T12:00", "2026-01-01T24:00", "2026-01-01T12:00Z"]) {
      expect(easternInputCandidates(value)).toEqual([]);
    }
    expect(easternInputValue("bad")).toBe("");
    expect(formatEasternTime("bad")).toBe("Date unavailable");
  });
});
