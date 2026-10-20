import { describe, expect, it } from "vitest";
import {
  reportToday,
  parseReportSelection,
  resolveReportRange,
  previousRange,
  datesDescending,
  validDate,
} from "./dates";
import { csvLine } from "./csv";
import { readMeasurement } from "@/lib/analytics/measurement";
describe("Reporting dates and exports", () => {
  it("uses Pacific dates across midnight and daylight-saving changes", () => {
    expect(reportToday(new Date("2026-03-08T07:59:00Z"))).toBe("2026-03-07");
    expect(reportToday(new Date("2026-03-09T06:59:00Z"))).toBe("2026-03-08");
    expect(datesDescending("2026-03-07", "2026-03-09")).toEqual([
      "2026-03-09",
      "2026-03-08",
      "2026-03-07",
    ]);
  });
  it("keeps exact custom dates and rejects impossible or excessive ranges", () => {
    expect(validDate("2026-02-30")).toBe(false);
    expect(
      parseReportSelection({
        range: "custom",
        start: "2026-02-30",
        end: "2026-03-01",
      }),
    ).toEqual({ range: "30d" });
    expect(
      parseReportSelection({
        range: "custom",
        start: "2020-01-01",
        end: "2026-01-01",
      }),
    ).toEqual({ range: "30d" });
    const range = resolveReportRange({
      range: "custom",
      start: "2026-03-07",
      end: "2026-03-09",
    });
    expect(range.days).toBe(3);
    expect(previousRange(range)).toEqual({
      start: "2026-03-04",
      end: "2026-03-06",
      days: 3,
    });
    expect(resolveReportRange({ range: "90d" }, "2026-10-17").days).toBe(90);
  });
  it("quotes CSV and neutralizes formulas even after hidden whitespace", () => {
    expect(
      csvLine(['=HYPERLINK("x")', " \t+1", "@SUM(A1)", "plain, text", 12]),
    ).toBe(
      '"\'=HYPERLINK(""x"")","\' \t+1","\'@SUM(A1)","plain, text","12"\r\n',
    );
  });
  it("excludes privacy-disabled and invalid measurement without rejecting an inquiry", () => {
    const value = {
      sessionId: "00000000-0000-4000-8000-000000000010",
      path: "/contact",
      landingPath: "/",
    };
    expect(readMeasurement(value, new Headers())).toEqual(value);
    expect(readMeasurement(value, new Headers({ dnt: "1" }))).toBeUndefined();
    expect(
      readMeasurement(value, new Headers({ "sec-gpc": "1" })),
    ).toBeUndefined();
    expect(
      readMeasurement(
        { ...value, email: "private@example.com" },
        new Headers(),
      ),
    ).toBeUndefined();
    expect(
      readMeasurement({ ...value, path: "/dashboard" }, new Headers()),
    ).toBeUndefined();
  });
});
