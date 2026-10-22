import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";
import { DashboardThemeProvider } from "@/components/dashboard/theme-provider";
import { dashboardTheme, dashboardThemeCookie } from "@/lib/dashboard/theme";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getVoiceWorkspace } from "@/lib/voice/data";
import type { VoiceWorkspace } from "@/lib/voice/types";
import { VoicePhoneProvider } from "@/components/voice/phone-provider";
import "./dashboard.css";
import "./inbox/voice.css";
import "./polish.css";
import "./theme.css";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s — Tailored Agents Dashboard" },
  description: "Private Tailored Agents operating workspace.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireDashboardContext();
  const theme = dashboardTheme((await cookies()).get(dashboardThemeCookie)?.value);
  const voice = await getVoiceWorkspace(context).catch((): VoiceWorkspace => ({ state: "unavailable", message: "Calling status could not be checked. Try again later.", canManage: false, lines: [], configuredPhone: null, grants: [], members: [] }));

  return (
    <DashboardThemeProvider initialTheme={theme}><VoicePhoneProvider workspace={voice} readOnly={context.role === "viewer"}><div className="dashboard-shell">
      <DashboardNavigation context={context} />
      <div className="dashboard-main">
        {context.role === "viewer" ? <p className="dashboard-readonly" role="status">You have view-only access. You can read reports and records. Ask an owner or administrator if you need to make changes.</p> : null}
        {children}
      </div>
    </div></VoicePhoneProvider></DashboardThemeProvider>
  );
}
