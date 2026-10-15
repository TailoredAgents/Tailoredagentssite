export const servicePricing = {
  websites: {
    label: "Website Design & Development",
    price: "$2,500",
    qualifier: "Starting at",
    note: "Project scope determines the final proposal.",
  },
  seo: {
    label: "Managed Local SEO & Analytics",
    price: "$750/month",
    qualifier: "Starting at",
    note: "Monthly scope is based on markets, locations, and priorities.",
  },
  automation: {
    label: "Business Automation & Custom Software",
    price: "Custom proposal",
    qualifier: "Scoped around the opportunity",
    note: "Focused automations and larger systems are proposed separately.",
  },
} as const;

export const coreServices = [
  {
    key: "websites",
    href: "/websites",
    title: "Website Design & Development",
    summary: "Premium, responsive websites built to establish credibility, make services easy to understand, and turn interest into clear next steps.",
    detail: "Strategy, design, development, performance, accessibility, foundational SEO, and inquiry flows.",
  },
  {
    key: "seo",
    href: "/seo",
    title: "Local SEO & Growth Analytics",
    summary: "Ongoing visibility work grounded in technical health, local search signals, useful content, conversion measurement, and transparent reporting.",
    detail: "Monitoring, analysis, prioritized improvements, local visibility support, and human-reviewed recommendations.",
  },
  {
    key: "automation",
    href: "/automation",
    title: "Business Automation & AI",
    summary: "Targeted systems that improve lead follow-up, customer communication, scheduling, information flow, and repetitive operational work.",
    detail: "Integrations, workflow automation, AI-assisted tools, and purpose-built business applications.",
  },
] as const;
