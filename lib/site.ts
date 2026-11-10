import type { Metadata } from "next";

export const siteConfig = {
  name: "Tailored Agents",
  title: "Tailored Agents — Custom AI & Business Automation",
  description:
    "Georgia-based custom AI agents, business automation and software. We connect your systems, simplify repetitive work and build around how your business operates.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://www.tailoredagents.com",
  phone: "(678) 541-7725",
  phoneHref: "tel:+16785417725",
  nav: [
    { href: "/solutions", label: "Solutions" },
    { href: "/automation", label: "AI & Automation" },
    { href: "/work", label: "Our Work" },
    { href: "/partners", label: "Partnerships" },
    { href: "/pricing", label: "Pricing" },
    { href: "/company", label: "About" },
  ],
} as const;

export function absoluteUrl(path = "") {
  return new URL(path, siteConfig.url).toString();
}

/** Explicit social fields keep each page's link preview aligned with its copy. */
export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  const socialTitle = `${title} — Tailored Agents`;
  const images = [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: "Tailored Agents — Custom AI built around your business" }];
  return {
    title, description, alternates: { canonical: path },
    openGraph: { type: "website", siteName: siteConfig.name, title: socialTitle, description, url: absoluteUrl(path), images },
    twitter: { card: "summary_large_image", title: socialTitle, description, images },
  };
}
