import type { FactoryPlanContent } from "./types";
import type { FactoryBuildActivity } from "./build-progress";
import type { SiteLabPerformance } from "./site/performance";
import type { SiteScorecard } from "./site/review";
import type { SiteIssue } from "./site/artifacts";
export type FactoryBuildStage = "generate" | "images" | "qa" | "publish" | "verify";
export type FactoryBuildStatus = "queued" | "running" | "ready" | "failed" | "cancelled";
// Two assessments, with one extra request only after an explicit failed-build retry.
export const maximumReviewAttempts=3;
export type FactoryBuildManifest = { entrypoint: "index.html"; files: Array<{path:string;contentType:string;size:number;sha256:string}> };
export type FactoryBuildQa = { passed:boolean; checks:string[]; warnings:string[]; screenshots:{desktop:string;mobile:string};
  designReview?:{summary:string;reviewedPages:string[];imageCount:number;reviewVersion?:2;overallScore?:number;scorecard?:SiteScorecard};
  labPerformance?:SiteLabPerformance[];
  delivery?:{pages:Array<{page:string;mobileBytes:number;desktopBytes:number}>};
  pageScreenshots?:Array<{page:string;viewport:"desktop"|"mobile";storageKey:string}>;
};
/** Private diagnostic evidence for a failed check; never a passing/published artifact. */
export type FactoryBuildFailureQa = {checkedAt:string;issues:SiteIssue[];screenshots:Partial<Record<"desktop"|"mobile",string>>;designReview?:FactoryBuildQa["designReview"]};
export type FactoryBuildSettings = {enabled:boolean;monthlyBudgetMicros:number;perBuildBudgetMicros:number;budgetApprovedAt:string|null};
export type FactoryBuildVersion = {id:string;version:number;planId:string;planVersion:number;status:FactoryBuildStatus;stage:FactoryBuildStage;error:string|null;createdAt:string;updatedAt:string;activity:FactoryBuildActivity|null;readyAt:string|null;previewUrl:string|null;sourceReady:boolean;qaReport:FactoryBuildQa|null;failedQa?:FactoryBuildFailureQa|null;revokedAt:string|null;expiresAt:string;retryCount:number;reviewAttempts?:number};
export type FactoryUpload = {id:string;filename:string;contentType:string;byteSize:number;createdAt:string;role?:"photo"|"logo";alt?:string};
export type FactoryProjectBuilds = {settings:FactoryBuildSettings;monthSpentMicros:number;canManage:boolean;canEdit:boolean;config:{configured:boolean;reason?:string};versions:FactoryBuildVersion[];uploads:FactoryUpload[]};
export type FactoryClaimedBuild = {id:string;workspaceId:string;projectId:string;buildRequestId:string;planId:string;plan:FactoryPlanContent;version:number;stage:FactoryBuildStage;leaseToken:string;leaseUntil:string;attempt:number;workingData:Record<string,unknown>;storagePrefix:string;previewToken:string;uploads:Array<FactoryUpload & {storageKey:string}>};
export type FactoryBuildVerification = {url:string;status:200;checkedAt:string};
export type FactoryBuildStageResult = {versionId:string;leaseToken:string;stage:FactoryBuildStage;nextStage:FactoryBuildStage;workingData:Record<string,unknown>;manifest?:FactoryBuildManifest;qaReport?:FactoryBuildQa;sourceKey?:string};
export type FactoryBuildFinish = {versionId:string;leaseToken:string;manifest:FactoryBuildManifest;qaReport:FactoryBuildQa;sourceKey:string;verification:FactoryBuildVerification};
