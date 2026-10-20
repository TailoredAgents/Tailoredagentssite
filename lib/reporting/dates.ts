export const REPORT_TIME_ZONE = "America/Los_Angeles";
export type DateRange = { start: string; end: string; days: number };
export type ReportSelection = {
  range: "7d" | "30d" | "90d" | "custom";
  start?: string;
  end?: string;
};

export function reportToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function validDate(value: string | undefined): value is string {
  return Boolean(
    value &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
      new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value,
  );
}
export function parseReportSelection(
  parameters: Record<string, string | string[] | undefined>,
): ReportSelection {
  const first = (key: string) =>
    Array.isArray(parameters[key]) ? parameters[key][0] : parameters[key];
  const range = first("range"),
    start = first("start"),
    end = first("end");
  if (
    range === "custom" &&
    validDate(start) &&
    validDate(end) &&
    start <= end &&
    end <= reportToday() &&
    (Date.parse(end) - Date.parse(start)) / 86400000 < 366
  )
    return { range, start, end };
  return { range: range === "7d" || range === "90d" ? range : "30d" };
}
export function resolveReportRange(
  selection: ReportSelection,
  lastCompleteDate = shiftDate(reportToday(), -1),
): DateRange {
  const end = selection.range === "custom" ? selection.end! : lastCompleteDate;
  const start =
    selection.range === "custom"
      ? selection.start!
      : shiftDate(end, -Number.parseInt(selection.range) + 1);
  return {
    start,
    end,
    days: Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1,
  };
}
export function previousRange(range: DateRange): DateRange {
  return {
    start: shiftDate(range.start, -range.days),
    end: shiftDate(range.start, -1),
    days: range.days,
  };
}
export function datesDescending(start: string, end: string) {
  const dates: string[] = [];
  for (let day = end; day >= start; day = shiftDate(day, -1)) dates.push(day);
  return dates;
}
