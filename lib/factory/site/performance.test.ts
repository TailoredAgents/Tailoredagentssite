import {describe,expect,it} from "vitest";
import {checkSiteDelivery,deliveryBudgets} from "./performance";
import type {SiteFiles} from "./artifacts";
const bytes=(size:number)=>new Uint8Array(size);
const html=(prefix="",lazy=false)=>Buffer.from(`<link rel="stylesheet" href="${prefix}assets/site.css"><script src="${prefix}assets/runtime.js"></script><picture><source media="(max-width: 700px)" srcset="${prefix}assets/images/hero-mobile.webp"><img ${lazy?'loading="lazy" ':""}src="${prefix}assets/images/hero-desktop.webp"></picture>`);
const basic=():SiteFiles=>({"index.html":html(),"services/index.html":html("../"),"assets/site.css":Buffer.from("body{color:#333}"),"assets/runtime.js":bytes(25),"assets/images/hero-mobile.webp":bytes(1000),"assets/images/hero-desktop.webp":bytes(2000),"assets/images/unused.webp":bytes(3_000_000)});

describe("Portable-site delivery accounting",()=>{
  it("resolves actual page dependencies and picture choices, excluding unused artifacts",()=>{
    const files=basic(),result=checkSiteDelivery(files);
    for(const page of result.pages){
      const shared=files[page.page].byteLength+files["assets/site.css"].byteLength+25;
      expect(page.mobileBytes).toBe(shared+1000);expect(page.desktopBytes).toBe(shared+2000);
      expect(page.mobileInitialBytes).toBe(page.mobileBytes);expect(page.mobileResources).not.toContain("assets/images/unused.webp");
      expect(page.mobileResources).toContain("assets/images/hero-mobile.webp");expect(page.desktopResources).toContain("assets/images/hero-desktop.webp");
    }
    expect(result.issues).toEqual([]);
  });
  it("counts local CSS fonts and multiple images once per page, but distinguishes lazy initial loading",()=>{
    const files=basic();files["assets/site.css"]=Buffer.from('@font-face{font-family:Brand;src:url("fonts/brand.woff2")}');files["assets/fonts/brand.woff2"]=bytes(9000);
    files["index.html"]=Buffer.concat([html(),html("",true),Buffer.from('<img loading="lazy" src="assets/images/story.webp">')]);files["assets/images/story.webp"]=bytes(20000);
    const page=checkSiteDelivery(files).pages.find(p=>p.page==="index.html")!;
    expect(page.mobileResources.filter(p=>p==="assets/fonts/brand.woff2")).toHaveLength(1);
    expect(page.mobileBytes-page.mobileInitialBytes).toBe(20000);
    expect(page.desktopBytes-page.desktopInitialBytes).toBe(20000);
  });
  it("handles legacy PNG markup and a source-set selection without guessing fixed filenames",()=>{
    const files:SiteFiles={"index.html":Buffer.from('<img src="assets/old.png"><img src="assets/fallback.webp" srcset="assets/small.webp 480w, assets/large.webp 1600w" sizes="100vw">'),"assets/old.png":bytes(100),"assets/small.webp":bytes(200),"assets/large.webp":bytes(500),"assets/fallback.webp":bytes(999)};
    const page=checkSiteDelivery(files).pages[0];expect(page.mobileBytes).toBe(files["index.html"].byteLength+300);expect(page.desktopBytes).toBe(files["index.html"].byteLength+600);
  });
  it("accepts image limits exactly and flags over-budget actual dependencies",()=>{
    const files=basic();files["assets/images/hero-mobile.webp"]=bytes(deliveryBudgets.mobileHeroBytes);files["assets/images/hero-desktop.webp"]=bytes(deliveryBudgets.desktopHeroBytes);
    expect(checkSiteDelivery(files).issues).toEqual([]);
    files["assets/images/hero-mobile.webp"]=bytes(deliveryBudgets.mobileHeroBytes+1);files["assets/images/hero-desktop.webp"]=bytes(deliveryBudgets.desktopHeroBytes+1);
    files["assets/site.css"]=Buffer.concat([Buffer.from("body{}"),bytes(600000)]);
    const issues=checkSiteDelivery(files).issues;
    expect(issues.filter(i=>i.code==="mobile_page_budget")).toHaveLength(2);
    expect(issues.filter(i=>i.code==="mobile_image_budget")).toHaveLength(2);
    expect(issues.filter(i=>i.code==="desktop_image_budget")).toHaveLength(2);
  });
  it("does not label byte estimates as measured loading performance",()=>{
    const result=checkSiteDelivery(basic());expect(result).not.toHaveProperty("lcp");expect(result).not.toHaveProperty("score");expect(result).not.toHaveProperty("milliseconds");
  });
});
