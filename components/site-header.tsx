"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { siteConfig } from "@/lib/site";
import { BrandLogo } from "@/components/brand-logo";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="container-shell header-inner">
        <Link href="/" className="brand" aria-label="Tailored Agents home" onClick={() => setOpen(false)}>
          <BrandLogo />
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {siteConfig.nav.map((item) => {
            const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <Link className="nav-link" aria-current={current ? "page" : undefined} key={item.href} href={item.href}>{item.label}</Link>;
          })}
        </nav>
        <Link className="nav-cta" href="/free-review">Get a Free Review</Link>
        <button className="menu-button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Close menu" : "Open menu"}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <nav id="mobile-navigation" className={`mobile-menu ${open ? "open" : ""}`} aria-label="Mobile navigation">
        {siteConfig.nav.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        ))}
        <Link href="/free-review" onClick={() => setOpen(false)}>Get a Free Review<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </nav>
    </header>
  );
}
