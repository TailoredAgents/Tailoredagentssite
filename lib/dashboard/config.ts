type DashboardEnvironment = Partial<Record<
  | "DATABASE_URL"
  | "BETTER_AUTH_SECRET"
  | "BETTER_AUTH_URL"
  | "NEXT_PUBLIC_SITE_URL"
  | "DASHBOARD_ALLOWED_EMAILS"
  | "DASHBOARD_FROM_EMAIL"
  | "CONTACT_FROM_EMAIL"
  | "RESEND_API_KEY",
  string | undefined
>>;

export type DashboardConfiguration = {
  ready: boolean;
  missing: readonly string[];
  databaseUrl: string;
  authSecret: string;
  baseUrl: string;
  sender: string;
  resendApiKey: string;
  allowedEmails: ReadonlySet<string>;
};

export function parseAllowedEmails(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
  );
}

export function resolveDashboardConfiguration(
  environment: DashboardEnvironment = process.env as DashboardEnvironment,
): DashboardConfiguration {
  const databaseUrl = environment.DATABASE_URL?.trim() ?? "";
  const authSecret = environment.BETTER_AUTH_SECRET?.trim() ?? "";
  const baseUrl = (
    environment.BETTER_AUTH_URL ??
    environment.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const sender = (
    environment.DASHBOARD_FROM_EMAIL ?? environment.CONTACT_FROM_EMAIL ?? ""
  ).trim();
  const resendApiKey = environment.RESEND_API_KEY?.trim() ?? "";
  const allowedEmails = parseAllowedEmails(environment.DASHBOARD_ALLOWED_EMAILS);
  const missing: string[] = [];

  if (!databaseUrl) missing.push("DATABASE_URL");
  if (authSecret.length < 32) missing.push("BETTER_AUTH_SECRET");
  if (!sender) missing.push("DASHBOARD_FROM_EMAIL or CONTACT_FROM_EMAIL");
  if (!resendApiKey) missing.push("RESEND_API_KEY");
  if (allowedEmails.size === 0) missing.push("DASHBOARD_ALLOWED_EMAILS");

  return {
    ready: missing.length === 0,
    missing,
    databaseUrl,
    authSecret,
    baseUrl,
    sender,
    resendApiKey,
    allowedEmails,
  };
}

export function isAllowedDashboardEmail(email: string | null | undefined) {
  if (!email) return false;
  return resolveDashboardConfiguration().allowedEmails.has(email.trim().toLowerCase());
}
