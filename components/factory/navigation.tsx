import Link from "next/link";
import "@/app/dashboard/factory.css";

export function FactoryNavigation({ active = "projects" }: { active?: "projects" | "manual" | "settings" }) {
  return <nav className="factory-navigation" aria-label="Website Builder">
    <Link href="/dashboard/sales/factory" aria-current={active === "projects" ? "page" : undefined}>Website projects</Link>
    <Link href="/dashboard/sales/mockups" aria-current={active === "manual" ? "page" : undefined}>Manual mockups</Link>
    <Link href="/dashboard/sales/factory/settings" aria-current={active === "settings" ? "page" : undefined}>Builder settings</Link>
  </nav>;
}
