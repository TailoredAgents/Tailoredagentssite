export class FactoryAccessError extends Error {}
export class FactoryInputError extends Error {}
/** Concrete renderer choices approved with a plan; absent on historical plans. */
export type FactoryDesignRecipe = {
  version: 1;
  family: import("./site/types").DesignFamilyId;
  composition: import("./site/types").HeroComposition;
  fontTheme: "studio" | "editorial" | "warm" | "technical";
  density: "compact" | "balanced" | "airy";
  radius: "square" | "soft" | "rounded";
};
export type FactoryPlanContent = {
  summary: string; goal: string; audience: string;
  knownDetails: Array<{ label: string; value: string; basis: "submitted" | "sourced" | "possible_match" | "assumption"; sourceIds: string[] }>;
  uncertainties: string[]; assumptions: string[];
  pages: Array<{ title: string; purpose: string; sections: string[] }>;
  callsToAction: string[];
  design: { direction: string; palette: string[]; typography: string; imagery: string; recipe?: FactoryDesignRecipe | null };
  previewFeatures: string[]; productionIntegrations: string[];
  sources: Array<{ id: string; title: string; url: string; retrievedAt: string; evidence: string }>;
};
export type FactoryActionState = { status: "idle" | "success" | "error"; message?: string; projectId?: string };
export type FactorySettings = { researchEnabled: boolean; autoResearch: boolean; monthlyBudgetMicros: number; budgetApprovedAt: string | null };
export type FactoryProjectSummary = {
  id: string; leadId: string; leadName: string; companyName: string;
  status: "draft" | "research_queued" | "researching" | "plan_ready" | "approved" | "failed";
  currentPlanId: string | null; currentPlanVersion: number | null; createdAt: string; updatedAt: string;
  latestBuild?: {id:string;status:import("./build-types").FactoryBuildStatus;previewUrl:string|null;version:number}|null;
};
export type FactoryMessage = { id: string; role: "user" | "assistant"; body: string; referenceUrls: string[]; authorName: string | null; createdAt: string };
export type FactoryPlan = { id: string; version: number; content: FactoryPlanContent; changeSummary: string; createdAt: string };
export type FactoryJob = { id: string; kind: "research" | "revision"; status: "queued" | "running" | "succeeded" | "failed" | "cancelled"; stage: "research" | "plan"; error: string | null; createdAt: string; finishedAt: string | null };
export type FactoryBuildRequest = { id: string; planId: string; planVersion: number; approvedByName: string | null; approvedAt: string; status: "awaiting_builder"|"queued"|"building"|"ready"|"failed"|"cancelled" };
export type FactoryWorkspace = { settings: FactorySettings; canManage: boolean; canEdit: boolean; monthSpentMicros: number; config: { configured: boolean; reason?: string }; projects: FactoryProjectSummary[] };
export type FactoryProjectWorkspace = Omit<FactoryWorkspace, "projects"> & { project: FactoryProjectSummary; messages: FactoryMessage[]; plans: FactoryPlan[]; jobs: FactoryJob[]; buildRequests: FactoryBuildRequest[] };
