import "server-only";
import { SEARCH_CONSOLE_SCOPE } from "./config";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SITES_ENDPOINT = "https://www.googleapis.com/webmasters/v3/sites";
const REQUEST_TIMEOUT_MS = 20_000;

export type GoogleTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string[];
};

export type SearchConsoleProperty = {
  siteUrl: string;
  permissionLevel: string;
};

export type SearchAnalyticsRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type GoogleErrorPayload = {
  error?: string | { status?: string; message?: string };
  error_description?: string;
};

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function googleResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & GoogleErrorPayload;
  if (response.ok) return payload;

  const nested = typeof payload.error === "object" ? payload.error : undefined;
  const code = nested?.status || (typeof payload.error === "string" ? payload.error : "google_api_error");
  const message = nested?.message || payload.error_description || "Google rejected the request.";
  throw new GoogleApiError(message, code, response.status);
}

export function buildAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: SEARCH_CONSOLE_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: input.state,
  }).toString();
  return url.toString();
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await googleResponse<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>(response);
  if (!payload.access_token) throw new GoogleApiError("Google returned no access token.", "missing_access_token", 502);
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in ?? 3600,
    scope: payload.scope?.split(" ").filter(Boolean) ?? [],
  } satisfies GoogleTokens;
}

export async function refreshGoogleAccessToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await googleResponse<{
    access_token?: string;
    expires_in?: number;
    scope?: string;
  }>(response);
  if (!payload.access_token) throw new GoogleApiError("Google returned no access token.", "missing_access_token", 502);
  return {
    accessToken: payload.access_token,
    expiresIn: payload.expires_in ?? 3600,
    scope: payload.scope?.split(" ").filter(Boolean) ?? [],
  };
}

export async function listSearchConsoleProperties(accessToken: string) {
  const response = await fetch(SITES_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await googleResponse<{ siteEntry?: SearchConsoleProperty[] }>(response);
  return payload.siteEntry ?? [];
}

export function selectMatchingProperty(properties: SearchConsoleProperty[], siteUrl: string) {
  const hostname = new URL(siteUrl).hostname.toLowerCase().replace(/^www\./, "");
  const candidates = [
    `sc-domain:${hostname}`,
    `https://${hostname}/`,
    `https://www.${hostname}/`,
  ];
  const usable = properties.filter((property) => property.permissionLevel !== "siteUnverifiedUser");
  for (const candidate of candidates) {
    const match = usable.find((property) => property.siteUrl.toLowerCase() === candidate);
    if (match) return match;
  }
  return null;
}

export async function querySearchAnalytics(input: {
  accessToken: string;
  propertyUri: string;
  startDate: string;
  endDate: string;
  dimension?: "query" | "page";
}) {
  const dimensions = input.dimension ? ["date", input.dimension] : ["date"];
  const response = await fetch(
    `${SITES_ENDPOINT}/${encodeURIComponent(input.propertyUri)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: input.startDate,
        endDate: input.endDate,
        dimensions,
        type: "web",
        dataState: "final",
        aggregationType: input.dimension === "page" ? "auto" : "byProperty",
        rowLimit: 25_000,
        startRow: 0,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  const payload = await googleResponse<{ rows?: SearchAnalyticsRow[] }>(response);
  return payload.rows ?? [];
}
