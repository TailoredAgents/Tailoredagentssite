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
