"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarCheck2,
  Columns3,
  Gauge,
  Inbox,
  Globe2,
  FolderKanban,
  LogOut,
  Menu,
  X,
  Mail,
  NotebookPen,
  Settings,
  Sparkles,
  UsersRound,
  PanelsTopLeft,
  ContactRound,
} from "lucide-react";
import { dashboardAuthClient } from "@/lib/dashboard/auth-client";
import type { DashboardContext } from "@/lib/dashboard/data";
import { PageFinder } from "./page-finder";
import { DashboardThemeSelect } from "./theme-provider";
import { nativeNotificationAction } from "@/lib/assistant/native-notifications";
import { BrowserPhoneLauncher } from "@/components/voice/phone-panel";
import { useBrowserPhone } from "@/components/voice/phone-provider";

const navigationGroups = [
  {
    label: "Daily work",
    items: [
      { label: "Overview", href: "/dashboard", icon: Gauge },
      { label: "Inbox", href: "/dashboard/inbox", icon: Inbox },
      { label: "Team calendar", href: "/dashboard/calendar", icon: CalendarCheck2 },
      { label: "My day", href: "/dashboard/sales/today", icon: CalendarCheck2 },
      { label: "Assistant", href: "/dashboard/assistant", icon: Sparkles },
    ],
  },
  {
    label: "Sales & prospects",
    items: [
      { label: "Prospects", href: "/dashboard/leads", icon: UsersRound },
      { label: "Meetings & notes", href: "/dashboard/meetings", icon: NotebookPen },
      { label: "Sales", href: "/dashboard/sales", icon: Columns3 },
      { label: "Website Builder", href: "/dashboard/sales/factory", icon: PanelsTopLeft },
      { label: "Partners", href: "/dashboard/partners", icon: UsersRound },
    ],
  },
  {
    label: "Clients & delivery",
    items: [
      { label: "Clients", href: "/dashboard/clients", icon: Building2 },
      { label: "Projects", href: "/dashboard/projects", icon: FolderKanban },
      { label: "Services", href: "/dashboard/services", icon: Activity },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Smart Cards", href: "/dashboard/smart-cards", icon: ContactRound },
      { label: "SEO manager", href: "/dashboard/seo", icon: Sparkles },
      { label: "Sites", href: "/dashboard/sites", icon: Globe2 },
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { label: "Activity", href: "/dashboard/activity", icon: Activity },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
] as const;

export function DashboardNavigation({ context }: { context: DashboardContext }) {
  const pathname = usePathname();
  const phone = useBrowserPhone();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => { nativeNotificationAction('sync'); }, [pathname, context.user.id]);
  useEffect(() => {
    const container = navigation.current;
    const active = container?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!container || !active || window.innerWidth <= 1024) return;
    const bounds = container.getBoundingClientRect(), item = active.getBoundingClientRect();
    if (item.bottom > bounds.bottom) container.scrollTop += item.bottom - bounds.bottom + 8;
    else if (item.top < bounds.top) container.scrollTop -= bounds.top - item.top + 8;
  }, [pathname]);
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
      nativeNotificationAction('signOut');
      window.location.assign("/sign-in");
    } catch {
      setSignOutError(true);
      setSigningOut(false);
    }
  }

  function isCurrent(href: string) {
    if (href === "/dashboard/meetings" && pathname === "/dashboard/capture") return true;
    if (href === "/dashboard/sales/today" && pathname.startsWith("/dashboard/tasks/")) return true;
    if (href === "/dashboard/sales/factory" && pathname.startsWith("/dashboard/sales/mockups")) return true;
    if (href === "/dashboard/sales") {
      return pathname === href || (
        pathname.startsWith(`${href}/`) && !["today", "mockups", "imports", "factory"].includes(pathname.split("/")[3] ?? "")
      );
    }
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <aside className="dashboard-sidebar" onKeyDown={(event) => {
      if (event.key === "Escape" && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); }
    }}>
      <div className="dashboard-sidebar-brand">
        <Link href="/" className="dashboard-brand" aria-label="Tailored Agents website">
          <span><BrandLogo dark compact /></span>
        </Link>
        <div className="dashboard-mobile-tools"><BrowserPhoneLauncher compact onOpen={() => setMenuOpen(false)} />
        <button ref={menuButton} type="button" className="dashboard-menu-toggle" aria-label={menuOpen ? "Close menu" : "Menu"} aria-expanded={menuOpen} aria-controls="dashboard-navigation" onClick={() => { if (!menuOpen) phone.setExpanded(false); setMenuOpen(!menuOpen); }}>
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}<span className="dashboard-menu-label">{menuOpen ? "Close menu" : "Menu"}</span>
        </button>
        </div>
      </div>

      <div className="dashboard-workspace">
        <div className="dashboard-workspace-current">
          <i>TA</i>
          <div><strong>{context.workspace.name}</strong></div>
        </div>
      </div>

      <PageFinder destinations={navigationGroups.flatMap(group => group.items.map(item => ({ label: item.label, href: item.href, group: group.label })))} />
      <nav ref={navigation} id="dashboard-navigation" className={`dashboard-nav ${menuOpen ? "is-open" : ""}`} aria-label="Dashboard navigation">
        {navigationGroups.map((group) => <div className="dashboard-nav-group" key={group.label}>
          <span className="dashboard-nav-label">{group.label}</span>
          <div className="dashboard-nav-links">{group.items.map((item) => {
            const Icon = item.icon;
            return <Link className={`dashboard-nav-item ${isCurrent(item.href) ? "is-current" : ""}`} aria-current={isCurrent(item.href) ? "page" : undefined} onClick={() => setMenuOpen(false)} href={item.href} key={item.label}>
              <Icon size={18} aria-hidden="true" /><span>{item.label}</span>
            </Link>;
          })}</div>
        </div>)}
      </nav>

      <DashboardThemeSelect />
      <div className="dashboard-utilities"><BrowserPhoneLauncher /><a className="dashboard-mail-link" href="https://mail.tailoredagents.com" target="_blank" rel="noreferrer"><Mail size={18} aria-hidden="true" /><span>Email<span className="sr-only"> (new tab)</span></span><ArrowUpRight size={14} aria-hidden="true" /></a></div>
      <div className="dashboard-user">
        <span className="dashboard-avatar">{initials}</span>
        <span className="dashboard-user-copy"><strong>{context.user.name}</strong><small>{context.role}</small></span>
        <button type="button" onClick={signOut} disabled={signingOut} aria-label={signingOut ? "Signing out" : "Sign out"} title="Sign out"><LogOut size={20} /></button>
      </div>
      {signOutError ? <p className="dashboard-form-message is-error" role="alert">Could not sign out. Please try again.</p> : null}
    </aside>
  );
}
