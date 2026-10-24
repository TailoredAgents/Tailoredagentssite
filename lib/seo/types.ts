export type SeoSnapshot = {
  path: string;
  url: string;
  status: number;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  h1: string[];
  headings: string[];
  text: string;
  links: string[];
  issues: string[];
  fingerprint: string;
};
export type SeoManager = {
  site_id: string;
  workspace_id: string;
  enabled: boolean;
  ai_enabled: boolean;
  pilot_enabled: boolean;
  ai_reviewed_at: Date | null;
  last_worker_success_at: Date | null;
  monthly_limit_micros: string;
  local_markets: string[];
  keywords: string[];
  instructions: string;
  profile_reviewed_at: Date | null;
  last_worker_at: Date | null;
};
export type SeoRun = {
  id: string;
  workspace_id: string;
  site_id: string;
  kind: string;
  status: string;
  stage: string;
  schedule_key: string;
  context: Record<string, unknown>;
  result: Record<string, unknown>;
  error_code: string | null;
  lease_token: string | null;
  created_at: Date;
  finished_at: Date | null;
};
export type SeoChange = {
  id: string;
  workspace_id: string;
  site_id: string;
  run_id: string;
  path: string;
  title: string;
  description: string;
  rationale: string;
  evidence: { path: string; quote: string }[];
  baseline: SeoSnapshot;
  review: { approved: boolean; reason: string } | null;
  status: string;
  version: number;
  previous_change_id: string | null;
  created_at: Date;
  published_at: Date | null;
  verified_at: Date | null;
  evaluation_due_at: Date | null;
  baseline_metrics: unknown;
  outcome: unknown;
};
export class SeoInputError extends Error {}
export class SeoAccessError extends Error {}
export class SeoBudgetError extends Error {}
