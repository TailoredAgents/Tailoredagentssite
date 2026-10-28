/** Free local benchmark run; no provider requests, live credentials, databases or
 * deployments. Fixtures prove renderer/QA behavior, never generated-site quality. */
import {mkdir,writeFile,readFile,readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {tmpdir} from "node:os";
import {chromium} from "playwright";
import sharp from "sharp";
import {factoryBenchmarkCases,benchmarkArtwork} from "../lib/factory/site/benchmark-fixtures";
import {qualityCohortCases,qualityCohortManifest,qualityCohortVersion,qualityBaselineRevision,qualityCohortLogo} from "../lib/factory/site/quality-cohort";
import {factoryModelPolicy} from "../lib/factory/config";
import {siteQualityRubric,siteQualityBenchmarks} from "../lib/factory/site/benchmarks";
import {preparePortableImages,preparePortableLogo} from "../lib/factory/site/images";
import {portableBundle} from "../lib/factory/site/validate";
import {renderPortableSite} from "../lib/factory/site/render";
import {checkPortableSite,screenshotPath} from "../lib/factory/site/qa";
import {reviewSiteDepth} from "../lib/factory/site/quality";
import {checkSiteDelivery} from "../lib/factory/site/performance";
import type {SiteFiles} from "../lib/factory/site/artifacts";

const sha=(data:string|Uint8Array)=>createHash("sha256").update(data).digest("hex");
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
async function hashes(directory:string):Promise<Record<string,string>>{
  const result:Record<string,string>={};
  for(const entry of (await readdir(path.join(repository,directory),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    const relative=`${directory}/${entry.name}`;
    if(entry.isDirectory())Object.assign(result,await hashes(relative));
    else if(!entry.name.endsWith(".test.ts"))result[relative]=sha(await readFile(path.join(repository,relative)));
  }
  return result;
}
function git(args:string[]){try{return execFileSync("git",["-C",repository,...args],{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim();}catch{return null;}}

async function main(){
const arguments_=process.argv.slice(2),expanded=arguments_.includes("--cohort"),identity=arguments_.includes("--identity");
const revisionArgument=arguments_.find(item=>item.startsWith("--source-revision="))?.slice("--source-revision=".length);
if(revisionArgument&&!/^[a-f0-9]{40}$/.test(revisionArgument))throw new Error("Supply the full source revision hash.");
const output=path.resolve(arguments_.find(item=>!item.startsWith("--"))||path.join(tmpdir(),`tailored-agents-factory-quality-${Date.now()}`));
// Never replace an earlier evaluation. Results are evidence, including failures.
await mkdir(output);
const startedAt=new Date().toISOString(),sourceHashes=await hashes("lib/factory");
const sourceRevision=revisionArgument||git(["rev-parse","HEAD"]);
if(!sourceRevision)throw new Error("A git revision or --source-revision=<full hash> is required.");
const runnerHash=sha(await readFile(fileURLToPath(import.meta.url))),lockHash=sha(await readFile(path.join(repository,"package-lock.json")));
const source={revision:sourceRevision,revisionOrigin:revisionArgument?"explicit frozen snapshot":"git checkout",dirtyFiles:git(["status","--porcelain"]),sourceHashes,runnerSha256:runnerHash,packageLockSha256:lockHash,sourceTreeSha256:sha(JSON.stringify(sourceHashes))};
const browserEnv:Record<string,string>={PATH:process.env.PATH||"",HOME:tmpdir(),TMPDIR:tmpdir(),TEMP:tmpdir(),TMP:tmpdir()};
for(const key of ["SystemRoot","WINDIR","DISPLAY","PLAYWRIGHT_BROWSERS_PATH"])if(process.env[key])browserEnv[key]=process.env[key]!;
const browser=await chromium.launch({headless:true,env:browserEnv,chromiumSandbox:process.platform==="linux"});
const cases=expanded?qualityCohortCases():factoryBenchmarkCases(),results:Array<Record<string,unknown>>=[];
const manifest={version:expanded?qualityCohortVersion:"legacy-five-v1",baselineRevision:qualityBaselineRevision,cases:expanded?qualityCohortManifest:qualityCohortManifest.slice(0,5),rubric:siteQualityRubric,derivedIdentity:identity};
const provenance={startedAt,source,manifest,manifestSha256:sha(JSON.stringify(manifest)),node:process.version,platform:process.platform,architecture:process.arch,browser:browser.version(),sharp:sharp.versions,configuredModelPolicy:factoryModelPolicy,modelsInvoked:[],providerRequests:0,providerCostMicros:0,ledgerReferences:[],rendering:"hand-authored fixture blueprints",labMode:"in-memory unthrottled Chromium",liveEnvironmentLoaded:false};
await writeFile(path.join(output,"provenance.json"),JSON.stringify(provenance,null,2));
try{
  for(const sample of cases){
    const directory=path.join(output,sample.id);await mkdir(directory,{recursive:true});
    await writeFile(path.join(directory,"brief.json"),JSON.stringify({plan:sample.plan,blueprint:sample.blueprint},null,2));
    await writeFile(path.join(directory,"human-review.json"),JSON.stringify({status:"not_reviewed",reviewer:null,benchmarkId:sample.id,sendWorthy:null,dimensions:Object.fromEntries(Object.keys(siteQualityRubric.dimensions).map(key=>[key,{score:null,evidence:[],correction:null}])),notes:"Compare desktop and mobile at readable size. This hand-authored fixture is not a sample of live AI generation."},null,2));
    try{
    const original=await sharp(Buffer.from(benchmarkArtwork(sample.blueprint.family))).png().toBuffer();
    const assets:SiteFiles=await preparePortableImages(original);
    for(const media of sample.blueprint.media||[]){const png=await sharp(Buffer.from(media.role==="logo"?qualityCohortLogo:benchmarkArtwork(sample.blueprint.family,true))).png().toBuffer();Object.assign(assets,await (media.role==="logo"?preparePortableLogo(png,media.id):preparePortableImages(png,media.id)));}
    if(identity){const {prepareSiteIdentity}=await import("../lib/factory/site/identity");Object.assign(assets,await prepareSiteIdentity(sample.blueprint,assets));}
    const {files}=renderPortableSite(portableBundle(sample.blueprint),assets,identity?{publicBaseUrl:`https://preview.example.test/p/${sample.id}/`}:undefined);
    for(const [filename,bytes]of Object.entries(files)){const destination=path.join(directory,"site",filename);await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,bytes);}
    const qa=await checkPortableSite({files,browser}),content=reviewSiteDepth(sample.blueprint,sample.plan),delivery=checkSiteDelivery(files);
    const issues=[...qa.issues,...content,...delivery.issues];
    for(const shot of qa.screenshots){const destination=path.join(directory,screenshotPath(shot.page,shot.viewport));await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,shot.bytes);}
    const artifactHashes=Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([name,bytes])=>[name,sha(bytes)]));
    const screenshotHashes=Object.fromEntries(qa.screenshots.map(shot=>[screenshotPath(shot.page,shot.viewport),sha(shot.bytes)]));
    const result={id:sample.id,label:sample.label,split:qualityCohortManifest.find(item=>item.id===sample.id)!.split,fixture:true,providerRequests:0,humanRating:null,passed:qa.passed&&!issues.some(i=>i.severity==="error"),issues,expected:sample.expected,delivery,labPerformance:qa.labPerformance,planSha256:sha(JSON.stringify(sample.plan)),blueprintSha256:sha(JSON.stringify(sample.blueprint)),artifactHashes,screenshotHashes};
    await writeFile(path.join(directory,"qa.json"),JSON.stringify(result,null,2));
    results.push(result);console.log(`${sample.id}: ${result.passed?"passed":"needs attention"}; ${issues.length} issue(s); ${directory}`);
    }catch(error){
      const failure={id:sample.id,label:sample.label,split:qualityCohortManifest.find(item=>item.id===sample.id)!.split,fixture:true,providerRequests:0,humanRating:null,passed:false,runError:error instanceof Error?error.message:"Render evaluation failed",issues:[]};
      results.push(failure);await writeFile(path.join(directory,"qa.json"),JSON.stringify(failure,null,2));console.log(`${sample.id}: evaluation error; ${failure.runError}; ${directory}`);
    }
  }
  const endingSourceHash=sha(JSON.stringify(await hashes("lib/factory")));
  await writeFile(path.join(output,"report.json"),JSON.stringify({generatedAt:new Date().toISOString(),kind:"local-synthetic-renderer-benchmarks",provenance,sourceChangedDuringRun:endingSourceHash!==source.sourceTreeSha256,providerRequests:0,fieldPerformanceMeasured:false,rubric:siteQualityRubric,references:siteQualityBenchmarks,results},null,2));
  await writeFile(path.join(output,"README.md"),`# Website builder quality fixtures\n\nRun: node --conditions=react-server --import tsx scripts/evaluate-factory-benchmarks.ts [outputDirectory]\n\nThese are hand-authored synthetic briefs and native geometric illustrations. No client lead, paid AI call or deployment is involved. Passing proves the tested renderer, action, accessibility, content and byte-budget checks; it does not establish that an AI-generated client site is beautiful or rates 85/100.\n\nEach case includes portable site/, desktop/mobile screenshots/, qa.json, brief.json and an unfilled human-review.json. Compare the readable screenshots and fill the human scores using report.json's rubric. The independent Cosmo's reference is https://cosmos-heating-air.onrender.com; use its composition/storytelling as a comparison, not unverified business facts or copied assets.\n\nLab timing uses in-memory, unthrottled Chromium. These are local navigation/paint/layout observations, not field Core Web Vitals, Lighthouse, representative mobile-network performance or an INP measurement. Resource budgets include actual per-page image variants, scripts, CSS and local fonts; initial totals exclude lazy images.\n\nBefore claiming rollout quality, run approved live generation across the same kinds of sparse/industry briefs, compare blindly with human reviewers, record defects, real spending and latency, and calibrate model scores to those judgments. Preserve existing build approval and spending caps.\n\nImplementation log: docs/WEBSITE_BUILDER_QUALITY_UPGRADE.md in the repository.\n\n${results.map(r=>`- ${r.id}: ${r.passed?"checks passed":"needs attention"}`).join("\n")}\n`);
  if(results.some(result=>!result.passed))process.exitCode=1;
}finally{await browser.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Benchmark run did not complete.");process.exitCode=1;});
