type DashboardEnvironment = Partial<Record<
  | "DATABASE_URL"
  | "BETTER_AUTH_SECRET"
  | "BETTER_AUTH_URL"
  | "NEXT_PUBLIC_SITE_URL"
  | "ENABLE_APEX_REDIRECT"
  | "DASHBOARD_ALLOWED_EMAILS"
  | "DASHBOARD_INITIAL_PASSWORD",
  string | undefined
>>;

export type DashboardConfiguration = {
  ready: boolean;
  missing: readonly string[];
  databaseUrl: string;
  authSecret: string;
  baseUrl: string;
  trustedOrigins: string[];
  initialPassword: string;
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
  const initialPassword = environment.DASHBOARD_INITIAL_PASSWORD ?? "";
  const allowedEmails = parseAllowedEmails(environment.DASHBOARD_ALLOWED_EMAILS);
  const missing: string[] = [];

  if (!databaseUrl) missing.push("DATABASE_URL");
  if (authSecret.length < 32) missing.push("BETTER_AUTH_SECRET");
  if (allowedEmails.size === 0) missing.push("DASHBOARD_ALLOWED_EMAILS");
  if (initialPassword.length < 10) missing.push("DASHBOARD_INITIAL_PASSWORD");

  return {
    ready: missing.length === 0,
    missing,
    databaseUrl,
    authSecret,
    baseUrl,
    // Keep the existing www login working until the hosting cutover is complete.
    trustedOrigins:
      baseUrl === "https://tailoredagents.com" &&
      environment.ENABLE_APEX_REDIRECT !== "true"
        ? [baseUrl, "https://www.tailoredagents.com"]
        : [baseUrl],
    initialPassword,
    allowedEmails,
  };
}

export function isAllowedDashboardEmail(email: string | null | undefined) {
  if (!email) return false;
  return resolveDashboardConfiguration().allowedEmails.has(email.trim().toLowerCase());
}
