export const dashboardThemeCookie = "ta-dashboard-theme";
export type DashboardTheme = "light" | "dark" | "system";

export function dashboardTheme(value: unknown): DashboardTheme {
  return value === "dark" || value === "system" ? value : "light";
}
