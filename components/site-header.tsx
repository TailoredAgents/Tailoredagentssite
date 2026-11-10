"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/lib/site";
import { BrandLogo } from "@/components/brand-logo";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1101px)");
    const resize = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    desktop.addEventListener("change", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      desktop.removeEventListener("change", resize);
    };
  }, [open]);

  return (
    <header ref={headerRef} className="site-header" onKeyDown={(event) => {
      if (event.key === "Escape" && open) { setOpen(false); menuRef.current?.focus(); }
    }} onBlur={(event) => {
      if (open && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
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
        <Link className="nav-cta" href="/contact">Let’s talk</Link>
        <button ref={menuRef} type="button" className="menu-button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Close menu" : "Open menu"}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <nav id="mobile-navigation" className={`mobile-menu ${open ? "open" : ""}`} aria-label="Mobile navigation">
        {siteConfig.nav.map((item) => (
          <Link key={item.href} href={item.href} aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined} onClick={() => setOpen(false)}>{item.label}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        ))}
        <Link href="/contact" onClick={() => setOpen(false)}>Let’s talk<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </nav>
    </header>
  );
}
