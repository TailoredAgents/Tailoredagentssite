import Link from "next/link";
import { ArrowRight, CalendarClock, Check, LayoutGrid, ListFilter, LockKeyhole, Sparkles, Upload } from "lucide-react";
import type { ReactNode } from "react";

export function SalesHeader({ title, subtitle, active, children }: { title: string; subtitle: string; active: "pipeline" | "today" | "mockups" | "imports"; children?: ReactNode }) {
  const tabs = [
    { key: "pipeline", href: "/dashboard/sales", label: "Pipeline", icon: LayoutGrid },
    { key: "today", href: "/dashboard/sales/today", label: "My day", icon: CalendarClock },
    { key: "mockups", href: "/dashboard/sales/mockups", label: "Mockups", icon: Sparkles },
    { key: "imports", href: "/dashboard/sales/imports", label: "Calling lists", icon: Upload },
  ] as const;
  return <>
    <header className="dashboard-topbar"><div><span>Tailored Agents / Sales</span><strong>{title}</strong></div><span className="dashboard-secure"><LockKeyhole size={14} />Private workspace</span></header>
    <div className="sales-page-heading"><div><span className="sales-eyebrow">Your next client starts here</span><h1>{title}</h1><p>{subtitle}</p></div>{children ? <div className="sales-heading-actions">{children}</div> : null}</div>
    <nav className="sales-tabs" aria-label="Sales workspace">{tabs.map(({ key, href, label, icon: Icon }) => <Link key={key} href={href} className={active === key ? "is-active" : ""} aria-current={active === key ? "page" : undefined}><Icon size={16} />{label}</Link>)}</nav>
  </>;
}

export function SalesEmpty({ title, children, href, linkLabel }: { title: string; children?: ReactNode; href?: string; linkLabel?: string }) {
  return <div className="sales-empty"><span><ListFilter size={23} /></span><h3>{title}</h3>{children ? <p>{children}</p> : null}{href ? <Link href={href}>{linkLabel || "Open pipeline"}<ArrowRight size={15} /></Link> : null}</div>;
}

export function SalesPanel({ title, eyebrow, children, action, className = "" }: { title: string; eyebrow?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`dashboard-panel sales-panel ${className}`}><div className="sales-panel-heading"><div>{eyebrow ? <span className="sales-eyebrow">{eyebrow}</span> : null}<h2>{title}</h2></div>{action}</div>{children}</section>;
}

export function SalesMetric({ label, value, detail, tone = "default" }: { label: string; value: ReactNode; detail: string; tone?: "default" | "teal" | "blue" }) {
  return <article className={`sales-metric sales-metric-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

export function SalesStatus({ children, value }: { children: ReactNode; value: string }) {
  return <span className={`sales-status sales-status-${value}`}><i />{children}</span>;
}

export function SalesReadOnly({ disabled }: { disabled: boolean }) {
  return disabled ? <p className="sales-inline-note"><LockKeyhole size={15} />You have read-only access to this workspace.</p> : null;
}

export function SalesComplete({ children }: { children: ReactNode }) {
  return <div className="sales-complete"><span><Check size={18} /></span><div>{children}</div></div>;
}

export function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
}

export function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}
