import type { FactoryPlanContent } from "../types";
import type { SiteIssue } from "./artifacts";
import type { SiteBlueprint } from "./types";

/** Content checks supplement browser/accessibility QA; they cannot judge aesthetics. */
export function reviewSiteDepth(blueprint:SiteBlueprint,plan:FactoryPlanContent):SiteIssue[] {
  const issues:SiteIssue[]=[];
  const add=(page:string,code:string,message:string)=>issues.push({page,code,message,severity:"error"});
  if(blueprint.pages.length<Math.min(plan.pages.length,10)) add("index.html","missing_planned_pages","Include every page in the approved plan, with distinct page content.");
  const signatures=new Set<string>();
  for(const page of blueprint.pages){
    const sections=page.sections.filter(s=>s.kind!=="contact");
    const minimum=page.path==="index.html"?4:2;
    if(sections.length<minimum) add(page.path,"thin_page",`Provide at least ${minimum} useful non-contact sections on this page; use approved services, explanatory guidance, process and relevant questions rather than padding.`);
    for(const section of sections){
      if(["services","features","process","faq"].includes(section.kind)&&section.items.length<2)
        add(page.path,"empty_collection",`The ${section.id} section needs at least two useful items or a more suitable section type.`);
    }
    const signature=JSON.stringify(sections.map(s=>({title:s.title,body:s.body,items:s.items})));
    if(signatures.has(signature)) add(page.path,"repeated_page","This page repeats another page's content. Give it a distinct purpose and substantive content from the approved plan.");
    signatures.add(signature);
    if(sections.length>=4&&new Set(sections.map(s=>s.layout)).size<3)
      add(page.path,"repeated_layout","Use at least three complementary section layouts for this page instead of repeating the same treatment throughout.");
  }
  return issues;
}
