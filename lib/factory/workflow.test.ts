import { describe, expect, it } from "vitest";
import { factoryBuildRecovery, factoryProjectView } from "./workflow";
import type { FactoryProjectSummary } from "./types";

const project: FactoryProjectSummary = {
  id: "project", leadId: "lead", leadName: "A person", companyName: "", status: "approved",
  currentPlanId: "plan", currentPlanVersion: 1, createdAt: "", updatedAt: "",
  latestBuild: { id: "build", version: 1, status: "ready", previewUrl: "https://example.test/preview" },
};
describe("salesperson website workflow", () => {
  it("shows newly revised plans before an older completed website", () => {
    for (const status of ["draft", "research_queued", "researching", "plan_ready"] as const)
      expect(factoryProjectView({ ...project, status })).toBe("review");
    expect(factoryProjectView(project)).toBe("ready");
  });
  it("requires an accessible preview before calling a project ready to share", () => {
    expect(factoryProjectView({ ...project, latestBuild: { ...project.latestBuild!, previewUrl: null } })).toBe("attention");
    expect(factoryProjectView({ ...project, status: "failed" })).toBe("attention");
    for (const status of ["failed", "cancelled"] as const)
      expect(factoryProjectView({ ...project, latestBuild: { ...project.latestBuild!, status } })).toBe("attention");
    for (const status of ["queued", "running"] as const)
      expect(factoryProjectView({ ...project, latestBuild: { ...project.latestBuild!, status, previewUrl: null } })).toBe("building");
    expect(factoryProjectView({ ...project, latestBuild: null })).toBe("building");
  });
  it("directs exhausted revisions and invalid output away from blind retries", () => {
    expect(factoryBuildRecovery("This website needs another revision after its included repair.").kind).toBe("plan");
    expect(factoryBuildRecovery("The builder used its three allowed requests; approve a new version.").kind).toBe("plan");
    expect(factoryBuildRecovery("Website did not pass validation.").kind).toBe("help");
    expect(factoryBuildRecovery("Image provider temporarily unavailable").kind).toBe("retry");
    expect(factoryBuildRecovery(null).kind).toBe("retry");
  });
});
