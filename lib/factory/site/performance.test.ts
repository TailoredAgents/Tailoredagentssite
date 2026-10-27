import {describe,expect,it} from "vitest";
import {checkSiteDelivery,deliveryBudgets} from "./performance";
import type {SiteFiles} from "./artifacts";

const bytes=(size:number)=>new Uint8Array(size);
describe("Portable-site delivery resource budgets",()=>{
  it("accounts for each page, shared local code and the correct responsive image",()=>{
    const files:SiteFiles={"index.html":bytes(100),"services/index.html":bytes(200),"assets/site.css":bytes(50),"assets/runtime.js":bytes(25),"assets/images/hero-mobile.webp":bytes(1000),"assets/images/hero-desktop.webp":bytes(2000),"assets/images/hero.png":bytes(3_000_000)};
    expect(checkSiteDelivery(files)).toEqual({pages:[{page:"index.html",mobileBytes:1175,desktopBytes:2175},{page:"services/index.html",mobileBytes:1275,desktopBytes:2275}],issues:[]});
  });
  it("supports legacy bundles by counting their original PNG on both viewports",()=>{
    const result=checkSiteDelivery({"index.html":bytes(100),"assets/site.css":bytes(50),"assets/runtime.js":bytes(25),"assets/images/hero.png":bytes(3_000_000)});
    expect(result.pages).toEqual([{page:"index.html",mobileBytes:3_000_175,desktopBytes:3_000_175}]);
    expect(result.issues.map(issue=>issue.code)).toEqual(expect.arrayContaining(["mobile_image_budget","desktop_image_budget","mobile_page_budget"]));
  });
  it("accepts exact limits and rejects over-budget images or each oversized HTML page",()=>{
    const files:SiteFiles={"index.html":bytes(deliveryBudgets.mobilePageBytes-deliveryBudgets.mobileHeroBytes),"assets/images/hero-mobile.webp":bytes(deliveryBudgets.mobileHeroBytes),"assets/images/hero-desktop.webp":bytes(deliveryBudgets.desktopHeroBytes)};
    expect(checkSiteDelivery(files).issues).toEqual([]);
    files["assets/images/hero-mobile.webp"]=bytes(deliveryBudgets.mobileHeroBytes+1);files["assets/images/hero-desktop.webp"]=bytes(deliveryBudgets.desktopHeroBytes+1);files["services/index.html"]=bytes(600000);
    const issues=checkSiteDelivery(files).issues;
    expect(issues.filter(issue=>issue.code==="mobile_page_budget").map(issue=>issue.page)).toEqual(["index.html","services/index.html"]);
    expect(issues.filter(issue=>issue.code.endsWith("image_budget"))).toHaveLength(2);expect(issues.every(issue=>issue.severity==="error")).toBe(true);
  });
  it("reports bytes rather than claiming network timing, Lighthouse or Core Web Vitals measurements",()=>{
    const result=checkSiteDelivery({"index.html":bytes(100)});
    expect(Object.keys(result).sort()).toEqual(["issues","pages"]);
    expect(Object.keys(result.pages[0]).sort()).toEqual(["desktopBytes","mobileBytes","page"]);
    expect(result).not.toHaveProperty("lcp");expect(result).not.toHaveProperty("milliseconds");expect(result).not.toHaveProperty("score");
  });
});
