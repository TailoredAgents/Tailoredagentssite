import sharp from "sharp";
import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {buildRepairEvidence,repairEvidenceLimits} from "./repair-evidence";
import {fixtureBlueprint} from "./fixtures";
import type {SiteQaResult,SiteIssue} from "./artifacts";

describe("Bounded repair evidence (local images only)",()=>{
  it("prioritizes error pages, caps pages/images, and never substitutes unrelated Home captures",async()=>{
    const blueprint=fixtureBlueprint("trades","split",true),extra={...structuredClone(blueprint.pages[0]),path:"contact/index.html"};blueprint.pages.push(extra);
    const bytes=await sharp({create:{width:390,height:2200,channels:3,background:"#235067"}}).png().toBuffer();
    const screenshots:SiteQaResult["screenshots"]=blueprint.pages.flatMap(page=>["desktop","mobile"].map(viewport=>({page:page.path,viewport:viewport as "desktop"|"mobile",bytes})));
    const issues:SiteIssue[]=[{page:"index.html",code:"warning",message:"Optional polish",severity:"warning"},...blueprint.pages.slice(1).map(page=>({page:page.path,code:"review_design",message:"Improve this affected page.",severity:"error" as const}))];
    const evidence=await buildRepairEvidence({blueprint,issues,screenshots});
    expect(evidence.pages).toEqual(["approach/index.html","services/index.html","contact/index.html"]);
    expect(evidence.images).toHaveLength(repairEvidenceLimits.images);expect(evidence.imageBytes).toBeLessThan(repairEvidenceLimits.totalBytes);
    expect(evidence.images.some(image=>image.page==="index.html")).toBe(false);
    for(const image of evidence.images)expect(image.bytes.length).toBeLessThanOrEqual(repairEvidenceLimits.imageBytes);
  });
  it("handles missing captures and rejects fabricated page references without reading their bytes",async()=>{
    const blueprint=fixtureBlueprint(),evidence=await buildRepairEvidence({blueprint,issues:[{page:"unknown/index.html",code:"bad",message:"Unknown page",severity:"error"}],screenshots:[{page:"unknown/index.html",viewport:"desktop",bytes:new Uint8Array([1,2,3])}]});
    expect(evidence).toEqual({images:[],imageBytes:0,pages:[]});
    expect(await buildRepairEvidence({blueprint,issues:[{page:"index.html",code:"browser",message:"Capture unavailable",severity:"error"}]})).toEqual({images:[],imageBytes:0,pages:[]});
  });
  it("gives global failures bounded known-page context after prioritizing specifically affected pages",async()=>{
    const blueprint=fixtureBlueprint("trades","split",true),bytes=await sharp({create:{width:390,height:1800,channels:3,background:"#235067"}}).png().toBuffer();
    const screenshots:SiteQaResult["screenshots"]=blueprint.pages.map(page=>({page:page.path,viewport:"mobile",bytes}));
    const global:SiteIssue={page:"all",code:"shared_layout",message:"Improve repeated section spacing.",severity:"error"};
    const evidence=await buildRepairEvidence({blueprint,issues:[global,{page:"services/index.html",code:"copy",message:"Shorten the options section.",severity:"error"}],screenshots});
    expect(evidence.pages).toEqual(["services/index.html","index.html","approach/index.html"]);
    expect(evidence.images.length).toBeLessThanOrEqual(repairEvidenceLimits.images);
    expect((await buildRepairEvidence({blueprint,issues:[global],screenshots})).pages).toEqual(blueprint.pages.map(page=>page.path));
  });
  it("ignores invalid region coordinates and uses a labelled bounded opening crop",async()=>{
    const blueprint=fixtureBlueprint(),bytes=await sharp({create:{width:390,height:1800,channels:3,background:"#235067"}}).png().toBuffer();
    const evidence=await buildRepairEvidence({blueprint,issues:[{page:"index.html",code:"copy",message:"Shorten services copy",severity:"error"}],screenshots:[{page:"index.html",viewport:"mobile",bytes,regions:[{id:"services",top:NaN,height:300},{id:"services",top:999999,height:300}]}]});
    expect(evidence.images[1].label).toContain("readable opening detail; cropped rows 0–1000");
  });
});
