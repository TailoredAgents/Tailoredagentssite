import type { FactoryPlanContent } from "../types";
import type { SiteIssue } from "./artifacts";

export const designFamilyIds=["trades","editorial","wellness","hospitality","professional","general"] as const;
export type DesignFamilyId=typeof designFamilyIds[number];
export const heroCompositions=["split","immersive","editorial","centered","asymmetric","minimal"] as const;
export type HeroComposition=typeof heroCompositions[number];
export type SiteBlueprint={
  version:1;brandName:string;tagline:string;family:DesignFamilyId;composition:HeroComposition;
  accent:string;fontPair:"modern"|"editorial"|"humanist";
  pages:Array<{path:string;title:string;description:string;hero:{eyebrow:string;headline:string;body:string;primaryCta:string;secondaryCta:string};
    sections:Array<{id:string;kind:"services"|"about"|"process"|"features"|"faq"|"contact"|"statement";layout:"grid"|"rows"|"split"|"editorial"|"timeline"|"band";eyebrow:string;title:string;body:string;items:Array<{title:string;body:string}>}>}>;
  heroImage:{prompt:string;alt:string;caption:string};
  contact:{email:string|null;phone:string|null;address:string|null};
  factualClaims:Array<{text:string;detailIndex:number}>;
  productionTasks:string[];assumptions:string[];
};
export type SiteAssetDescriptor={id:string;path:string;alt:string;provenance:"generated"|"provided";caption?:string};
export type PortableSiteBundle={version:1;title:string;designFamily:DesignFamilyId;pages:Array<{path:string;title:string}>;
  imageSlots:Array<{id:"hero";path:"assets/images/hero.png";prompt:string;alt:string;caption:string}>;
  productionTasks:string[];assumptions:string[];blueprint:SiteBlueprint};
export type SiteUsage={providerId:string;inputTokens:number;outputTokens:number;estimatedMicros:number};
export type SiteModelRequest={stage:"generate"|"repair";model:string;body:Record<string,unknown>;inputBytes:number;maxOutputTokens:number;reservedMicros:number};
/** Executor owns reserve -> commit attempt -> HTTP -> settle/uncertain. No HTTP retry. */
export type SiteModelExecutor=(request:SiteModelRequest)=>Promise<unknown>;
export type SiteGenerationInput={plan:FactoryPlanContent;family?:DesignFamilyId;previousBlueprint?:SiteBlueprint;repairIssues?:SiteIssue[];assets?:SiteAssetDescriptor[]};
