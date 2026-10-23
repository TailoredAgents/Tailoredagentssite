import "server-only";

export const META_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
export const metaId = /^\d{5,30}$/;

export function metaConfiguration() {
  const pageId = process.env.META_PAGE_ID?.trim() || "";
  const appSecret = process.env.META_APP_SECRET?.trim() || "";
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() || "";
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN?.trim() || "";
  const version = process.env.META_GRAPH_API_VERSION?.trim() || "v26.0";
  return {
    pageId,
    appSecret,
    verifyToken,
    accessToken,
    version,
    enabled: process.env.META_LEADS_ENABLED === "true",
    ready:
      metaId.test(pageId) &&
      appSecret.length >= 16 &&
      verifyToken.length >= 32 &&
      accessToken.length > 20 &&
      /^v\d+\.0$/.test(version),
  };
}
