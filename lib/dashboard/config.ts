type DashboardEnvironment = Partial<Record<
  | "DATABASE_URL"
  | "BETTER_AUTH_SECRET"
  | "BETTER_AUTH_URL"
  | "NEXT_PUBLIC_SITE_URL"
  | "DASHBOARD_ALLOWED_EMAILS"
  | "DASHBOARD_INITIAL_PASSWORD"
  | "DASHBOARD_AUTH_MODE"
  | "MAIL_AUTH_URL"
  | "MAIL_AUTH_SECRET",
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
  authMode: "password" | "mail";
  mailAuthUrl: string;
  mailAuthSecret: string;
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
  const authMode = environment.DASHBOARD_AUTH_MODE === "mail" ? "mail" : "password";
  const mailAuthUrl = environment.MAIL_AUTH_URL?.trim() ?? "https://mail.tailoredagents.com/api/dashboard-auth";
  const mailAuthSecret = environment.MAIL_AUTH_SECRET?.trim() ?? "";
  const missing: string[] = [];

  if (!databaseUrl) missing.push("DATABASE_URL");
  if (authSecret.length < 32) missing.push("BETTER_AUTH_SECRET");
  if (environment.DASHBOARD_AUTH_MODE && !["mail", "password"].includes(environment.DASHBOARD_AUTH_MODE)) missing.push("DASHBOARD_AUTH_MODE");
  if (authMode === "mail") {
    if (mailAuthSecret.length < 32) missing.push("MAIL_AUTH_SECRET");
    try {
      const target = new URL(mailAuthUrl);
      const local = process.env.NODE_ENV !== "production" && target.protocol === "http:" && ["localhost", "127.0.0.1"].includes(target.hostname);
      const trusted = target.origin === "https://mail.tailoredagents.com" || (baseUrl !== "https://www.tailoredagents.com" && target.origin === "https://tailored-mail-staging.jeffrey-78e.workers.dev");
      if ((!trusted && !local) || target.pathname !== "/api/dashboard-auth" || target.search || target.hash || target.username || target.password) missing.push("MAIL_AUTH_URL");
    } catch { missing.push("MAIL_AUTH_URL"); }
  } else {
    if (allowedEmails.size === 0) missing.push("DASHBOARD_ALLOWED_EMAILS");
    if (initialPassword.length < 10) missing.push("DASHBOARD_INITIAL_PASSWORD");
  }

  return {
    ready: missing.length === 0,
    missing,
    databaseUrl,
    authSecret,
    baseUrl,
    trustedOrigins: [baseUrl],
    initialPassword,
    allowedEmails,
    authMode,
    mailAuthUrl,
    mailAuthSecret,
  };
}

export function isAllowedDashboardEmail(email: string | null | undefined) {
  if (!email) return false;
  return resolveDashboardConfiguration().allowedEmails.has(email.trim().toLowerCase());
}
