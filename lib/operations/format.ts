export function formatOperationalDate(value: string | null | undefined, options?: { dateOnly?: boolean }) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", options?.dateOnly
    ? { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }
    : { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    .format(new Date(value));
}

export function inputDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

export function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}
