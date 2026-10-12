export const siteConfig = {
  name: "Tailored Agents",
  title: "Tailored Agents — AI Engineering & Custom Software",
  description:
    "Custom AI agents, intelligent automation, and connected software systems designed around the way businesses actually operate.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://tailoredagents.com",
  nav: [
    { href: "/solutions", label: "Solutions" },
    { href: "/engineering", label: "Engineering" },
    { href: "/work", label: "Our Work" },
    { href: "/company", label: "Company" },
    { href: "/contact", label: "Contact" },
  ],
} as const;

export function absoluteUrl(path = "") {
  return new URL(path, siteConfig.url).toString();
}
