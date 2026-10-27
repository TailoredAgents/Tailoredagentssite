import type { FactoryPlanContent } from "../types";
import type { SiteIssue, SiteQaResult } from "./artifacts";

export const designFamilyIds=["trades","editorial","wellness","hospitality","professional","general"] as const;
export type DesignFamilyId=typeof designFamilyIds[number];
export const heroCompositions=["split","immersive","editorial","centered","asymmetric","minimal","framed"] as const;
export type HeroComposition=typeof heroCompositions[number];
export const sectionLayouts=["grid","rows","split","editorial","timeline","band","showcase","checklist","spotlight","feature-list","comparison","image-grid","alternating","service-tabs"] as const;
export const fontThemes=["studio","editorial","warm","technical"] as const;
export type SiteMedia={id:string;role:"logo"|"photo";source:"provided"|"generated";uploadId:string|null;prompt:string;alt:string;caption:string};
export type SitePresentation={version:1;fontTheme:typeof fontThemes[number];heroEmphasis:string|null;logoAssetId:string|null;
  pageImages:Array<{pagePath:string;assetId:string}>;
  sectionImages:Array<{pagePath:string;sectionId:string;assetId:string;itemIndex:number|null}>};
export type SiteDesign={
  version:1;
  palette:{background:string;surface:string;ink:string;muted:string;accent:string;accentSecondary:string};
  typography:{heading:"modern"|"editorial"|"humanist"|"geometric";body:"modern"|"humanist";scale:"balanced"|"expressive";weight:400|600|700|800};
  density:"compact"|"balanced"|"airy";radius:"square"|"soft"|"rounded";
  heroFocalPoint:{x:number;y:number};
  sectionStyles:Array<{pagePath:string;sectionId:string;tone:"base"|"surface"|"contrast"|"accent"}>;
};
export const siteFormFields=["name","email","phone","location","message","preferredContact","contactDetail"] as const;
export type SiteInteractions={version:1;
  forms:Array<{pagePath:string;sectionId:string;fields:Array<typeof siteFormFields[number]>;submitLabel:string}>;
  actions:Array<{pagePath:string;sectionId:string;itemIndex:number;label:string;targetPage:string;targetSection:string|null}>;
};
export type SiteBlueprint={
  version:1;brandName:string;tagline:string;family:DesignFamilyId;composition:HeroComposition;
  accent:string;fontPair:"modern"|"editorial"|"humanist";
  /** Absent for saved v1 blueprints; those retain their original family defaults. */
  design?:SiteDesign;
  /** Explicit forms/actions for new builds; absent preserves legacy rendering. */
  interactions?:SiteInteractions;
  /** Optional on immutable older blueprints; required in new generation requests. */
  media?:SiteMedia[];
  presentation?:SitePresentation;
  pages:Array<{path:string;title:string;description:string;hero:{eyebrow:string;headline:string;body:string;primaryCta:string;secondaryCta:string};
    sections:Array<{id:string;kind:"services"|"about"|"process"|"features"|"faq"|"contact"|"statement";layout:typeof sectionLayouts[number];eyebrow:string;title:string;body:string;items:Array<{title:string;body:string}>}>}>;
  heroImage:{prompt:string;alt:string;caption:string};
  contact:{email:string|null;phone:string|null;address:string|null};
  factualClaims:Array<{text:string;detailIndex:number}>;
  productionTasks:string[];assumptions:string[];
};
export type SiteAssetDescriptor={id:string;path:string;alt:string;provenance:"generated"|"provided";caption?:string;role?:"logo"|"photo"};
export type PortableSiteBundle={version:1;title:string;designFamily:DesignFamilyId;pages:Array<{path:string;title:string}>;
  imageSlots:Array<{id:"hero";path:"assets/images/hero.png";prompt:string;alt:string;caption:string}>;
  productionTasks:string[];assumptions:string[];blueprint:SiteBlueprint};
export type SiteUsage={providerId:string;inputTokens:number;outputTokens:number;estimatedMicros:number};
export type SiteModelRequest={stage:"generate"|"repair"|"review";model:string;body:Record<string,unknown>;inputBytes:number;maxOutputTokens:number;reservedMicros:number};
/** Executor owns reserve -> commit attempt -> HTTP -> settle/uncertain. No HTTP retry. */
export type SiteModelExecutor=(request:SiteModelRequest)=>Promise<unknown>;
export type SiteGenerationInput={plan:FactoryPlanContent;family?:DesignFamilyId;previousBlueprint?:SiteBlueprint;repairIssues?:SiteIssue[];repairScreenshots?:SiteQaResult["screenshots"];assets?:SiteAssetDescriptor[]};
