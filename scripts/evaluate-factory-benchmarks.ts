/** Free local benchmark run; no provider requests, live credentials, databases or
 * deployments. Fixtures prove renderer/QA behavior, never generated-site quality. */
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {chromium} from "playwright";
import sharp from "sharp";
import {factoryBenchmarkCases,benchmarkArtwork} from "../lib/factory/site/benchmark-fixtures";
import {siteQualityRubric,siteQualityBenchmarks} from "../lib/factory/site/benchmarks";
import {preparePortableImages} from "../lib/factory/site/images";
import {portableBundle} from "../lib/factory/site/validate";
import {renderPortableSite} from "../lib/factory/site/render";
import {checkPortableSite,screenshotPath} from "../lib/factory/site/qa";
import {reviewSiteDepth} from "../lib/factory/site/quality";
import {checkSiteDelivery} from "../lib/factory/site/performance";
import type {SiteFiles} from "../lib/factory/site/artifacts";

async function main(){
const output=path.resolve(process.argv[2]||path.join(tmpdir(),"tailored-agents-factory-quality-benchmarks"));
const browserEnv:Record<string,string>={PATH:process.env.PATH||"",HOME:tmpdir(),TMPDIR:tmpdir(),TEMP:tmpdir(),TMP:tmpdir()};
for(const key of ["SystemRoot","WINDIR","DISPLAY","PLAYWRIGHT_BROWSERS_PATH"])if(process.env[key])browserEnv[key]=process.env[key]!;
const browser=await chromium.launch({headless:true,env:browserEnv,chromiumSandbox:process.platform==="linux"});
const cases=factoryBenchmarkCases(),results:Array<Record<string,unknown>>=[];
await mkdir(output,{recursive:true});
try{
  for(const sample of cases){
    const directory=path.join(output,sample.id);await mkdir(directory,{recursive:true});
    const original=await sharp(Buffer.from(benchmarkArtwork(sample.blueprint.family))).png().toBuffer();
    const assets:SiteFiles=await preparePortableImages(original);
    for(const media of sample.blueprint.media||[]){const png=await sharp(Buffer.from(benchmarkArtwork(sample.blueprint.family,true))).png().toBuffer();Object.assign(assets,await preparePortableImages(png,media.id));}
    const {files}=renderPortableSite(portableBundle(sample.blueprint),assets);
    for(const [filename,bytes]of Object.entries(files)){const destination=path.join(directory,"site",filename);await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,bytes);}
    const qa=await checkPortableSite({files,browser}),content=reviewSiteDepth(sample.blueprint,sample.plan),delivery=checkSiteDelivery(files);
    const issues=[...qa.issues,...content,...delivery.issues];
    for(const shot of qa.screenshots){const destination=path.join(directory,screenshotPath(shot.page,shot.viewport));await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,shot.bytes);}
    const result={id:sample.id,label:sample.label,fixture:true,providerRequests:0,humanRating:null,passed:qa.passed&&!issues.some(i=>i.severity==="error"),issues,expected:sample.expected,delivery,labPerformance:qa.labPerformance};
    await writeFile(path.join(directory,"qa.json"),JSON.stringify(result,null,2));
    await writeFile(path.join(directory,"brief.json"),JSON.stringify({plan:sample.plan,blueprint:sample.blueprint},null,2));
    await writeFile(path.join(directory,"human-review.json"),JSON.stringify({status:"not_reviewed",reviewer:null,benchmarkId:sample.id,dimensions:Object.fromEntries(Object.keys(siteQualityRubric.dimensions).map(key=>[key,{score:null,evidence:[],correction:null}])),notes:"Compare desktop and mobile at readable size. This hand-authored fixture is not a sample of live AI generation."},null,2));
    results.push(result);console.log(`${sample.id}: ${result.passed?"passed":"needs attention"}; ${issues.length} issue(s); ${directory}`);
  }
  await writeFile(path.join(output,"report.json"),JSON.stringify({generatedAt:new Date().toISOString(),kind:"local-synthetic-renderer-benchmarks",providerRequests:0,fieldPerformanceMeasured:false,rubric:siteQualityRubric,references:siteQualityBenchmarks,results},null,2));
  await writeFile(path.join(output,"README.md"),`# Website builder quality fixtures\n\nRun: node --conditions=react-server --import tsx scripts/evaluate-factory-benchmarks.ts [outputDirectory]\n\nThese are hand-authored synthetic briefs and native geometric illustrations. No client lead, paid AI call or deployment is involved. Passing proves the tested renderer, action, accessibility, content and byte-budget checks; it does not establish that an AI-generated client site is beautiful or rates 85/100.\n\nEach case includes portable site/, desktop/mobile screenshots/, qa.json, brief.json and an unfilled human-review.json. Compare the readable screenshots and fill the human scores using report.json's rubric. The independent Cosmo's reference is https://cosmos-heating-air.onrender.com; use its composition/storytelling as a comparison, not unverified business facts or copied assets.\n\nLab timing uses in-memory, unthrottled Chromium. These are local navigation/paint/layout observations, not field Core Web Vitals, Lighthouse, representative mobile-network performance or an INP measurement. Resource budgets include actual per-page image variants, scripts, CSS and local fonts; initial totals exclude lazy images.\n\nBefore claiming rollout quality, run approved live generation across the same kinds of sparse/industry briefs, compare blindly with human reviewers, record defects, real spending and latency, and calibrate model scores to those judgments. Preserve existing build approval and spending caps.\n\nImplementation log: docs/WEBSITE_BUILDER_QUALITY_UPGRADE.md in the repository.\n\n${results.map(r=>`- ${r.id}: ${r.passed?"checks passed":"needs attention"}`).join("\n")}\n`);
  if(results.some(result=>!result.passed))process.exitCode=1;
}finally{await browser.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Benchmark run did not complete.");process.exitCode=1;});
