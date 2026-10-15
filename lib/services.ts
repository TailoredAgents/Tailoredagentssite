export type PricingPlan = {
  name: string;
  kicker: string;
  price: string;
  pricePrefix?: string;
  billing?: string;
  description: string;
  features: readonly string[];
  note: string;
  href: string;
  cta: string;
  featured?: boolean;
};

export const websitePlans = [
  {
    name: "Launch Website",
    kicker: "Competitive starting point",
    price: "$1,500",
    billing: "one-time",
    description: "A focused, professional website for a business that needs a credible presence and a clear path to inquiry.",
    features: [
      "Up to five essential pages",
      "Responsive design and development",
      "Standard inquiry form",
      "Foundational SEO and analytics",
      "One consolidated revision round",
      "Deployment assistance",
    ],
    note: "Client provides the core copy, logo, and photography. Additional content and functionality can be scoped separately.",
    href: "/free-review",
    cta: "Start with a free review",
    featured: true,
  },
  {
    name: "Custom Growth Website",
    kicker: "Expanded business presence",
    pricePrefix: "From",
    price: "$2,250",
    billing: "one-time",
    description: "A more expansive website for an established business with multiple services, stronger content needs, or a more tailored customer journey.",
    features: [
      "Expanded page and service structure",
      "More original visual direction",
      "Content and conversion planning",
      "Booking or third-party connections",
      "Two consolidated revision rounds",
      "Enhanced analytics and SEO foundations",
    ],
    note: "The final price reflects page count, content responsibilities, integrations, and the functionality confirmed in the written scope.",
    href: "/free-review",
    cta: "Request a free review",
  },
  {
    name: "Advanced Website",
    kicker: "Custom functionality",
    pricePrefix: "From",
    price: "$4,000",
    billing: "one-time",
    description: "A larger or more technical engagement for businesses that need commerce, customer tools, advanced integrations, or custom workflows.",
    features: [
      "Custom page and content architecture",
      "Ecommerce or advanced forms",
      "Customer-facing tools or portals",
      "Business-system integrations",
      "Advanced measurement requirements",
      "Individually planned delivery",
    ],
    note: "Advanced projects are estimated after the operating requirements and technical boundaries are understood.",
    href: "/contact",
    cta: "Discuss the project",
  },
] as const satisfies readonly PricingPlan[];

export const seoPlans = [
  {
    name: "SEO Essentials",
    kicker: "Maintain the foundations",
    price: "$400",
    billing: "per month",
    description: "A practical baseline for a local business that wants consistent oversight and a measured improvement cadence.",
    features: [
      "Technical and on-page monitoring",
      "Google Business Profile guidance",
      "Search and website analytics",
      "One prioritized improvement each month",
      "Plain-language monthly summary",
    ],
    note: "Begins with a three-month initial engagement, then continues month to month.",
    href: "/contact",
    cta: "Discuss SEO Essentials",
    featured: true,
  },
  {
    name: "SEO Growth",
    kicker: "A stronger monthly cadence",
    price: "$650",
    billing: "per month",
    description: "More active optimization for businesses competing across important services, locations, or local search opportunities.",
    features: [
      "Everything in SEO Essentials",
      "More active page optimization",
      "Local rank and competitor analysis",
      "Content recommendations and improvements",
      "Conversion measurement",
      "Monthly planning and reporting",
    ],
    note: "Begins with a three-month initial engagement. Multi-location and content-heavy campaigns are scoped separately.",
    href: "/contact",
    cta: "Discuss SEO Growth",
  },
] as const satisfies readonly PricingPlan[];

export const automationPlans = [
  {
    name: "Focused Workflow",
    kicker: "Start with one outcome",
    pricePrefix: "From",
    price: "$650",
    billing: "one-time",
    description: "A deliberately bounded automation that connects an existing process, removes a repeated step, or improves a specific handoff.",
    features: [
      "One clearly defined workflow",
      "Connection between existing tools",
      "Business rules and exception mapping",
      "Implementation and testing",
      "Handoff documentation",
    ],
    note: "The starting price applies to focused workflows using supported tools and clearly available access.",
    href: "/contact",
    cta: "Discuss a workflow",
    featured: true,
  },
  {
    name: "Connected Systems & Software",
    kicker: "Broader operational scope",
    price: "Tailored proposal",
    description: "For larger integrations, AI-assisted workflows, internal applications, customer portals, or purpose-built software.",
    features: [
      "Multi-system integrations",
      "Custom interfaces and applications",
      "Data movement and review controls",
      "Operational testing and verification",
      "Phased implementation planning",
    ],
    note: "We define the objective, boundaries, dependencies, and verification approach before proposing the work.",
    href: "/contact",
    cta: "Scope an opportunity",
  },
] as const satisfies readonly PricingPlan[];

export const servicePricing = {
  websites: {
    label: "Website Design & Development",
    price: "$1,500",
    qualifier: "Starting at",
    note: "A focused five-page Launch Website with responsive development, inquiry handling, and search foundations.",
    href: "/pricing#websites",
    cta: "View website packages",
  },
  seo: {
    label: "Managed Local SEO & Analytics",
    price: "$400/month",
    qualifier: "Starting at",
    note: "Consistent technical oversight, local visibility guidance, analytics, and one prioritized monthly improvement.",
    href: "/pricing#seo",
    cta: "View SEO packages",
  },
  automation: {
    label: "Business Automation & Custom Software",
    price: "$650",
    qualifier: "Focused workflows from",
    note: "Start with one bounded workflow. Larger integrations and custom software receive a tailored proposal.",
    href: "/pricing#automation",
    cta: "View automation pricing",
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
