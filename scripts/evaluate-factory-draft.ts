/** Replay an extracted private diagnostic without providers, credentials,
 * database writes, publishing or network access from the rendered site.
 * node --conditions=react-server --import tsx scripts/evaluate-factory-draft.ts <diagnostic-directory> [new-output-directory]
 */
import {mkdir,readFile,realpath,stat,writeFile,mkdtemp} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {chromium} from "playwright";
import {factoryDiagnosticLimits,parseFactoryDraftDiagnostic,prepareFactoryDiagnosticAssets} from "../lib/factory/site/diagnostic";
import {portableBundle} from "../lib/factory/site/validate";
import {renderPortableSite} from "../lib/factory/site/render";
import {checkPortableSite,screenshotPath} from "../lib/factory/site/qa";
import {reviewSiteDepth} from "../lib/factory/site/quality";
import {checkSiteDelivery} from "../lib/factory/site/performance";
import {applyApprovedDesign} from "../lib/factory/site/design";
import {validateSiteBlueprint} from "../lib/factory/site/validate";

async function main(){
  if(!process.argv[2])throw new Error("Use: node --conditions=react-server --import tsx scripts/evaluate-factory-draft.ts <extracted-diagnostic-directory> [new-output-directory]");
  const input=await realpath(path.resolve(process.argv[2]));
  async function load(file:string,maximumBytes:number){
    const target=await realpath(path.join(input,file)),relative=path.relative(input,target);
    if(relative.startsWith(`..${path.sep}`)||relative===".."||path.isAbsolute(relative))throw new Error("A diagnostic file resolves outside its extracted directory.");
    const info=await stat(target);if(!info.isFile()||info.size>maximumBytes)throw new Error("A diagnostic file exceeds its local replay size limit.");
    const bytes=await readFile(target);if(bytes.byteLength>maximumBytes)throw new Error("A diagnostic file exceeds its local replay size limit.");return bytes;
  }
  const diagnostic=parseFactoryDraftDiagnostic(JSON.parse((await load("draft.json",factoryDiagnosticLimits.jsonBytes)).toString("utf8")));
  const blueprint=validateSiteBlueprint(applyApprovedDesign(diagnostic.blueprint,diagnostic.plan),diagnostic.plan);
  const assets=await prepareFactoryDiagnosticAssets(diagnostic,load),{files}=renderPortableSite(portableBundle(blueprint),assets);
  // Require a new directory so a replay never overwrites source artifacts or
  // leaves stale pages from an earlier run in the review evidence.
  const output=process.argv[3]?path.resolve(process.argv[3]):await mkdtemp(path.join(tmpdir(),"factory-draft-replay-"));
  if(process.argv[3])await mkdir(output,{recursive:false});
  const browserEnv:Record<string,string>={PATH:process.env.PATH||"",HOME:tmpdir(),TMPDIR:tmpdir(),TEMP:tmpdir(),TMP:tmpdir()};
  for(const key of ["SystemRoot","WINDIR","DISPLAY","PLAYWRIGHT_BROWSERS_PATH"])if(process.env[key])browserEnv[key]=process.env[key]!;
  const browser=await chromium.launch({headless:true,env:browserEnv,chromiumSandbox:process.platform==="linux"});
  try{
    for(const [filename,bytes]of Object.entries(files)){const destination=path.join(output,"site",filename);await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,bytes);}
    const qa=await checkPortableSite({files,browser,blueprint}),content=reviewSiteDepth(blueprint,diagnostic.plan),delivery=checkSiteDelivery(files);
    const issues=[...qa.issues,...content,...delivery.issues],passed=qa.passed&&!issues.some(issue=>issue.severity==="error");
    for(const shot of qa.screenshots){const destination=path.join(output,screenshotPath(shot.page,shot.viewport));await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,shot.bytes);}
    const report={kind:"local-saved-draft-replay",generatedAt:new Date().toISOString(),websiteVersion:diagnostic.websiteVersion??null,providerRequests:0,paidVisualReview:false,productionWrite:false,fieldPerformanceMeasured:false,passed,issues,delivery,labPerformance:qa.labPerformance,regions:qa.screenshots.map(({page,viewport,regions})=>({page,viewport,regions}))};
    await writeFile(path.join(output,"report.json"),JSON.stringify(report,null,2));
    await writeFile(path.join(output,"README.md"),`# Saved website draft: local review\n\nThis privately exported draft was rendered with the current local code. No AI requests, approval, database changes, publication or preview replacement occurred. The saved text, plan, routes and image bytes remain unchanged.\n\nBrowser, content and byte-budget checks: **${passed?"passed":"needs attention"}** (${issues.length} findings). See report.json and screenshots/. The site/ directory is a local review artifact; do not publish a failed draft. Lab observations use in-memory unthrottled Chromium and are not field Core Web Vitals or a new model/human design score.\n\nTreat this directory as private client material. It includes the draft's published-intent text and imagery; it contains no application credentials or worker/provider state.\n`);
    console.log(`Saved draft local replay: ${passed?"passed":"needs attention"}; ${issues.length} issue(s).\n${output}`);
    if(!passed)process.exitCode=1;
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Saved draft local replay did not complete.");process.exitCode=1;});
