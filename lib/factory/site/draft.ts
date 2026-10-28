import {z} from "zod";
import {sectionLayouts,type SiteBlueprint} from "./types";
import {validateBlueprintStructure} from "./validate";
import {SiteBlueprintError} from "./errors";

export const siteDraftTargetSchema=z.object({pagePath:z.string().regex(/^(index\.html|[a-z][a-z0-9-]{0,48}\/index\.html)$/),sectionId:z.union([z.literal("__intro__"),z.string().regex(/^[a-z][a-z0-9-]{0,40}$/)])}).strict();
export const siteDraftContentSchema=z.object({
  headline:z.string().trim().min(1).max(240),body:z.string().trim().max(1400),
  layout:z.enum(sectionLayouts).nullable(),
  items:z.array(z.object({title:z.string().trim().min(1).max(180),body:z.string().trim().max(1400)}).strict()).max(8).nullable(),
}).strict();
export type SiteDraftTarget=z.infer<typeof siteDraftTargetSchema>;
export type SiteDraftContent=z.infer<typeof siteDraftContentSchema>;
export const siteDraftBatchLimits={maxPatches:12,maxBytes:200_000} as const;
export const siteDraftPatchSchema=z.object({target:siteDraftTargetSchema,content:siteDraftContentSchema}).strict();
export type SiteDraftPatch=z.infer<typeof siteDraftPatchSchema>;
const siteDraftPatchesSchema=z.array(siteDraftPatchSchema).min(1,"Keep at least one change before checking the website.").max(siteDraftBatchLimits.maxPatches,"Check up to 12 changed sections together.").superRefine((patches,context)=>{
  const seen=new Set<string>();
  patches.forEach((patch,index)=>{
    const key=`${patch.target.pagePath}/${patch.target.sectionId}`;
    if(seen.has(key))context.addIssue({code:"custom",path:[index,"target"],message:"Keep only one change for each page introduction or section."});
    seen.add(key);
  });
});

/** Bound serialized form input before parsing, including UTF-8 multibyte content. */
export function parseSiteDraftPatches(input:unknown):SiteDraftPatch[]{
  let value=input;
  if(typeof value==="string"){
    if(value.length>siteDraftBatchLimits.maxBytes||new TextEncoder().encode(value).byteLength>siteDraftBatchLimits.maxBytes)throw new SiteBlueprintError("These draft changes are too long. Check fewer sections together.");
    try{value=JSON.parse(value);}catch{throw new SiteBlueprintError("Review the saved section changes before applying them.");}
  }
  const patches=siteDraftPatchesSchema.parse(value);
  if(new TextEncoder().encode(JSON.stringify(patches)).byteLength>siteDraftBatchLimits.maxBytes)throw new SiteBlueprintError("These draft changes are too long. Check fewer sections together.");
  return patches;
}

/** Validate every target before returning one immutable, all-or-nothing candidate. */
export function applySiteDraftPatches(blueprint:SiteBlueprint,input:unknown):SiteBlueprint{
  return parseSiteDraftPatches(input).reduce((candidate,patch)=>applySiteDraftPatch(candidate,patch.target,patch.content),blueprint);
}

/** A scoped data patch cannot change pages, contacts, forms, action targets or assets. */
export function applySiteDraftPatch(blueprint:SiteBlueprint,target:SiteDraftTarget,content:SiteDraftContent):SiteBlueprint {
  const where=siteDraftTargetSchema.parse(target),patch=siteDraftContentSchema.parse(content),next=structuredClone(blueprint);
  const page=next.pages.find(page=>page.path===where.pagePath);
  if(!page)throw new SiteBlueprintError("Choose a page in this saved website.");
  if(where.sectionId==="__intro__"){
    if(patch.layout!==null||patch.items!==null)throw new SiteBlueprintError("The page introduction supports headline and description edits.");
    page.hero.headline=patch.headline;page.hero.body=patch.body;
    if(page.path==="index.html"&&next.presentation?.heroEmphasis&&!patch.headline.includes(next.presentation.heroEmphasis))next.presentation.heroEmphasis=null;
  }else{
    const section=page.sections.find(section=>section.id===where.sectionId);
    if(!section)throw new SiteBlueprintError("Choose a section in this saved website.");
    const bound=(next.interactions?.actions||[]).some(action=>action.pagePath===where.pagePath&&action.sectionId===where.sectionId)||(next.presentation?.sectionImages||[]).some(image=>image.pagePath===where.pagePath&&image.sectionId===where.sectionId&&image.itemIndex!==null);
    if(bound&&patch.items&&patch.items.length!==section.items.length)throw new SiteBlueprintError("These items have links or images. Keep their number and order while editing their wording.");
    section.title=patch.headline;section.body=patch.body;
    if(patch.layout!==null)section.layout=patch.layout;
    if(patch.items!==null)section.items=patch.items;
  }
  return validateBlueprintStructure(next);
}
