import type { BrowserContextOptions } from "@playwright/test";

/** Optional palette coverage for the existing isolated browser/provider fixtures. */
export function dashboardThemeStorage(): BrowserContextOptions["storageState"] {
  const theme = process.env.DASHBOARD_TEST_THEME;
  if (!theme) return undefined;
  if (!["light", "dark", "system"].includes(theme)) throw new Error("Choose light, dark or system for browser theme checks.");
  return { cookies: [{ name: "ta-dashboard-theme", value: theme, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] };
}

export function dashboardPreviewPath(filename: string) {
  const theme = process.env.DASHBOARD_TEST_THEME;
  return theme ? `docs/previews/themes/${theme}/providers/${filename}` : `docs/previews/${filename}`;
}
