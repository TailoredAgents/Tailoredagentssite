import type { FactoryProjectSummary } from "./types";

export const factoryViews = { review: "Needs review", building: "Building", ready: "Ready to share", attention: "Needs attention" } as const;
export function factoryProjectView(project: FactoryProjectSummary): keyof typeof factoryViews {
  // A new research/revision request takes precedence over an older finished website.
  if (project.status === "failed") return "attention";
  if (["draft", "research_queued", "researching", "plan_ready"].includes(project.status)) return "review";
  if (["failed", "cancelled"].includes(project.latestBuild?.status || "")) return "attention";
  if (project.latestBuild?.status === "ready") return project.latestBuild.previewUrl ? "ready" : "attention";
  return "building";
}

export function factoryBuildRecovery(error: string | null) {
  if (/three allowed requests|approve a new version/i.test(error || ""))
    return {kind:"plan",summary:"This version needs a revised plan. Open Plan & project history, discuss the changes, then review and approve the new plan."} as const;
  if (/needs another revision after its included repair/i.test(error || ""))
    return {kind:"help",summary:"Quality checks still found issues after the included correction. An administrator can review the details and recheck after a technical fix. If the design needs a new direction, revise the plan instead."} as const;
  if (/did not pass validation|invalid website structure|unreadable website data|adjust this request|exceeded its.*limit/i.test(error || ""))
    return {kind:"help",summary:"The builder needs a technical fix before continuing. Ask your administrator to review the error details below; retrying alone will not fix this."} as const;
  return {kind:"retry",summary:"The build stopped before finishing. Your plan and completed previews are saved. Review the error details before retrying; if it repeats, ask your administrator for help."} as const;
}
