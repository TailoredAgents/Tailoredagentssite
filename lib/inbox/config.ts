import "server-only";
import { resolveDashboardConfiguration } from "@/lib/dashboard/config";

export function inboxConfiguration() {
  const dashboard = resolveDashboardConfiguration();
  const secret = process.env.CRM_MAIL_SECRET?.trim() ?? "";
  if (dashboard.authMode !== "mail" || !dashboard.ready || secret.length < 32 || secret === dashboard.mailAuthSecret) {
    return { ready: false as const, url: "", secret: "", message: "Ask your administrator to connect the CRM Mail service and approve the shared sales address in Mail → Manage team." };
  }
  const target = new URL(dashboard.mailAuthUrl);
  target.pathname = "/api/crm-mail";
  return { ready: true as const, url: target.toString(), secret, message: "" };
}
