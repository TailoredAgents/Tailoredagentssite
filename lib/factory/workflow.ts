import type { FactoryProjectSummary } from "./types";
import { maximumReviewAttempts } from "./build-types";

export const factoryViews = { review: "Needs review", building: "Building", ready: "Ready to share", attention: "Needs attention" } as const;
export function factoryProjectView(project: FactoryProjectSummary): keyof typeof factoryViews {
  // A new research/revision request takes precedence over an older finished website.
  if (project.status === "failed") return "attention";
  if (["draft", "research_queued", "researching", "plan_ready"].includes(project.status)) return "review";
  if (["failed", "cancelled"].includes(project.latestBuild?.status || "")) return "attention";
  if (project.latestBuild?.status === "ready") return project.latestBuild.previewUrl ? "ready" : "attention";
  return "building";
}

export function factoryBuildRecovery(error: string | null, reviewAttempts = 0) {
  if(reviewAttempts>=maximumReviewAttempts&&/bounded automatic checks and corrections|correction did not resolve|automatic correction (?:could not|returned)|technical fix or a changed plan|needs another revision after its included repair|three allowed requests/i.test(error||""))
    return {kind:"plan",summary:"This version has used all three visual reviews. Another technical retry cannot review changed pages. Review the saved findings and draft; a checked draft revision shares the original allowance, or a changed direction needs a revised plan and exact approval."} as const;
  if (/previous correction request was interrupted|saved correction no longer matches/i.test(error || ""))
    return {kind:"help",summary:"This correction needs an administrator to check its saved result before continuing. Retrying will not safely recover it. Your saved draft and previous preview remain available."} as const;
  if (/remaining.*allowance|building is paused|budget.*approved/i.test(error || ""))
    return {kind:"help",summary:"An owner needs to review the builder settings or remaining allowance. Your completed work is saved; retrying cannot change the spending limit."} as const;
  if (/bounded automatic checks and corrections|correction did not resolve|automatic correction (?:could not|returned)|technical fix or a changed plan/i.test(error || ""))
    return {kind:"help",summary:"Automatic corrections could not finish this version. Review the saved findings and draft. Wording or layout can be edited there; a different direction needs a revised plan, and a system fault needs administrator help."} as const;
  if (/three allowed requests|approve a new version/i.test(error || ""))
    return {kind:"plan",summary:"This version needs a revised plan. Open Plan & project history, discuss the changes, then review and approve the new plan."} as const;
  if (/needs another revision after its included repair/i.test(error || ""))
    return {kind:"help",summary:"Quality checks still found issues after the included correction. An administrator can review the details and recheck after a technical fix. If the design needs a new direction, revise the plan instead."} as const;
  if (/did not pass validation|invalid website (?:structure|correction)|unreadable website (?:data|correction)|correction (?:did not finish|reached its response limit)|adjust this request|exceeded its.*limit/i.test(error || ""))
    return {kind:"help",summary:"The builder needs a technical fix before continuing. Ask your administrator to review the error details below; retrying alone will not fix this."} as const;
  return {kind:"retry",summary:"The build stopped before finishing. Your plan and completed previews are saved. Review the error details before retrying; if it repeats, ask your administrator for help."} as const;
}
