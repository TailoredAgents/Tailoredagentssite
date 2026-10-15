export const siteConfig = {
  name: "Tailored Agents",
  title: "Tailored Agents — Websites, Growth & Automation",
  description:
    "Premium website development, local SEO and analytics, and intelligent business automation for growing companies.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://tailoredagents.com",
  phone: "(561) 701-5127",
  phoneHref: "tel:+15617015127",
  nav: [
    { href: "/websites", label: "Websites" },
    { href: "/seo", label: "SEO & Analytics" },
    { href: "/automation", label: "Automation" },
    { href: "/work", label: "Our Work" },
    { href: "/company", label: "About" },
  ],
} as const;

export function absoluteUrl(path = "") {
  return new URL(path, siteConfig.url).toString();
}
