import type {FactoryClaimedBuild} from "./build-types";
import type {FactorySavedImage} from "./build-assets";
import type {SiteBlueprint} from "./site/types";
import type {SiteDraftTarget} from "./site/draft";

export type FactoryDraftSnapshot={version:1;blueprint:SiteBlueprint;heroKey:string;imageAssets:Record<string,FactorySavedImage>;inputUploads:FactoryClaimedBuild["uploads"];provenance:unknown};
export type FactoryDraftRevision={version:1;sourceVersionId:string;sourcePrefix:string;sourceImageAssets:Record<string,FactorySavedImage>;sourceHeroKey:string;sourceProvenance:unknown;mode:"manual"|"ai"|"restore";target?:SiteDraftTarget;instruction?:string};
export type FactoryDraftDocument={versionId:string;fingerprint:string;parentVersionId:string|null;spentMicros:number;remainingMicros:number;pages:Array<{path:string;title:string;hero:{headline:string;body:string};sections:Array<{id:string;title:string;body:string;layout:SiteBlueprint["pages"][number]["sections"][number]["layout"];items:Array<{title:string;body:string}>}>}>};
