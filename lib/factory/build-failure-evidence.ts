import type { FactoryBuildFailureQa } from "./build-types";
import type { SiteIssue, SiteQaResult } from "./site/artifacts";
import { safeSitePath, siteLimits } from "./site/artifacts";
import type { FactoryStorage } from "./storage";

const maximumScreenshotBytes=10_000_000;
const maximumEvidenceBytes=60_000_000;
const buildPrefix=/^factory\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/$/i;
const viewports=["desktop","mobile"] as const;

export function isFactoryEvidencePage(value:unknown):value is string {
  if(typeof value!=="string"||!/^(index\.html|[a-z][a-z0-9-]{0,48}\/index\.html)$/.test(value))return false;
  try{return safeSitePath(value)===value;}catch{return false;}
}

/** Deterministic keys, never a user-provided object path. Retain legacy Home keys. */
export function factoryFailureScreenshotKey(prefix:string,page:string,viewport:"desktop"|"mobile") {
  if(!buildPrefix.test(prefix)||!isFactoryEvidencePage(page)||!viewports.includes(viewport))throw new Error("Invalid failed website evidence path.");
  return page==="index.html"?`${prefix}failed/screenshots/${viewport}.png`:`${prefix}failed/pages/${page.slice(0,-5)}-${viewport}.png`;
}

export function boundedFactoryFailureIssues(value:unknown):SiteIssue[] {
  if(!Array.isArray(value))return [];
  const valid=value.filter((issue):issue is SiteIssue=>Boolean(issue)&&typeof issue.code==="string"&&typeof issue.message==="string"&&typeof issue.page==="string"&&["error","warning"].includes(issue.severity));
  return [...valid.filter(issue=>issue.severity==="error"),...valid.filter(issue=>issue.severity==="warning")].slice(0,30).map(issue=>({code:issue.code.slice(0,100),message:issue.message.slice(0,1000),page:issue.page.slice(0,180),severity:issue.severity,...(viewports.includes(issue.viewport as typeof viewports[number])?{viewport:issue.viewport}:{})}));
}

/** Project diagnostic fields only; raw model responses, prompts and extra keys stay private. */
export function readFactoryFailureEvidence(value:unknown,prefix:string):FactoryBuildFailureQa|null {
  if(!buildPrefix.test(prefix)||!value||typeof value!=="object")return null;
  const report=value as Partial<FactoryBuildFailureQa>;
  if(typeof report.checkedAt!=="string"||!Number.isFinite(Date.parse(report.checkedAt))||!Array.isArray(report.issues))return null;
  const screenshots:FactoryBuildFailureQa["screenshots"]={};
  for(const view of viewports)if(report.screenshots?.[view]===factoryFailureScreenshotKey(prefix,"index.html",view))screenshots[view]=report.screenshots[view];
  const pageScreenshots:NonNullable<FactoryBuildFailureQa["pageScreenshots"]>=[],seen=new Set<string>();
  if(Array.isArray(report.pageScreenshots))for(const shot of report.pageScreenshots.slice(0,siteLimits.maximumPages*2)){
    if(!shot||!isFactoryEvidencePage(shot.page)||!viewports.includes(shot.viewport)||shot.storageKey!==factoryFailureScreenshotKey(prefix,shot.page,shot.viewport))continue;
    const identity=`${shot.page}:${shot.viewport}`;if(seen.has(identity))continue;seen.add(identity);
    pageScreenshots.push({page:shot.page,viewport:shot.viewport,storageKey:shot.storageKey});
  }
  // Preserve an absent list for legacy failures so the UI can explain Home-only evidence.
  for(const view of viewports)if(screenshots[view]&&!seen.has(`index.html:${view}`))pageScreenshots.push({page:"index.html",viewport:view,storageKey:screenshots[view]!});
  return {checkedAt:report.checkedAt,issues:boundedFactoryFailureIssues(report.issues),screenshots,...(Array.isArray(report.pageScreenshots)?{pageScreenshots:pageScreenshots.slice(0,siteLimits.maximumPages*2)}:{})};
}

/** Best-effort private evidence. The caller saves errors before this and the result after it.
 * Failure pages come first; all rendered pages remain available within the ten-page site limit.
 * Only manifest pages and local QA screenshots may be stored. No model-supplied URL is fetched. */
export async function saveFactoryFailureScreenshots(input:{report:FactoryBuildFailureQa;qa:SiteQaResult;prefix:string;pages:string[];storage:Pick<FactoryStorage,"put">}) {
  const allowed=[...new Set(input.pages.filter(isFactoryEvidencePage))].slice(0,siteLimits.maximumPages);
  const pages=[...new Set([...input.report.issues.filter(issue=>issue.severity==="error").map(issue=>issue.page),"index.html",...allowed])].filter(page=>allowed.includes(page));
  input.report.pageScreenshots=[];let totalBytes=0;
  for(const page of pages)for(const viewport of viewports){
    const shot=input.qa.screenshots.find(candidate=>candidate.page===page&&candidate.viewport===viewport);
    if(!shot||!(shot.bytes instanceof Uint8Array)||!shot.bytes.byteLength||shot.bytes.byteLength>maximumScreenshotBytes||totalBytes+shot.bytes.byteLength>maximumEvidenceBytes)continue;
    const storageKey=factoryFailureScreenshotKey(input.prefix,page,viewport);
    // A failed upload does not hide other useful screenshots or overwrite the original error.
    try{await input.storage.put(storageKey,shot.bytes,"image/png");}catch{continue;}
    totalBytes+=shot.bytes.byteLength;input.report.pageScreenshots.push({page,viewport,storageKey});
    if(page==="index.html")input.report.screenshots[viewport]=storageKey;
  }
}
