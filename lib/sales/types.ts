export const salesStages = [
  "prospect",
  "contacted",
  "interested",
  "discovery",
  "mockup",
  "proposal",
  "won",
  "lost",
  "archived",
] as const;
export type SalesStage = (typeof salesStages)[number];
export const stageLabels: Record<SalesStage, string> = {
  prospect: "Cold prospect",
  contacted: "Contacted",
  interested: "Interested",
  discovery: "Discovery",
  mockup: "Mockup",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
  archived: "Archived",
};
export const websiteStatuses = [
  "unknown",
  "none",
  "needs_redesign",
  "has_website",
] as const;
export const websiteStatusLabels: Record<string, string> = {
  unknown: "Not checked",
  none: "No website",
  needs_redesign: "Needs redesign",
  has_website: "Has website",
};
export const mockupStatuses = [
  "requested",
  "building",
  "review",
  "ready",
  "delivered",
] as const;
export const offerTypes = ["standard", "promotion", "custom"] as const;
export type SalesMember = { id: string; name: string; email: string };
export type SalesListOption = { id: string; name: string };
export type SalesBusiness = {
  id: string;
  name: string;
  websiteUrl: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  state: string | null;
  websiteStatus: string;
  score: number | null;
  researchUrl: string | null;
  researchNotes: string | null;
  anonymizedAt: string | null;
  updatedAt: string;
};
export type SalesContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
};
export type SalesTask = {
  id: string;
  opportunityId: string | null;
  businessName: string;
  opportunityTitle: string;
  ownerId: string | null;
  ownerName: string | null;
  kind: "follow_up" | "appointment";
  title: string;
  dueAt: string;
  endAt: string | null;
  location: string | null;
  notes: string | null;
  status: "open" | "completed" | "cancelled";
};
export type SalesActivity = {
  id: string;
  kind: string;
  source: string;
  direction: string;
  outcome: string | null;
  body: string;
  actorName: string | null;
  occurredAt: string;
};
export type SalesMockup = {
  id: string;
  opportunityId: string;
  businessName: string;
  opportunityTitle: string;
  ownerId: string | null;
  ownerName: string | null;
  status: (typeof mockupStatuses)[number];
  brief: string;
  previewUrl: string | null;
  repositoryUrl: string | null;
  projectPath: string | null;
  qaNotes: string | null;
  createdAt: string;
  updatedAt: string;
};
export type SalesOpportunity = {
  id: string;
  title: string;
  stage: SalesStage;
  valueCents: number | null;
  offerType: (typeof offerTypes)[number];
  source: string;
  ownerId: string | null;
  ownerName: string | null;
  business: SalesBusiness;
  contact: SalesContact | null;
  nextTask: { id: string; title: string; dueAt: string; kind: string } | null;
  mockupStatus: string | null;
  listNames: string[];
  clientId: string | null;
  projectId: string | null;
  leadId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};
export type SalesRecord = SalesOpportunity & {
  contacts: SalesContact[];
  tasks: SalesTask[];
  activities: SalesActivity[];
  mockup: SalesMockup | null;
  lists: SalesListOption[];
  members: SalesMember[];
  channelPreferences: {
    channel: string;
    address: string;
    status: string;
    evidence: string | null;
  }[];
};
export type SalesFilters = {
  q?: string | string[];
  stage?: string | string[];
  owner?: string | string[];
  list?: string | string[];
  page?: string | string[];
  view?: string | string[];
};
export type SalesWorkspace = {
  items: SalesOpportunity[];
  total: number;
  page: number;
  pages: number;
  q: string;
  stage: string;
  owner: string;
  list: string;
  view: "board" | "table";
  members: SalesMember[];
  lists: SalesListOption[];
  stageCounts: Record<string, number>;
  summary: {
    prospects: number;
    interested: number;
    open: number;
    won: number;
    pipelineValueCents: number;
    wonValueCents: number;
  };
  websiteInquiries: {
    id: string;
    name: string;
    organization: string;
    source: string;
    createdAt: string;
  }[];
};
export type SalesToday = {
  scope: "mine" | "team";
  members: SalesMember[];
  tasks: SalesTask[];
  appointments: SalesTask[];
  opportunities: SalesOpportunity[];
  mockups: SalesMockup[];
  stats: {
    assigned: number;
    interested: number;
    due: number;
    appointments: number;
    mockups: number;
  };
};
export type SalesList = SalesListOption & {
  source: string;
  createdAt: string;
  businesses: number;
  contacted: number;
  interested: number;
  appointments: number;
  mockups: number;
  won: number;
  wonValueCents: number;
};
