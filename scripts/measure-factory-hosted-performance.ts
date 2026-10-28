import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {cpus,platform,release,tmpdir,totalmem} from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {chromium,type Browser} from "playwright";
import {defaultHostedPerformanceUrls,defaultPreviewOrigins,hostedPerformanceProfile,hostedPerformanceVersion,measureHostedPerformancePair,previewNetworkPatterns,summarizeHostedPerformance,validateMeasurementUrl,validatePreviewOrigin,type HostedPerformanceSample} from "../lib/factory/site/hosted-performance";

/** Read-only, unauthenticated hosted preview measurements. Output is deliberately
 * local: no HTML, screenshots, contact values, cookies or auth state are saved. */
async function main(){
  const args=process.argv.slice(2),urls:string[]=[],origins=[...defaultPreviewOrigins];
  let runs=3,output=path.join(tmpdir(),`ta-factory-hosted-performance-${new Date().toISOString().replace(/[:.]/g,"-")}`);
  for(let index=0;index<args.length;index++){
    const key=args[index],value=args[index+1];
    if(key==="--help"){console.log("Usage: node --import tsx scripts/measure-factory-hosted-performance.ts [--url HTTPS_PREVIEW ...] [--preview-origin HTTPS_ORIGIN ...] [--runs 3..7] [--output NEW_DIRECTORY]\nDefaults: Cosmo v9 branded Home shortlink, Services and Contact; three cold/warm pairs. Reports remain local.");return;}
    if(!value||value.startsWith("--"))throw new Error(`Missing value for ${key}.`);
    if(key==="--url")urls.push(value);else if(key==="--preview-origin")origins.push(validatePreviewOrigin(value));else if(key==="--output")output=path.resolve(value);else if(key==="--runs")runs=Number(value);else throw new Error(`Unknown option: ${key}.`);
    index++;
  }
  if(!Number.isInteger(runs)||runs<3||runs>7)throw new Error("Use three to seven cold/warm repetitions.");
  if(origins.length>5)throw new Error("At most five preview origins may be configured.");
  const targets=[...new Set((urls.length?urls:defaultHostedPerformanceUrls).map(url=>validateMeasurementUrl(url,origins)))];
  if(targets.length>6)throw new Error("At most six public preview pages may be measured per run.");
  const require=createRequire(import.meta.url),playwrightVersion=(require("playwright/package.json") as {version:string}).version;
  let gitRevision:string|null=null,workingTreeDirty:boolean|null=null;
  try{gitRevision=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();workingTreeDirty=Boolean(execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim());}catch{/* Exported checkouts still record source hashes. */}
  const sources=["scripts/measure-factory-hosted-performance.ts","lib/factory/site/hosted-performance.ts"];
  const sourceSha256=Object.fromEntries(await Promise.all(sources.map(async file=>[file,createHash("sha256").update(await readFile(path.resolve(file))).digest("hex")])));
  await mkdir(output,{recursive:false});
  let browser:Browser|null=null,userAgent="",interrupted=false;
  const interrupt=()=>{interrupted=true;void browser?.close().catch(()=>{});};
  process.once("SIGINT",interrupt);process.once("SIGTERM",interrupt);
  const samples:HostedPerformanceSample[]=[],startedAt=new Date().toISOString();
  const report={schemaVersion:1,measurementVersion:hostedPerformanceVersion,startedAt,completedAt:null as string|null,
    provenance:{gitRevision,workingTreeDirty,sourceSha256,playwrightVersion,browserVersion:null as Record<string,string>|null,nodeVersion:process.version,os:{platform:platform(),release:release(),architecture:process.arch,cpuModel:cpus()[0]?.model||null,logicalCpus:cpus().length,memoryBytes:totalmem()}},
    settings:{...hostedPerformanceProfile,runs,userAgent,allowedPreviewOrigins:origins,allowedShareOrigin:"https://www.tailoredagents.com",networkProtocol:"Network.emulateNetworkConditionsByRule + Network.overrideNetworkState",httpCache:"cold: fresh context and cleared HTTP cache; warm: same context, new page, cache retained and enabled",serviceWorkers:"blocked and bypassed",navigation:"load event then fixed 5000 ms observation; no scroll or interaction"},
    limitations:["Controlled lab observations, not field Core Web Vitals, a Lighthouse score, INP, or a real-device test.","CPU slowdown is relative to this recorded host, not calibrated to a named physical phone.","Cold means browser HTTP cache only. Operating-system DNS, upstream CDN state and server warmness are not reset.","Warm measures a repeat navigation with cache permitted; no-store responses can produce zero actual cache hits.","LCP and CLS cover the initial viewport and recorded observation window, without scrolling or interactions. Later/lifetime shifts are not measured.","CDP received bytes include observed request/redirect traffic, not all below-fold lazy assets or the full-page 800 KB artifact budget.","The share URL follows real redirects. Navigation Timing can hide cross-origin redirect details; the CDP redirect chain is retained separately.","Third-party and non-preview paths are blocked; any blocked/missing/failed resource invalidates that sample instead of inflating a score.","All expected runs must be valid to publish a median for a route/cache group. Failures and raw observations remain in the report."],
    targets,samples,summaries:[] as ReturnType<typeof summarizeHostedPerformance>,failure:null as string|null};
  const save=async()=>{report.summaries=summarizeHostedPerformance(samples,targets,runs);await writeFile(path.join(output,"report.json"),`${JSON.stringify(report,null,2)}\n`);};
  try{
    await save();
    browser=await chromium.launch({headless:true});
    const probe=await browser.newContext(),probePage=await probe.newPage(),probeSession=await probe.newCDPSession(probePage);
    report.provenance.browserVersion=await probeSession.send("Browser.getVersion");await probe.close();
    const major=/\d+/.exec(browser.version())?.[0]||"0";userAgent=`Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Mobile Safari/537.36`;
    report.settings.userAgent=userAgent;await save();
    for(const url of targets)for(let run=1;run<=runs;run++){
      await measureHostedPerformancePair({browser,url,run,userAgent,settings:hostedPerformanceProfile,networkPatterns:previewNetworkPatterns(origins),onSample:sample=>{
        samples.push(sample);console.log(`${new URL(url).pathname} ${sample.mode} ${run}/${runs}: ${sample.valid?"valid":"FAILED"}; LCP ${sample.metrics?.lcpMs===null||sample.metrics?.lcpMs===undefined?"unavailable":`${Math.round(sample.metrics.lcpMs)} ms`}; ${Math.round(sample.transferBytes/1000)} KB received${sample.failures.length?`; ${sample.failures.join(" ")}`:""}`);
        if(sample.metrics&&sample.metrics.observerSupport.length===0)throw new Error("The browser measurement observer did not initialize; remaining navigations were stopped.");
      }});
      await save();
    }
  }catch(error){report.failure=interrupted?"Measurement interrupted; available samples are retained.":error instanceof Error?error.message.slice(0,500):"Measurement runner failed.";process.exitCode=1;}
  finally{report.completedAt=new Date().toISOString();await save();await browser?.close();process.removeListener("SIGINT",interrupt);process.removeListener("SIGTERM",interrupt);}
  const number=(value:number|null,precision=0)=>value===null?"unavailable":value.toFixed(precision);
  const rows=report.summaries.map(summary=>`| ${new URL(summary.url).pathname} | ${summary.mode} | ${summary.validRuns}/${runs} | ${number(summary.median.lcpMs)} | ${number(summary.median.cls,4)} | ${number(summary.median.ttfbMs)} | ${number(summary.median.transferBytes===null?null:summary.median.transferBytes/1000,1)} | ${number(summary.median.cachedRequestCount)} |`);
  const table=["| Route | Cache | Valid runs | LCP ms | Observed CLS | TTFB ms | Received KB | Cache hits |","| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",...rows].join("\n");
  const markdown=["# Hosted preview performance lab",`Measured ${report.completedAt}. Version ${hostedPerformanceVersion}.`,"Custom mobile profile: 390×844, DPR 2, 4× relative CPU slowdown, 150 ms minimum latency, 1.6 Mbps download / 750 Kbps upload. Three-run medians unless explicitly configured otherwise.",table,"Engineering targets are LCP ≤2500 ms and observed CLS ≤0.1. These are lab investigation targets, not field p75 results or a Lighthouse score.","## Limits",report.limitations.map(value=>`- ${value}`).join("\n"),"Full settings, browser/host versions, source hashes, failures and individual request timing/bytes are in report.json.",report.failure?`Runner failure: ${report.failure}`:""].join("\n\n");
  await writeFile(path.join(output,"report.md"),`${markdown}\n`);
  if(report.summaries.some(summary=>!summary.complete))process.exitCode=1;
  console.log(`Reports: ${output}`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Hosted performance measurement failed.");process.exitCode=1;});
