"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Building2,
  Gauge,
  Globe2,
  FolderKanban,
  LogOut,
  Menu,
  X,
  Mail,
  Settings,
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
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
] as const;

const supportNavigation = [
  { label: "Activity", href: "/dashboard/activity", icon: Activity },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
] as const;

export function DashboardNavigation({ context }: { context: DashboardContext }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const initials = context.user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TA";

  async function signOut() {
    setSigningOut(true);
    setSignOutError(false);
    try {
      const result = await dashboardAuthClient.signOut();
      if (result.error) throw new Error("Sign-out unavailable");
      window.location.assign("/sign-in");
    } catch {
      setSignOutError(true);
      setSigningOut(false);
    }
  }

  function isCurrent(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <aside className="dashboard-sidebar" onKeyDown={(event) => {
      if (event.key === "Escape" && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); }
    }}>
      <div className="dashboard-sidebar-brand">
        <Link href="/" className="dashboard-brand" aria-label="Tailored Agents website">
          <span className="brand-mark" aria-hidden="true" />
          <span>TAILORED AGENTS</span>
        </Link>
        <button ref={menuButton} type="button" className="dashboard-menu-toggle" aria-expanded={menuOpen} aria-controls="dashboard-navigation" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />} {menuOpen ? "Close menu" : "Menu"}
        </button>
      </div>

      <div className="dashboard-workspace">
        <span>Workspace</span>
        <div className="dashboard-workspace-current">
          <i>TA</i>
          <strong>{context.workspace.name}</strong>
        </div>
      </div>

      <nav id="dashboard-navigation" className={`dashboard-nav ${menuOpen ? "is-open" : ""}`} aria-label="Dashboard navigation">
        <span className="dashboard-nav-label">Workspace</span>
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link className={`dashboard-nav-item ${isCurrent(item.href) ? "is-current" : ""}`} aria-current={isCurrent(item.href) ? "page" : undefined} onClick={() => setMenuOpen(false)} href={item.href} key={item.label}>
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <span className="dashboard-nav-label dashboard-nav-label-support">System</span>
        {supportNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link className={`dashboard-nav-item ${isCurrent(item.href) ? "is-current" : ""}`} aria-current={isCurrent(item.href) ? "page" : undefined} onClick={() => setMenuOpen(false)} href={item.href} key={item.label}>
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <a className="dashboard-mail-link" href="https://mail.tailoredagents.com" target="_blank" rel="noreferrer"><Mail size={18} aria-hidden="true" />Open email<span className="sr-only"> (new tab)</span></a>
      <div className="dashboard-user">
        <span className="dashboard-avatar">{initials}</span>
        <span className="dashboard-user-copy"><strong>{context.user.name}</strong><small>{context.role}</small></span>
        <button type="button" onClick={signOut} disabled={signingOut} aria-label={signingOut ? "Signing out" : "Sign out"} title="Sign out"><LogOut size={20} /></button>
      </div>
      {signOutError ? <p className="dashboard-form-message is-error" role="alert">Could not sign out. Please try again.</p> : null}
    </aside>
  );
}
