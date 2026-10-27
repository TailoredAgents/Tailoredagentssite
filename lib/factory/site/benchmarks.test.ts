import {describe,expect,it} from "vitest";
import {factoryBenchmarkCases} from "./benchmark-fixtures";
import {siteQualityAverage,siteQualityBenchmarks,siteQualityRubric} from "./benchmarks";
import {validateBlueprintStructure} from "./validate";
import {reviewSiteDepth,publicSiteCopy} from "./quality";

describe("Reproducible quality benchmark coverage",()=>{
  it("covers distinct industry presentations and missing lead information without paid providers",()=>{
    const cases=factoryBenchmarkCases();expect(cases).toHaveLength(5);
    expect(new Set(cases.map(sample=>sample.blueprint.family)).size).toBe(5);
    expect(new Set(cases.map(sample=>sample.blueprint.presentation!.fontTheme)).size).toBe(4);
    for(const sample of cases){expect(()=>validateBlueprintStructure(sample.blueprint)).not.toThrow();expect(reviewSiteDepth(sample.blueprint,sample.plan)).toEqual([]);}
    const sparse=cases.find(sample=>sample.sparse)!;expect(sparse.blueprint.contact).toEqual({email:null,phone:null,address:null});expect(sparse.blueprint.media).toEqual([]);
    expect(sparse.plan.summary).toContain("absent");expect(sparse.plan.knownDetails).toHaveLength(1);
  });
  it("keeps calibration targets separate from measured outcomes",()=>{
    expect(siteQualityRubric.anchors.find(anchor=>anchor.score===65)?.description).toContain("generic");
    expect(siteQualityAverage({firstImpression:90,composition:90,imagery:90,copy:90,usefulness:90,mobile:90})).toBe(90);
    expect(siteQualityBenchmarks.find(reference=>reference.id==="cosmos-human-reference")).toMatchObject({referenceUrl:"https://cosmos-heating-air.onrender.com"});
    expect(siteQualityBenchmarks.every(reference=>!("achievedScore" in reference))).toBe(true);
  });
  it("rejects repetitive padding and public uncertainty even when a new site has many sections",()=>{
    const sample=factoryBenchmarkCases()[0],b=sample.blueprint;
    for(const section of b.pages[0].sections)section.body="Service details are awaiting confirmation. Please prepare your inquiry and wait before making any arrangements about your upcoming project.";
    const codes=reviewSiteDepth(b,sample.plan).map(issue=>issue.code);expect(codes).toContain("repeated_padding");expect(codes).toContain("uncertainty_dominates_copy");
  });
  it("checks new media captions while keeping internal prompts out of public claim review",()=>{
    const sample=factoryBenchmarkCases()[0],b=sample.blueprint;
    b.media![0].caption="Trusted by 500 customers.";b.media![0].prompt="Internal prompt with an unrelated 9999 claim.";
    expect(publicSiteCopy(b)[0].text).toContain("Trusted by 500 customers.");expect(publicSiteCopy(b)[0].text).not.toContain("Internal prompt");
    expect(reviewSiteDepth(b,sample.plan).some(issue=>issue.code==="unsupported_concrete_claim")).toBe(true);
  });
});
