// Google supplies daily aggregates in Pacific time. These dates cannot be
// shifted to Eastern without Google's underlying hourly measurements.
export const SEARCH_CONSOLE_TIME_ZONE = "America/Los_Angeles";
export function searchConsoleToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEARCH_CONSOLE_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}
