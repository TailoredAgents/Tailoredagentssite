import {describe,it,expect} from "vitest";
import {qualityCohortCases,qualityCohortManifest,qualityBaselineRevision,qualityCohortVersion} from "./quality-cohort";
import {validateBlueprintStructure} from "./validate";
import {reviewSiteDepth} from "./quality";
import {createHash} from "node:crypto";
import frozenManifest from "../../../docs/quality/cohort-2026-10-28-v1.json";

describe("Frozen quality cohort",()=>{
  it("keeps five tuning and five held-out cases with exact identities",()=>{
    const cases=qualityCohortCases();expect(cases.map(item=>item.id)).toEqual(qualityCohortManifest.map(item=>item.id));
    expect(qualityCohortManifest.filter(item=>item.split==="tuning")).toHaveLength(5);
    expect(qualityCohortManifest.filter(item=>item.split==="held-out")).toHaveLength(5);
    expect(new Set(qualityCohortManifest.map(item=>item.industry)).size).toBe(5);
    expect(qualityCohortVersion).toBe("2026-10-28-v1");expect(qualityBaselineRevision).toMatch(/^[a-f0-9]{40}$/);
    for(const item of cases){
      expect(()=>validateBlueprintStructure(item.blueprint)).not.toThrow();
      // Deliberately retain the two short-content negatives. Do not pad a held-out
      // case after seeing its result simply to make the baseline pass.
      expect(reviewSiteDepth(item.blueprint,item.plan).map(issue=>issue.code)).toEqual(
        ["trades-compact-first-site","unknown-company-none"].includes(item.id)?["thin_page"]:[]);
    }
  });
  it("preserves uncertainty, real contrasts and approved logo/missing-logo coverage",()=>{
    const cases=qualityCohortCases();const first=cases.find(item=>item.id==="trades-established")!;const alternate=cases.find(item=>item.id==="trades-compact-first-site")!;
    expect(alternate.blueprint.family).toBe(first.blueprint.family);expect(alternate.blueprint.composition).not.toBe(first.blueprint.composition);expect(alternate.blueprint.pages.length).not.toBe(first.blueprint.pages.length);
    expect(cases.find(item=>item.id==="unknown-company-none")!.blueprint.brandName).not.toBe("None");
    expect(cases.find(item=>item.id==="hospitality-ambiguous-match")!.blueprint.contact).toEqual({phone:null,email:null,address:null});
    expect(cases.filter(item=>item.blueprint.presentation?.logoAssetId)).toHaveLength(1);
  });
  it("does not silently change the frozen plans, render inputs or split",()=>{
    const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
    expect(frozenManifest.version).toBe(qualityCohortVersion);
    for(const sample of qualityCohortCases()){
      const frozen=frozenManifest.cases.find(item=>item.id===sample.id)!;
      expect(hash(sample.plan)).toBe(frozen.planSha256);expect(hash(sample.blueprint)).toBe(frozen.blueprintSha256);
      expect(qualityCohortManifest.find(item=>item.id===sample.id)!.split).toBe(frozen.split);
    }
  });
});
