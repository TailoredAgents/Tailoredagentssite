export const SEARCH_CONSOLE_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";
export const SEARCH_CONSOLE_PROVIDER = "google_search_console" as const;

type SearchConsoleEnvironment = Partial<
  Record<
    | "GOOGLE_SEARCH_CONSOLE_CLIENT_ID"
    | "GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET"
    | "BETTER_AUTH_URL"
    | "NEXT_PUBLIC_SITE_URL",
    string | undefined
  >
>;

export function resolveSearchConsoleConfiguration(
  environment: SearchConsoleEnvironment = process.env as SearchConsoleEnvironment,
) {
  const clientId = environment.GOOGLE_SEARCH_CONSOLE_CLIENT_ID?.trim() ?? "";
  const clientSecret =
    environment.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET?.trim() ?? "";
  const baseUrl = (
    environment.BETTER_AUTH_URL ??
    environment.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const missing: string[] = [];

  if (!clientId) missing.push("GOOGLE_SEARCH_CONSOLE_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET");
  try {
    const url = new URL(baseUrl);
    if (
      url.origin !== baseUrl ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)
        ))
    )
      missing.push("CANONICAL_ORIGIN");
    if (
      environment.NEXT_PUBLIC_SITE_URL &&
      environment.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "") !== baseUrl
    )
      missing.push("CANONICAL_ORIGIN_MISMATCH");
    if (
      url.hostname.endsWith("tailoredagents.com") &&
      baseUrl !== "https://tailoredagents.com"
    )
      missing.push("CANONICAL_ORIGIN");
  } catch {
    missing.push("CANONICAL_ORIGIN");
  }

  return {
    configured: missing.length === 0,
    missing,
    clientId,
    clientSecret,
    baseUrl,
    redirectUri: `${baseUrl}/api/integrations/search-console/callback`,
  };
}
