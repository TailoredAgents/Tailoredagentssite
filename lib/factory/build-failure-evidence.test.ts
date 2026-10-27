import {describe,expect,it,vi} from "vitest";
import {boundedFactoryFailureIssues,factoryFailureScreenshotKey,isFactoryEvidencePage,readFactoryFailureEvidence,saveFactoryFailureScreenshots} from "./build-failure-evidence";
import type {FactoryBuildFailureQa} from "./build-types";
import type {SiteQaResult} from "./site/artifacts";

const prefix="factory/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000003/";
const checkedAt="2026-10-27T12:00:00.000Z";
function fixture(pages=["index.html","services/index.html","contact/index.html"]){
  const report:FactoryBuildFailureQa={checkedAt,issues:[{code:"review_design",page:"contact/index.html",message:"Compact the oversized form introduction.",severity:"error"}],screenshots:{}};
  const qa:SiteQaResult={checkedAt,passed:false,issues:report.issues,screenshots:pages.flatMap(page=>(["desktop","mobile"] as const).map(viewport=>({page,viewport,bytes:new Uint8Array([1,2,3])})))};
  return {report,qa,pages,prefix,storage:{put:vi.fn().mockResolvedValue(undefined)}};
}

describe("Private failed website evidence",()=>{
  it("saves failed pages first, both viewports, then other rendered pages without changing the verdict",async()=>{
    const input=fixture();await saveFactoryFailureScreenshots(input);
    expect(input.report.pageScreenshots?.map(shot=>`${shot.page}:${shot.viewport}`)).toEqual(["contact/index.html:desktop","contact/index.html:mobile","index.html:desktop","index.html:mobile","services/index.html:desktop","services/index.html:mobile"]);
    expect(input.report.screenshots.desktop).toBe(`${prefix}failed/screenshots/desktop.png`);
    expect(input.storage.put).toHaveBeenCalledTimes(6);expect(input.qa.passed).toBe(false);
    expect(input.report.pageScreenshots?.find(shot=>shot.page==="contact/index.html")?.storageKey).toBe(`${prefix}failed/pages/contact/index-desktop.png`);
  });
  it("keeps useful errors and remaining screenshots if one private storage request fails",async()=>{
    const input=fixture();input.storage.put.mockRejectedValueOnce(new Error("temporary storage interruption"));
    await saveFactoryFailureScreenshots(input);expect(input.report.issues).toEqual(input.qa.issues);expect(input.report.pageScreenshots).toHaveLength(5);
    expect(input.report.pageScreenshots?.some(shot=>shot.page==="contact/index.html"&&shot.viewport==="desktop")).toBe(false);
    expect(readFactoryFailureEvidence(input.report,prefix)?.pageScreenshots).toHaveLength(5);
  });
  it("ignores screenshots outside the rendered page manifest and unsafe paths",async()=>{
    const input=fixture();input.qa.screenshots.push({page:"other/index.html",viewport:"desktop",bytes:new Uint8Array([4])},{page:"../other/index.html",viewport:"desktop",bytes:new Uint8Array([4])});
    input.pages.push("../other/index.html");await saveFactoryFailureScreenshots(input);expect(input.storage.put).toHaveBeenCalledTimes(6);
    for(const page of ["../index.html","/index.html","contact\\index.html","contact/%2e%2e/index.html","contact/index.html?x=1","https://example.test/index.html","settings.json","nested/contact/index.html"])expect(isFactoryEvidencePage(page)).toBe(false);
    expect(()=>factoryFailureScreenshotKey("factory/other/","index.html","mobile")).toThrow();
  });
  it("bounds pages and bytes while prioritizing the failed page",async()=>{
    const pages=["index.html",...Array.from({length:12},(_,n)=>`page-${n}/index.html`)];const input=fixture(pages);
    input.report.issues[0].page="page-8/index.html";input.qa.screenshots[0].bytes=new Uint8Array(10_000_001);
    await saveFactoryFailureScreenshots(input);expect(input.report.pageScreenshots).toHaveLength(19);
    expect(input.report.pageScreenshots?.[0].page).toBe("page-8/index.html");expect(input.report.pageScreenshots?.some(shot=>shot.page==="page-9/index.html")).toBe(false);
  });
  it("projects only exact build-scoped keys and diagnostic fields, including legacy Home screenshots",()=>{
    const input=fixture(),home=`${prefix}failed/screenshots/desktop.png`,contact=factoryFailureScreenshotKey(prefix,"contact/index.html","mobile");
    const projected=readFactoryFailureEvidence({...input.report,screenshots:{desktop:home,mobile:"https://example.test/image.png"},pageScreenshots:[{page:"contact/index.html",viewport:"mobile",storageKey:contact},{page:"contact/index.html",viewport:"mobile",storageKey:contact},{page:"services/index.html",viewport:"desktop",storageKey:contact},{page:"contact/index.html",viewport:"desktop",storageKey:contact.replace("000000000003","000000000099")}],raw:"secret provider response",prompt:"private instructions",designReview:{raw:"private"}},prefix);
    expect(projected).toEqual({...input.report,screenshots:{desktop:home},pageScreenshots:[{page:"contact/index.html",viewport:"mobile",storageKey:contact},{page:"index.html",viewport:"desktop",storageKey:home}]});
    expect(readFactoryFailureEvidence({...input.report,checkedAt:"not a date"},prefix)).toBeNull();expect(readFactoryFailureEvidence(input.report,"invalid/")).toBeNull();
  });
  it("keeps blockers ahead of warning noise and removes extra diagnostic fields",()=>{
    const warnings=Array.from({length:30},()=>({severity:"warning",code:"refinement",page:"index.html",message:"Optional refinement"}));
    const issues=boundedFactoryFailureIssues([...warnings,{severity:"error",code:"review_copy",page:"contact/index.html",message:"Shorten the repeated form explanation.",raw:"private"}]);
    expect(issues).toHaveLength(30);expect(issues[0]).toEqual({severity:"error",code:"review_copy",page:"contact/index.html",message:"Shorten the repeated form explanation."});
  });
});
