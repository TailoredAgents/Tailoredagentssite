"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  ChevronDown,
  Gauge,
  Globe2,
  FolderKanban,
  LogOut,
  Search,
  Settings,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { dashboardAuthClient } from "@/lib/dashboard/auth-client";
import type { DashboardContext } from "@/lib/dashboard/data";

const navigation = [
  { label: "Overview", href: "/dashboard", icon: Gauge },
  { label: "Leads", href: "/dashboard/leads", icon: UsersRound },
  { label: "Clients", href: "/dashboard/clients", icon: Building2 },
  { label: "Projects", href: "/dashboard/projects", icon: FolderKanban },
  { label: "Sites", href: "/dashboard/sites", icon: Globe2 },
  { label: "Analytics", icon: BarChart3, phase: "Phase 3" },
  { label: "SEO workspace", icon: Search, phase: "Phase 5" },
] as const;

const supportNavigation = [
  { label: "Activity", href: "/dashboard/activity", icon: Activity },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
] as const;

export function DashboardNavigation({ context }: { context: DashboardContext }) {
  const pathname = usePathname();
  const initials = context.user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TA";

  async function signOut() {
    await dashboardAuthClient.signOut();
    window.location.assign("/sign-in");
  }

  function isCurrent(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-sidebar-brand">
        <Link href="/" className="dashboard-brand" aria-label="Tailored Agents website">
          <span className="brand-mark" aria-hidden="true" />
          <span>TAILORED AGENTS</span>
        </Link>
        <span className="dashboard-environment">Internal</span>
      </div>

      <div className="dashboard-workspace">
        <span>Workspace</span>
        <button type="button" aria-label={`${context.workspace.name} workspace selected`}>
          <i>TA</i>
          <strong>{context.workspace.name}</strong>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>

      <nav className="dashboard-nav" aria-label="Dashboard navigation">
        <span className="dashboard-nav-label">Workspace</span>
        {navigation.map((item) => {
          const Icon = item.icon;
          if (!("href" in item)) {
            return (
              <span className="dashboard-nav-item is-planned" key={item.label} aria-disabled="true">
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
                <small>{item.phase}</small>
              </span>
            );
          }
          return (
            <Link className={`dashboard-nav-item ${isCurrent(item.href) ? "is-current" : ""}`} href={item.href} key={item.label}>
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <span className="dashboard-nav-label dashboard-nav-label-support">System</span>
        {supportNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link className={`dashboard-nav-item ${isCurrent(item.href) ? "is-current" : ""}`} href={item.href} key={item.label}>
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="dashboard-agent-note">
        <Sparkles size={16} aria-hidden="true" />
        <span><strong>SEO agent comes later</strong><small>Data and operating workflows first.</small></span>
      </div>

      <div className="dashboard-user">
        <span className="dashboard-avatar">{initials}</span>
        <span className="dashboard-user-copy"><strong>{context.user.name}</strong><small>{context.role}</small></span>
        <button type="button" onClick={signOut} aria-label="Sign out"><LogOut size={16} /></button>
      </div>
    </aside>
  );
}
