export type PricingPlan = {
  name: string;
  kicker: string;
  price: string;
  pricePrefix?: string;
  billing?: string;
  setup?: string;
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
    setup: "$350 one-time SEO Foundation Setup",
    description: "A practical baseline for a local business that wants consistent oversight and a measured improvement cadence.",
    features: [
      "Technical and on-page monitoring",
      "Google Business Profile guidance",
      "Search and website analytics",
      "One prioritized improvement each month",
      "Plain-language monthly summary",
    ],
    note: "Month to month after setup. Cancel before the next billing cycle with no long-term SEO commitment.",
    href: "/contact",
    cta: "Discuss SEO Essentials",
    featured: true,
  },
  {
    name: "SEO Growth",
    kicker: "A stronger monthly cadence",
    price: "$650",
    billing: "per month",
    setup: "$500 one-time SEO Foundation Setup",
    description: "More active optimization for businesses competing across important services, locations, or local search opportunities.",
    features: [
      "Everything in SEO Essentials",
      "More active page optimization",
      "Local rank and competitor analysis",
      "Content recommendations and improvements",
      "Conversion measurement",
      "Monthly planning and reporting",
    ],
    note: "Month to month after setup. Multi-location and content-heavy campaigns are scoped separately.",
    href: "/contact",
    cta: "Discuss SEO Growth",
  },
] as const satisfies readonly PricingPlan[];

export const foundingAgentPlans = [
  {
    name: "Website Chat Assistant",
    kicker: "Founding-client rollout",
    price: "$99",
    billing: "per month",
    setup: "$0 setup for a standard deployment",
    description: "A managed website assistant configured around approved business knowledge, common questions, and the brand's preferred voice.",
    features: [
      "Business-specific knowledge base",
      "Custom greeting and response tone",
      "Answers to approved common questions",
      "Standard inquiry capture",
      "Managed knowledge updates",
    ],
    note: "Limited founding-client availability. Final fit, content readiness, usage boundaries, and supported website environment are confirmed before billing.",
    href: "/contact",
    cta: "Ask about founding access",
  },
  {
    name: "Lead Qualification Assistant",
    kicker: "Founding-client rollout",
    price: "$149",
    billing: "per month",
    setup: "$0 setup for a standard deployment",
    description: "A website assistant that can gather useful lead context, apply approved qualification questions, and prepare a clearer team handoff.",
    features: [
      "Everything in Website Chat Assistant",
      "Approved qualification questions",
      "Structured lead summaries",
      "Routing and escalation rules",
      "Booking or contact handoff",
    ],
    note: "Limited founding-client availability. Complex routing, CRM writes, regulated workflows, and nonstandard integrations require a tailored scope.",
    href: "/contact",
    cta: "Ask about founding access",
    featured: true,
  },
  {
    name: "Lead Follow-Up Agent",
    kicker: "Founding-client rollout",
    price: "$199",
    billing: "per month + messaging usage",
    setup: "$0 setup for a standard deployment",
    description: "A bounded follow-up agent for new inquiries, missed opportunities, or estimate reminders using an approved sequence and escalation path.",
    features: [
      "One approved follow-up sequence",
      "Defined timing and stop conditions",
      "Human handoff for replies and exceptions",
      "Activity and outcome summary",
      "Managed refinement",
    ],
    note: "Limited founding-client availability. Messaging fees, consent requirements, integrations, and volume are confirmed before launch.",
    href: "/contact",
    cta: "Ask about founding access",
  },
  {
    name: "AI Phone Receptionist",
    kicker: "Founding-client rollout",
    price: "$299",
    billing: "per month + voice usage",
    setup: "$0 setup for a standard configuration",
    description: "A managed phone agent for common inbound calls, structured intake, appointment requests, and escalation to the right person.",
    features: [
      "Approved call flows and business answers",
      "Caller intent and contact capture",
      "Message, booking, or transfer handoff",
      "Exception and escalation rules",
      "Call activity summary",
    ],
    note: "Limited founding-client availability. Phone numbers, minutes, transfers, recordings, integrations, and compliance requirements affect usage and scope.",
    href: "/contact",
    cta: "Ask about founding access",
  },
] as const satisfies readonly PricingPlan[];

export const customAutomationPlans = [
  {
    name: "Focused Workflow",
    kicker: "One defined outcome",
    pricePrefix: "From",
    price: "$650",
    billing: "one-time",
    description: "A deliberately bounded automation that connects an existing process, removes a repeated step, or improves a specific handoff.",
    features: [
      "One clearly defined workflow",
      "Connection between supported tools",
      "Business rules and exception mapping",
      "Implementation and testing",
      "Handoff documentation",
    ],
    note: "The starting price applies to focused workflows using supported tools, available access, and a clearly bounded responsibility.",
    href: "/contact",
    cta: "Discuss a workflow",
  },
  {
    name: "Custom Agent System",
    kicker: "Advanced or connected scope",
    price: "Tailored proposal",
    billing: "implementation + monthly support and usage",
    description: "For advanced agents, multi-step operations, broader integrations, internal applications, customer portals, or purpose-built software.",
    features: [
      "Custom agent responsibilities and tools",
      "Multi-system workflows and interfaces",
      "Approval and escalation controls",
      "Operational testing and verification",
      "Phased implementation and support plan",
    ],
    note: "Implementation, support, included usage, outside software, and overages are defined after the objective, integrations, and operating risks are understood.",
    href: "/contact",
    cta: "Scope a custom system",
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
    label: "AI Agents & Business Automation",
    price: "$99/month",
    qualifier: "Founding-client agents from",
    note: "Standard website agents begin at $99 per month with $0 setup for a standard deployment. Custom workflows are scoped separately.",
    href: "/pricing#automation",
    cta: "Explore AI & automation",
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
    title: "AI Agents & Business Automation",
    summary: "Add website intelligence first, then expand into managed agents for calls, follow-up, customer communication, and repeatable operations.",
    detail: "Productized add-ons, custom integrations, human escalation, monitoring, and purpose-built systems.",
  },
] as const;
