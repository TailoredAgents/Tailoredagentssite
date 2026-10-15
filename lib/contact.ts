export const interestOptions = [
  "Website design and development",
  "Local SEO and analytics",
  "Business automation and AI",
  "Custom software or platform",
  "Not sure yet",
] as const;

export const inquiryTypes = ["project", "website-review"] as const;
export type InquiryType = (typeof inquiryTypes)[number];

export type ContactPayload = {
  inquiryType: InquiryType;
  name: string;
  organization: string;
  email: string;
  phone?: string;
  interest: string;
  description: string;
  websiteUrl?: string;
  website?: string;
  startedAt: number;
  submissionId: string;
};

export type ContactErrors = Partial<Record<keyof ContactPayload, string>>;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeWebsiteUrl(value: unknown) {
  const cleaned = clean(value);
  if (!cleaned) return "";
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function validateContact(input: unknown): { data?: ContactPayload; errors?: ContactErrors } {
  if (!input || typeof input !== "object") return { errors: { description: "Invalid submission." } };
  const raw = input as Record<string, unknown>;
  const inquiryType = clean(raw.inquiryType) || "project";
  const websiteUrl = normalizeWebsiteUrl(raw.websiteUrl);
  const data: ContactPayload = {
    inquiryType: inquiryType as InquiryType,
    name: clean(raw.name),
    organization: clean(raw.organization),
    email: clean(raw.email).toLowerCase(),
    phone: clean(raw.phone),
    interest: clean(raw.interest),
    description: typeof raw.description === "string" ? raw.description.trim() : "",
    websiteUrl: websiteUrl || "",
    website: clean(raw.website),
    startedAt: typeof raw.startedAt === "number" ? raw.startedAt : 0,
    submissionId: clean(raw.submissionId),
  };
  const errors: ContactErrors = {};
  if (!inquiryTypes.includes(data.inquiryType)) errors.inquiryType = "Invalid inquiry type.";
  if (data.name.length < 2 || data.name.length > 100) errors.name = "Enter your name (2–100 characters).";
  if (data.organization.length < 2 || data.organization.length > 140) errors.organization = "Enter an organization name (2–140 characters).";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 254) errors.email = "Enter a valid business email.";
  if (data.phone && (data.phone.length < 7 || data.phone.length > 30 || !/^[+()\-.\s\d]+$/.test(data.phone))) errors.phone = "Enter a valid phone number or leave this blank.";
  if (data.inquiryType === "project") {
    if (!interestOptions.includes(data.interest as (typeof interestOptions)[number])) errors.interest = "Choose an area of interest.";
    if (data.description.length < 30 || data.description.length > 3000) errors.description = "Describe the project in 30–3,000 characters.";
  }
  if (data.inquiryType === "website-review") {
    if (websiteUrl === null || !data.websiteUrl) errors.websiteUrl = "Enter a valid public website URL.";
    if (data.description.length > 1000) errors.description = "Keep the primary concern under 1,000 characters.";
  }
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(data.submissionId)) errors.submissionId = "Invalid submission identifier.";
  if (Object.keys(errors).length) return { errors };
  return { data };
}
