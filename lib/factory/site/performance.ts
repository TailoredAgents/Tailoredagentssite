import type {SiteFiles,SiteIssue} from "./artifacts";

export const deliveryBudgets={mobilePageBytes:800000,mobileHeroBytes:250000,desktopHeroBytes:400000};
export type SiteDelivery={pages:Array<{page:string;mobileBytes:number;desktopBytes:number}>;issues:SiteIssue[]};
/** Resource budgets, not network timing/Lighthouse or real-user Core Web Vitals.
 * The trusted renderer has exactly one shared image and two shared code files.
 */
export function checkSiteDelivery(files:SiteFiles):SiteDelivery{
  const issues:SiteIssue[]=[],size=(path:string)=>files[path]?.byteLength||0;
  const mobile=size("assets/images/hero-mobile.webp")||size("assets/images/hero.png");
  const desktop=size("assets/images/hero-desktop.webp")||size("assets/images/hero.png");
  const shared=size("assets/site.css")+size("assets/runtime.js");
  const pages=Object.keys(files).filter(p=>p.endsWith(".html")).map(page=>({page,mobileBytes:size(page)+shared+mobile,desktopBytes:size(page)+shared+desktop}));
  if(mobile>deliveryBudgets.mobileHeroBytes)issues.push({page:"index.html",severity:"error",code:"mobile_image_budget",message:"The mobile image exceeds its 250 KB delivery budget."});
  if(desktop>deliveryBudgets.desktopHeroBytes)issues.push({page:"index.html",severity:"error",code:"desktop_image_budget",message:"The desktop image exceeds its 400 KB delivery budget."});
  for(const page of pages)if(page.mobileBytes>deliveryBudgets.mobilePageBytes)issues.push({page:page.page,severity:"error",code:"mobile_page_budget",message:"This page exceeds its 800 KB mobile resource budget."});
  return {pages,issues};
}
