import { z } from "zod";
import type { FactoryPlanContent } from "../types";
import { safeSitePath } from "./artifacts";
import { designFamilyIds,heroCompositions,sectionLayouts,type SiteBlueprint,type PortableSiteBundle } from "./types";
import { designFamilies } from "./families";
import { contrastRatio } from "./design";
const text=z.string().trim().max(1400),short=z.string().trim().max(180);
const color=z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const siteDesignSchema=z.object({
  version:z.literal(1),
  palette:z.object({background:color,surface:color,ink:color,muted:color,accent:color,accentSecondary:color}).strict(),
  typography:z.object({heading:z.enum(["modern","editorial","humanist","geometric"]),body:z.enum(["modern","humanist"]),scale:z.enum(["balanced","expressive"]),weight:z.union([z.literal(400),z.literal(600),z.literal(700),z.literal(800)])}).strict(),
  density:z.enum(["compact","balanced","airy"]),radius:z.enum(["square","soft","rounded"]),
  heroFocalPoint:z.object({x:z.number().min(0).max(100),y:z.number().min(0).max(100)}).strict(),
  sectionStyles:z.array(z.object({pagePath:z.string().max(100),sectionId:z.string().regex(/^[a-z][a-z0-9-]{0,40}$/),tone:z.enum(["base","surface","contrast","accent"])}).strict()).max(80),
}).strict();
export const siteBlueprintSchema=z.object({
  version:z.literal(1),brandName:short.min(1),tagline:short,family:z.enum(designFamilyIds),composition:z.enum(heroCompositions),accent:z.string().regex(/^#[0-9a-fA-F]{6}$/),fontPair:z.enum(["modern","editorial","humanist"]),
  design:siteDesignSchema.optional(),
  pages:z.array(z.object({path:z.string().max(100),title:short.min(1),description:z.string().trim().min(1).max(320),hero:z.object({eyebrow:short,headline:z.string().trim().min(1).max(240),body:text,primaryCta:short.min(1),secondaryCta:short}).strict(),
    sections:z.array(z.object({id:z.string().regex(/^[a-z][a-z0-9-]{0,40}$/),kind:z.enum(["services","about","process","features","faq","contact","statement"]),layout:z.enum(sectionLayouts),eyebrow:short,title:z.string().trim().min(1).max(240),body:text,items:z.array(z.object({title:short.min(1),body:text}).strict()).max(8)}).strict()).max(8),}).strict()).min(1).max(10),
  heroImage:z.object({prompt:z.string().trim().min(20).max(2200),alt:z.string().trim().min(5).max(250),caption:z.string().trim().min(1).max(250)}).strict(),
  contact:z.object({email:z.string().email().max(200).nullable(),phone:z.string().regex(/^[+()0-9 .-]{7,30}$/).nullable(),address:z.string().trim().max(300).nullable()}).strict(),
  factualClaims:z.array(z.object({text:z.string().trim().min(1).max(700),detailIndex:z.number().int().min(0).max(23)}).strict()).max(24),
  productionTasks:z.array(text.min(1)).max(20),assumptions:z.array(text.min(1)).max(16),
}).strict();
/** New generations always provide design tokens; immutable legacy bundles may omit them. */
export const siteGenerationSchema=siteBlueprintSchema.extend({design:siteDesignSchema});

export function validateBlueprintStructure(value:unknown):SiteBlueprint {
  const data=siteBlueprintSchema.parse(value),paths=new Set<string>();
  if(Buffer.byteLength(JSON.stringify(data))>65000)throw new Error("The website proposal exceeds its content limit.");
  if(!designFamilies[data.family].compositions.includes(data.composition))throw new Error("Choose one of this design family's supported compositions.");
  for(const page of data.pages){safeSitePath(page.path);if(!/^(index\.html|[a-z][a-z0-9-]{0,48}\/index\.html)$/.test(page.path)||paths.has(page.path))throw new Error("The website contains an invalid or duplicate page path.");paths.add(page.path);
    const ids=new Set<string>();for(const section of page.sections){if(ids.has(section.id)||ids.has(`${section.id}-heading`)||["page-content","site-menu","demo-feedback"].includes(section.id)||(section.id==="contact"&&section.kind!=="contact"))throw new Error("The website contains duplicate or reserved section identifiers.");ids.add(section.id);ids.add(`${section.id}-heading`);}}
  if(!paths.has("index.html"))throw new Error("The website needs a homepage.");
  if(data.design){
    const palette=data.design.palette;
    for(const foreground of [palette.ink,palette.muted])for(const background of [palette.background,palette.surface])if(contrastRatio(foreground,background)<4.5)throw new Error("Website palette text must have at least 4.5:1 contrast on its backgrounds.");
    const styled=new Set<string>();for(const style of data.design.sectionStyles){
      const key=`${style.pagePath}#${style.sectionId}`;
      if(styled.has(key)||!data.pages.some(p=>p.path===style.pagePath&&p.sections.some(s=>s.id===style.sectionId)))throw new Error("A design tone references a missing or duplicate website section.");styled.add(key);
    }
  }
  return data;
}
export function validateSiteBlueprint(value:unknown,plan:FactoryPlanContent):SiteBlueprint {
  const data=validateBlueprintStructure(value);
  for(const claim of data.factualClaims){const detail=plan.knownDetails[claim.detailIndex];if(!detail||!["submitted","sourced"].includes(detail.basis)||!detail.value.toLowerCase().includes(claim.text.toLowerCase()))throw new Error("A website fact is not supported by the approved plan.");}
  const eligibleFacts=plan.knownDetails.filter(d=>["submitted","sourced"].includes(d.basis)).map(d=>d.value.toLowerCase());
  for(const value of Object.values(data.contact)){if(value&&!eligibleFacts.some(f=>f.includes(value.toLowerCase())))throw new Error("Contact details must come from confirmed or submitted facts in the approved plan.");}
  return data;
}
export function portableBundle(blueprint:SiteBlueprint):PortableSiteBundle {
  return {version:1,title:blueprint.brandName,designFamily:blueprint.family,pages:blueprint.pages.map(p=>({path:p.path,title:p.title})),
    imageSlots:[{id:"hero",path:"assets/images/hero.png",...blueprint.heroImage}],productionTasks:blueprint.productionTasks,assumptions:blueprint.assumptions,blueprint};
}
