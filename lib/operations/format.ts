/** Keep an unknown business blank in storage while giving the lead a useful title. */
export function leadDisplayName(lead: { organization?: string | null; name?: string | null; phone?: string | null; email?: string | null }) {
  return lead.organization?.trim() || (lead.name?.trim() !== "Business contact" ? lead.name?.trim() : "") || lead.phone?.trim() || lead.email?.trim() || "Unnamed lead";
}

export function formatOperationalDate(value: string | null | undefined, options?: { dateOnly?: boolean }) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", options?.dateOnly
    ? { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }
    : { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" })
    .format(new Date(value));
}

export function inputDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

export function statusLabel(value: string) {
  const label = value.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}
