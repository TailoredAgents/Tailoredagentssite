import type { FactoryBuildStage } from "./build-types";

// Only these worker-owned milestones may be shown outside private build data.
export const buildActivities = {
  generating: { stage: "generate", label: "Designing and writing the website pages" },
  supplied_image: { stage: "images", label: "Preparing your supplied image" },
  generating_image: { stage: "images", label: "Creating the website imagery" },
  preparing: { stage: "qa", label: "Preparing responsive pages and optimized images" },
  browser_checks: { stage: "qa", label: "Checking desktop and mobile pages" },
  design_review: { stage: "qa", label: "Reviewing the design and content" },
  repairing: { stage: "qa", label: "Applying corrections from the quality review" },
  rechecking: { stage: "qa", label: "Rechecking the corrected pages" },
  saving: { stage: "qa", label: "Saving the checked pages and screenshots" },
  publishing: { stage: "publish", label: "Publishing the preview and packaging the source files" },
  verifying: { stage: "verify", label: "Verifying the live preview and its files" },
} as const satisfies Record<string, { stage: FactoryBuildStage; label: string }>;

export type FactoryBuildActivityStep = keyof typeof buildActivities;
export type FactoryBuildActivity = { stage: FactoryBuildStage; step: FactoryBuildActivityStep; startedAt: string };

export function readBuildActivity(value: unknown, stage: FactoryBuildStage): FactoryBuildActivity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const activity = value as Record<string, unknown>;
  if (typeof activity.step !== "string" || !Object.hasOwn(buildActivities, activity.step)) return null;
  const step = activity.step as FactoryBuildActivityStep;
  if (activity.stage !== stage || buildActivities[step].stage !== stage || typeof activity.startedAt !== "string" || !Number.isFinite(Date.parse(activity.startedAt))) return null;
  return { stage, step, startedAt: new Date(activity.startedAt).toISOString() };
}
