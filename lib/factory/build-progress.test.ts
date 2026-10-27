import { describe, expect, it } from "vitest";
import { readBuildActivity } from "./build-progress";

describe("public build activity", () => {
  const activity = { stage: "qa", step: "design_review", startedAt: "2026-10-27T18:00:00.000Z" };
  it("drops private data and ignores stale or invalid activities", () => {
    expect(readBuildActivity({ ...activity, prompt: "private", response: "private" }, "qa")).toEqual(activity);
    expect(readBuildActivity(activity, "publish")).toBeNull();
    expect(readBuildActivity({ ...activity, step: "generating" }, "qa")).toBeNull();
    expect(readBuildActivity({ ...activity, step: "constructor" }, "qa")).toBeNull();
    expect(readBuildActivity({ ...activity, startedAt: "invalid" }, "qa")).toBeNull();
    expect(readBuildActivity(undefined, "generate")).toBeNull();
  });
});
