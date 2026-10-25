type LeadIdentity = { organization?: string | null; name?: string | null; phone?: string | null; email?: string | null };

/** Exact placeholder answers only: real names such as "None Such Studio" survive. */
export function cleanLeadCompany(value?: string | null) {
  const company = value?.trim() || "";
  return /^(?:none|n\s*[/.]?\s*a\.?|null|not applicable|not available|no company|no business|not yet|[-–—]+)$/i.test(company) ? "" : company;
}

/** Leads represent people; the company is supporting context. */
export function leadDisplayName(lead: LeadIdentity) {
  const person = lead.name?.trim();
  return (person && person !== "Business contact" ? person : "") || cleanLeadCompany(lead.organization) || lead.phone?.trim() || lead.email?.trim() || "Unnamed lead";
}

export function leadCompanyName(lead: LeadIdentity) {
  const company = cleanLeadCompany(lead.organization);
  return company.toLowerCase() === leadDisplayName(lead).toLowerCase() ? "" : company;
}

/** Business/client creation still prefers a real company when supplied. */
export function leadBusinessName(lead: LeadIdentity) {
  return cleanLeadCompany(lead.organization) || leadDisplayName(lead);
}

export function leadOptionLabel(lead: LeadIdentity) {
  return [leadDisplayName(lead), leadCompanyName(lead)].filter(Boolean).join(" — ");
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
