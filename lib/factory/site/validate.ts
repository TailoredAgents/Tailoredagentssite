import { z } from "zod";
import type { FactoryPlanContent } from "../types";
import { safeSitePath } from "./artifacts";
import { designFamilyIds,heroCompositions,sectionLayouts,siteFormFields,fontThemes,type SiteBlueprint,type PortableSiteBundle,type SiteAssetDescriptor } from "./types";
import { designFamilies } from "./families";
import { sitePaletteContrastIssues } from "./design";
import { SiteBlueprintError } from "./errors";
const text=z.string().trim().max(1400),short=z.string().trim().max(180);
const color=z.string().regex(/^#[0-9a-fA-F]{6}$/);
const sectionId=z.string().regex(/^[a-z][a-z0-9-]{0,40}$/);
const assetId=z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
const focalPoint=z.object({x:z.number().min(0).max(100),y:z.number().min(0).max(100)}).strict();
const focalPoints=z.array(z.object({assetId,desktop:focalPoint,mobile:focalPoint}).strict()).max(5);
export const siteMediaSchema=z.array(z.object({id:assetId,role:z.enum(["logo","photo"]),source:z.enum(["provided","generated"]),uploadId:z.string().min(1).max(100).nullable(),prompt:z.string().trim().max(2200),alt:z.string().trim().min(3).max(250),caption:z.string().trim().max(250)}).strict()).max(4);
export const sitePresentationSchema=z.object({version:z.literal(1),fontTheme:z.enum(fontThemes),heroEmphasis:z.string().trim().min(1).max(120).nullable(),logoAssetId:assetId.nullable(),
  imageFocalPoints:focalPoints.optional(),
  pageImages:z.array(z.object({pagePath:z.string().max(100),assetId}).strict()).max(10),
  sectionImages:z.array(z.object({pagePath:z.string().max(100),sectionId,assetId,itemIndex:z.number().int().min(0).max(7).nullable()}).strict()).max(40),
}).strict();
export const siteInteractionsSchema=z.object({version:z.literal(1),
  forms:z.array(z.object({pagePath:z.string().max(100),sectionId,fields:z.array(z.enum(siteFormFields)).min(1).max(7),submitLabel:short.min(1)}).strict()).max(10),
  actions:z.array(z.object({pagePath:z.string().max(100),sectionId,itemIndex:z.number().int().min(0).max(7),label:short.min(1),targetPage:z.string().max(100),targetSection:sectionId.nullable()}).strict()).max(40),
}).strict();
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
  interactions:siteInteractionsSchema.optional(),
  media:siteMediaSchema.optional(),presentation:sitePresentationSchema.optional(),
  pages:z.array(z.object({path:z.string().max(100),title:short.min(1),description:z.string().trim().min(1).max(320),hero:z.object({eyebrow:short,headline:z.string().trim().min(1).max(240),body:text,primaryCta:short.min(1),secondaryCta:short}).strict(),
    sections:z.array(z.object({id:z.string().regex(/^[a-z][a-z0-9-]{0,40}$/),kind:z.enum(["services","about","process","features","faq","contact","statement"]),layout:z.enum(sectionLayouts),eyebrow:short,title:z.string().trim().min(1).max(240),body:text,items:z.array(z.object({title:short.min(1),body:text}).strict()).max(8)}).strict()).max(8),}).strict()).min(1).max(10),
  heroImage:z.object({prompt:z.string().trim().min(20).max(2200),alt:z.string().trim().min(5).max(250),caption:z.string().trim().min(1).max(250),uploadId:z.string().min(1).max(100).nullable().optional()}).strict(),
  contact:z.object({email:z.string().email().max(200).nullable(),phone:z.string().regex(/^[+()0-9 .-]{7,30}$/).nullable(),address:z.string().trim().max(300).nullable()}).strict(),
  factualClaims:z.array(z.object({text:z.string().trim().min(1).max(700),detailIndex:z.number().int().min(0).max(23)}).strict()).max(24),
  productionTasks:z.array(text.min(1)).max(20),assumptions:z.array(text.min(1)).max(16),
}).strict();
/** New generations always provide design tokens; immutable legacy bundles may omit them. */
export const siteGenerationSchema=siteBlueprintSchema.extend({design:siteDesignSchema,interactions:siteInteractionsSchema,media:siteMediaSchema,presentation:sitePresentationSchema.extend({imageFocalPoints:focalPoints}),heroImage:siteBlueprintSchema.shape.heroImage.extend({uploadId:z.string().min(1).max(100).nullable()})});

export function validateBlueprintStructure(value:unknown):SiteBlueprint {
  const data=siteBlueprintSchema.parse(value),paths=new Set<string>();
  if(Buffer.byteLength(JSON.stringify(data))>65000)throw new SiteBlueprintError("The website proposal exceeds its content limit.");
  if(!designFamilies[data.family].compositions.includes(data.composition))throw new SiteBlueprintError("Choose one of this design family's supported compositions.");
  for(const page of data.pages){try{safeSitePath(page.path);}catch{throw new SiteBlueprintError("The website contains an invalid page path.");}if(!/^(index\.html|[a-z][a-z0-9-]{0,48}\/index\.html)$/.test(page.path)||paths.has(page.path))throw new SiteBlueprintError("The website contains an invalid or duplicate page path.");paths.add(page.path);
    const ids=new Set<string>();for(const section of page.sections){if(ids.has(section.id)||ids.has(`${section.id}-heading`)||["page-content","site-menu","demo-feedback"].includes(section.id)||(section.id==="contact"&&section.kind!=="contact"))throw new SiteBlueprintError("The website contains duplicate or reserved section identifiers.");ids.add(section.id);ids.add(`${section.id}-heading`);}}
  if(!paths.has("index.html"))throw new SiteBlueprintError("The website needs a homepage.");
  if(data.media?.length&&!data.presentation)throw new SiteBlueprintError("Website media needs an explicit presentation.");
  if(!data.presentation&&data.pages.some(page=>page.sections.some(section=>["image-grid","alternating","service-tabs"].includes(section.layout))))throw new SiteBlueprintError("Expanded website layouts need an explicit presentation.");
  const media=new Map((data.media||[]).map(item=>[item.id,item]));
  if(media.size!==(data.media||[]).length||media.has("hero"))throw new SiteBlueprintError("Website media identifiers must be unique and cannot replace the hero.");
  if([...media.values()].filter(item=>item.role==="logo").length>1||[...media.values()].filter(item=>item.source==="generated").length>2)throw new SiteBlueprintError("A website supports one supplied logo and at most two additional generated photos.");
  for(const item of media.values()){
    if(item.role==="logo"&&/-(mobile|desktop)$/.test(item.id))throw new SiteBlueprintError("Logo identifiers cannot end in mobile or desktop image variant suffixes.");
    if(item.source==="provided"&&!item.uploadId||item.source==="generated"&&(item.uploadId!==null||item.role==="logo"||item.prompt.length<20))throw new SiteBlueprintError("Website media must use an approved upload or a bounded illustrative photo prompt; logos cannot be generated.");
    if(item.source==="generated"&&!item.caption)throw new SiteBlueprintError("Generated supporting photos need a caption identifying them as illustrative concepts.");
  }
  if(data.presentation){
    const presentation=data.presentation,used=new Set<string>(),bindings=new Set<string>();
    const focalIds=new Set<string>();
    for(const focal of presentation.imageFocalPoints||[]){
      if(focalIds.has(focal.assetId)||(focal.assetId!=="hero"&&media.get(focal.assetId)?.role!=="photo"))throw new SiteBlueprintError("Image crop positions must reference unique photo assets, never logos.");
      focalIds.add(focal.assetId);
    }
    if(presentation.heroEmphasis&&!data.pages.find(p=>p.path==="index.html")!.hero.headline.includes(presentation.heroEmphasis))throw new SiteBlueprintError("Hero emphasis must be an exact phrase in the homepage headline.");
    if(presentation.logoAssetId){const logo=media.get(presentation.logoAssetId);if(!logo||logo.role!=="logo"||logo.source!=="provided")throw new SiteBlueprintError("The logo must reference a supplied logo asset.");used.add(logo.id);}
    const photo=(id:string)=>{if(id!=="hero"&&(!media.has(id)||media.get(id)!.role!=="photo"))throw new SiteBlueprintError("A photo placement references a missing or non-photo asset.");used.add(id);};
    for(const placement of presentation.pageImages){
      if(!paths.has(placement.pagePath)||bindings.has(placement.pagePath))throw new SiteBlueprintError("A page image references a missing or duplicate page.");
      bindings.add(placement.pagePath);photo(placement.assetId);
    }
    for(const placement of presentation.sectionImages){
      const section=data.pages.find(p=>p.path===placement.pagePath)?.sections.find(s=>s.id===placement.sectionId),key=`${placement.pagePath}#${placement.sectionId}:${placement.itemIndex??"section"}`;
      if(!section||bindings.has(key)||(placement.itemIndex!==null&&!section.items[placement.itemIndex]))throw new SiteBlueprintError("A section image references a missing or duplicate section or item.");
      if(placement.itemIndex!==null&&["faq","contact"].includes(section.kind))throw new SiteBlueprintError("FAQ and contact sections support section photos, not item photos.");
      bindings.add(key);photo(placement.assetId);
    }
    if([...media.keys()].some(id=>!used.has(id)))throw new SiteBlueprintError("Each additional image needs a purpose and placement before it is generated.");
  }
  if(data.interactions){
    const forms=new Set<string>(),actions=new Set<string>();
    for(const form of data.interactions.forms){
      const section=data.pages.find(p=>p.path===form.pagePath)?.sections.find(s=>s.id===form.sectionId);
      const key=`${form.pagePath}#${form.sectionId}`;
      if(!section||section.kind!=="contact"||forms.has(key))throw new SiteBlueprintError("A form references a missing, duplicate or non-contact section.");
      if(new Set(form.fields).size!==form.fields.length||form.fields.includes("preferredContact")!==form.fields.includes("contactDetail"))throw new SiteBlueprintError("Form fields must be unique; preferred contact and contact detail must be used together.");
      forms.add(key);
    }
    for(const action of data.interactions.actions){
      const section=data.pages.find(p=>p.path===action.pagePath)?.sections.find(s=>s.id===action.sectionId),target=data.pages.find(p=>p.path===action.targetPage);
      const key=`${action.pagePath}#${action.sectionId}:${action.itemIndex}`;
      if(section&&!["services","features","contact"].includes(section.kind))throw new SiteBlueprintError("Website item links are supported on service, feature and contact sections.");
      if(!section||!section.items[action.itemIndex]||actions.has(key)||!target||(action.targetSection&&!target.sections.some(s=>s.id===action.targetSection)))throw new SiteBlueprintError("A website action references a missing or duplicate item, page or section.");
      actions.add(key);
    }
  }
  if(data.design){
    const palette=data.design.palette;
    if(sitePaletteContrastIssues(palette).length)throw new SiteBlueprintError("Website palette text must have at least 4.5:1 contrast on its backgrounds.");
    const styled=new Set<string>();for(const style of data.design.sectionStyles){
      const key=`${style.pagePath}#${style.sectionId}`;
      if(styled.has(key)||!data.pages.some(p=>p.path===style.pagePath&&p.sections.some(s=>s.id===style.sectionId)))throw new SiteBlueprintError("A design tone references a missing or duplicate website section.");styled.add(key);
    }
  }
  return data;
}
export function validateSiteBlueprint(value:unknown,plan:FactoryPlanContent,assets?:SiteAssetDescriptor[]):SiteBlueprint {
  const data=validateBlueprintStructure(value);
  if(assets&&data.heroImage.uploadId){const asset=assets.find(a=>a.id===data.heroImage.uploadId&&a.provenance==="provided");if(!asset||(asset.role||"photo")!=="photo")throw new SiteBlueprintError("The hero image must reference an approved photo, never a logo or another project's upload.");}
  if(assets)for(const media of data.media||[]){if(media.source!=="provided")continue;const asset=assets.find(a=>a.id===media.uploadId&&a.provenance==="provided");if(!asset||(asset.role||"photo")!==media.role)throw new SiteBlueprintError("Website imagery must reference an approved upload with the matching logo or photo role.");}
  for(const claim of data.factualClaims){const detail=plan.knownDetails[claim.detailIndex];if(!detail||!["submitted","sourced"].includes(detail.basis)||!detail.value.toLowerCase().includes(claim.text.toLowerCase()))throw new SiteBlueprintError("A website fact is not supported by the approved plan.");}
  const eligibleFacts=plan.knownDetails.filter(d=>["submitted","sourced"].includes(d.basis)).map(d=>d.value.toLowerCase());
  for(const value of Object.values(data.contact)){if(value&&!eligibleFacts.some(f=>f.includes(value.toLowerCase())))throw new SiteBlueprintError("Contact details must come from confirmed or submitted facts in the approved plan.");}
  return data;
}
export function portableBundle(blueprint:SiteBlueprint):PortableSiteBundle {
  return {version:1,title:blueprint.brandName,designFamily:blueprint.family,pages:blueprint.pages.map(p=>({path:p.path,title:p.title})),
    imageSlots:[{id:"hero",path:"assets/images/hero.png",...blueprint.heroImage}],productionTasks:blueprint.productionTasks,assumptions:blueprint.assumptions,blueprint};
}
