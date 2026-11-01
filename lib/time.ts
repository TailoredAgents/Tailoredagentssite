/** Business-facing times use Eastern; persisted instants remain UTC. */
export const BUSINESS_TIME_ZONE = "America/New_York";
export const BUSINESS_TIME_LABEL = "US Eastern (America/New_York)";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
function parts(date: Date) {
  return Object.fromEntries(partsFormatter.formatToParts(date).map(p => [p.type, p.value]));
}

/** D1's zone-less datetime values are UTC, never the device's local zone. */
export function timestampIso(value: string): string | null {
  const trimmed = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)
    ? `${trimmed.replace(" ", "T")}Z` : trimmed;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function businessDateKey(now = new Date()): string {
  const p = parts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Calendar arithmetic: an Eastern day can have 23, 24 or 25 hours. */
export function nextBusinessMidnight(now = new Date()): string {
  const nextDay = new Date(`${businessDateKey(now)}T12:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return easternInputCandidates(`${nextDay.toISOString().slice(0, 10)}T00:00`)[0];
}

export function easternInputValue(value: string) {
  const date = new Date(timestampIso(value) ?? NaN);
  if (!Number.isFinite(date.getTime())) return "";
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Zero matches is the spring gap/invalid input; two is the fall repeated hour. */
export function easternInputCandidates(value: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return [];
  const wall = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== value) return [];
  // Sample both sides of a possible transition to obtain the zone's real offsets.
  const offsets = new Set([-86400000, 0, 86400000].map(delta => {
    const instant = wall + delta;
    const p = parts(new Date(instant));
    return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) - instant;
  }));
  return [...offsets].map(offset => new Date(wall - offset).toISOString())
    .filter(iso => easternInputValue(iso) === value).sort();
}

/** Build punctuation ourselves so SSR and browsers render the same label. */
export function formatEasternTime(value: string, options?: { dateOnly?: boolean; year?: boolean }) {
  const date = new Date(timestampIso(value) ?? NaN);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  // A calendar date (project deadline, etc.) is not an instant to shift west of UTC.
  const dateOnlyValue = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const p = dateOnlyValue
    ? { year: value.slice(0, 4), month: value.slice(5, 7), day: value.slice(8, 10), hour: "00", minute: "00" }
    : parts(date);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(p.month) - 1];
  const label = `${month} ${Number(p.day)}${options?.year === false ? "" : `, ${p.year}`}`;
  if (options?.dateOnly || dateOnlyValue) return label;
  const hour = Number(p.hour);
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIME_ZONE, timeZoneName: "short" })
    .formatToParts(date).find(part => part.type === "timeZoneName")!.value;
  return `${label}, ${hour % 12 || 12}:${p.minute} ${hour >= 12 ? "PM" : "AM"} ${zone}`;
}
