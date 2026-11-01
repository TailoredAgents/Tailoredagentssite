export const siteConfig = {
  name: "Tailored Agents",
  title: "Tailored Agents — Websites, Growth & Automation",
  description:
    "Premium website development, local SEO and analytics, and tailored AI agents and automation for growing companies.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://www.tailoredagents.com",
  phone: "(678) 541-7725",
  phoneHref: "tel:+16785417725",
  nav: [
    { href: "/websites", label: "Websites" },
    { href: "/seo", label: "SEO & Analytics" },
    { href: "/automation", label: "AI & Automation" },
    { href: "/packages", label: "Packages" },
    { href: "/pricing", label: "Pricing" },
    { href: "/work", label: "Our Work" },
    { href: "/company", label: "About" },
  ],
} as const;

export function absoluteUrl(path = "") {
  return new URL(path, siteConfig.url).toString();
}
