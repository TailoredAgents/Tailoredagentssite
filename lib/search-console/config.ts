export const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const SEARCH_CONSOLE_PROVIDER = "google_search_console" as const;

type SearchConsoleEnvironment = Partial<Record<
  | "GOOGLE_SEARCH_CONSOLE_CLIENT_ID"
  | "GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET"
  | "BETTER_AUTH_URL"
  | "NEXT_PUBLIC_SITE_URL",
  string | undefined
>>;

export function resolveSearchConsoleConfiguration(
  environment: SearchConsoleEnvironment = process.env as SearchConsoleEnvironment,
) {
  const clientId = environment.GOOGLE_SEARCH_CONSOLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = environment.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET?.trim() ?? "";
  const baseUrl = (
    environment.BETTER_AUTH_URL ??
    environment.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const missing: string[] = [];

  if (!clientId) missing.push("GOOGLE_SEARCH_CONSOLE_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET");

  return {
    configured: missing.length === 0,
    missing,
    clientId,
    clientSecret,
    baseUrl,
    redirectUri: `${baseUrl}/api/integrations/search-console/callback`,
  };
}
