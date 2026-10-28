import {createHash} from "node:crypto";
import {isIP} from "node:net";
import type {Browser,Page} from "playwright";

export const hostedPerformanceVersion="2026-10-28-v1";
export const hostedPerformanceProfile={
  name:"mobile-390-custom-4x-1.6mbps",viewport:{width:390,height:844},deviceScaleFactor:2,
  isMobile:true,hasTouch:true,cpuSlowdown:4,latencyMs:150,downloadBytesPerSecond:200000,
  uploadBytesPerSecond:93750,observationAfterLoadMs:5000,navigationTimeoutMs:45000,
  locale:"en-US",timezoneId:"America/New_York",runs:3,
} as const;
export const defaultPreviewOrigins=["https://tailored-agents-site-previews.onrender.com"];
export const sharedPreviewOrigin="https://www.tailoredagents.com";
export const defaultHostedPerformanceUrls=[
  "https://www.tailoredagents.com/preview/cosmos-heating-air-v9",
  "https://tailored-agents-site-previews.onrender.com/p/cosmos-heating-air-v9/services/index.html",
  "https://tailored-agents-site-previews.onrender.com/p/cosmos-heating-air-v9/contact/index.html",
];

export function validatePreviewOrigin(input:string):string {
  let url:URL;try{url=new URL(input);}catch{throw new Error("Preview origins must be public HTTPS origins.");}
  if(url.protocol!=="https:"||url.username||url.password||url.port||url.pathname!=="/"||url.search||url.hash||isIP(url.hostname)||url.hostname.includes(":")||!url.hostname.includes(".")||/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname)||url.origin===sharedPreviewOrigin)
    throw new Error("Preview origins must be public HTTPS origins, separate from the CRM.");
  return url.origin;
}
export function validateMeasurementUrl(input:string,previewOrigins:readonly string[]=defaultPreviewOrigins):string {
  let url:URL;try{url=new URL(input);}catch{throw new Error("Each measurement URL must identify a public preview page.");}
  if(url.protocol!=="https:"||url.username||url.password||url.port||url.search||url.hash||/%|\\/.test(url.pathname))throw new Error("Measurement URLs cannot include credentials, query strings, fragments or encoded paths.");
  const valid=url.origin===sharedPreviewOrigin?/^\/preview\/[a-z0-9][a-z0-9-]{0,90}\/?$/.test(url.pathname):previewOrigins.includes(url.origin)&&/^\/p\/[a-z0-9][a-z0-9-]{0,90}\/(?:[a-z][a-z0-9-]{0,48}\/)?(?:index\.html)?$/.test(url.pathname);
  if(!valid)throw new Error("Only the branded preview shortlink or an explicitly allowed preview host's /p/ pages can be measured.");
  return url.href;
}
/** CDP blocking keeps the real HTTP cache enabled. Playwright route interception
 * disables it and therefore cannot be used for a cold/warm comparison. */
export function previewNetworkPatterns(previewOrigins:readonly string[]){
  return [{urlPattern:`${sharedPreviewOrigin}/preview/*`,block:false},...previewOrigins.map(origin=>({urlPattern:`${origin}/p/*`,block:false})),{urlPattern:"*://*:*/*",block:true}];
}
export function median(values:number[]):number|null {
  if(!values.length||values.some(value=>!Number.isFinite(value)))return null;
  const ordered=[...values].sort((a,b)=>a-b),middle=Math.floor(ordered.length/2);
  return ordered.length%2?ordered[middle]:(ordered[middle-1]+ordered[middle])/2;
}
export type ShiftSample={startTime:number;value:number;hadRecentInput:boolean};
export function windowedLayoutShift(entries:ShiftSample[]):number {
  let maximum=0,total=0,start:number|null=null,last:number|null=null;
  for(const entry of [...entries].sort((a,b)=>a.startTime-b.startTime)){
    if(entry.hadRecentInput||!Number.isFinite(entry.startTime)||entry.startTime<0||!Number.isFinite(entry.value)||entry.value<0)continue;
    if(start===null||last===null||entry.startTime-last>=1000||entry.startTime-start>=5000){start=entry.startTime;total=0;}
    total+=entry.value;last=entry.startTime;maximum=Math.max(maximum,total);
  }
  return maximum;
}

export type HostedResource={url:string;method:string;type:string;status:number|null;mimeType:string|null;receivedBytes:number;encodedBodyBytes:number|null;fromCache:boolean;fromServiceWorker:boolean;cacheControl:string|null;startMs:number;endMs:number|null;failure:string|null};
export type HostedBrowserMetrics={lcpMs:number|null;lcpElement:string|null;fcpMs:number|null;cls:number|null;ttfbMs:number|null;domContentLoadedMs:number|null;loadMs:number|null;windowMs:number;longTaskCount:number|null;longTaskDurationMs:number|null;resourceTimingTransferBytes:number;resourceTimingEncodedBodyBytes:number;shiftSamples:ShiftSample[];observerSupport:string[];hiddenDuringMeasurement:boolean};
export type HostedPerformanceSample={url:string;finalUrl:string;mode:"cold"|"warm";run:number;startedAt:string;completedAt:string;valid:boolean;failures:string[];metrics:HostedBrowserMetrics|null;resources:HostedResource[];transferBytes:number;requestCount:number;cachedRequestCount:number;redirectCount:number;navigationWallMs:number;documentSha256:string|null};
export type HostedPerformanceSettings={viewport:{width:number;height:number};deviceScaleFactor:number;isMobile:boolean;hasTouch:boolean;cpuSlowdown:number;latencyMs:number;downloadBytesPerSecond:number;uploadBytesPerSecond:number;observationAfterLoadMs:number;navigationTimeoutMs:number;locale:string;timezoneId:string};
type PerformanceWindow=Window&{__taHostedPerformance?:{lcp:number|null;lcpElement:string|null;shifts:ShiftSample[];longTasks:number[];support:string[];hidden:boolean;flush:()=>void}};

export async function installHostedPerformanceObserver(page:Page){
  // Explicit browser JavaScript avoids transpiler-added closure helpers when
  // this file runs through the actual node --import tsx CLI rather than Vitest.
  await page.addInitScript({content:`(()=>{
    const support=[...PerformanceObserver.supportedEntryTypes];
    const state={lcp:null,lcpElement:null,shifts:[],longTasks:[],support,hidden:document.visibilityState!=="visible",flush:()=>{}};
    window.__taHostedPerformance=state;
    const observers=[];
    for(const type of ["largest-contentful-paint","layout-shift","longtask"]){
      if(!support.includes(type))continue;
      const consume=(entries)=>{for(const entry of entries){
        if(type==="largest-contentful-paint"){state.lcp=entry.startTime;state.lcpElement=entry.element?entry.element.tagName.toLowerCase()+(entry.element.id?"#"+entry.element.id:""):null;}
        else if(type==="layout-shift")state.shifts.push({startTime:entry.startTime,value:entry.value??0,hadRecentInput:entry.hadRecentInput??false});
        else state.longTasks.push(entry.duration);
      }};
      const observer=new PerformanceObserver(list=>consume(list.getEntries()));observer.observe({type,buffered:true});observers.push({observer,consume});
    }
    state.flush=()=>observers.forEach(({observer,consume})=>consume(observer.takeRecords()));
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState!=="visible")state.hidden=true;});
  })();`});
}

async function browserMetrics(page:Page):Promise<HostedBrowserMetrics>{
  const raw=await page.evaluate(()=>{
    const state=(window as PerformanceWindow).__taHostedPerformance;state?.flush();
    const nav=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined;
    const resources=[...(nav?[nav]:[]),...performance.getEntriesByType("resource") as PerformanceResourceTiming[]];
    return {lcpMs:state?.lcp??null,lcpElement:state?.lcpElement??null,fcpMs:performance.getEntriesByName("first-contentful-paint")[0]?.startTime??null,
      ttfbMs:nav?.responseStart??null,domContentLoadedMs:nav?.domContentLoadedEventEnd||null,loadMs:nav?.loadEventEnd||null,windowMs:performance.now(),
      longTaskCount:state?.support.includes("longtask")?state.longTasks.length:null,longTaskDurationMs:state?.support.includes("longtask")?state.longTasks.reduce((sum,time)=>sum+time,0):null,
      resourceTimingTransferBytes:resources.reduce((sum,resource)=>sum+resource.transferSize,0),resourceTimingEncodedBodyBytes:resources.reduce((sum,resource)=>sum+resource.encodedBodySize,0),
      shiftSamples:state?.shifts||[],observerSupport:state?.support||[],hiddenDuringMeasurement:state?.hidden??true};
  });
  return {...raw,cls:raw.observerSupport.includes("layout-shift")?windowedLayoutShift(raw.shiftSamples):null};
}

/** Measures one pair with a fresh, unauthenticated context. Cold clears the
 * browser HTTP cache, then warms that same context for the second navigation.
 * No request interception, clicks, form submissions or provider calls. */
export async function measureHostedPerformancePair(input:{browser:Browser;url:string;run:number;userAgent:string;settings:HostedPerformanceSettings;networkPatterns:Array<{urlPattern:string;block:boolean}>;onSample?:(sample:HostedPerformanceSample)=>void}):Promise<HostedPerformanceSample[]>{
  const {browser,url,run,settings}=input;
  const context=await browser.newContext({viewport:settings.viewport,deviceScaleFactor:settings.deviceScaleFactor,isMobile:settings.isMobile,hasTouch:settings.hasTouch,userAgent:input.userAgent,locale:settings.locale,timezoneId:settings.timezoneId,serviceWorkers:"block",acceptDownloads:false});
  const samples:HostedPerformanceSample[]=[];
  try{for(const mode of ["cold","warm"] as const){
    const page=await context.newPage(),session=await context.newCDPSession(page);
    await session.send("Network.enable");await session.send("Network.setBypassServiceWorker",{bypass:true});
    await session.send("Network.setCacheDisabled",{cacheDisabled:false});
    if(mode==="cold")await session.send("Network.clearBrowserCache");
    await session.send("Network.setBlockedURLs",{urlPatterns:input.networkPatterns});
    await session.send("Emulation.setCPUThrottlingRate",{rate:settings.cpuSlowdown});
    const conditions={latency:settings.latencyMs,downloadThroughput:settings.downloadBytesPerSecond,uploadThroughput:settings.uploadBytesPerSecond,connectionType:"cellular4g" as const};
    await session.send("Network.emulateNetworkConditionsByRule",{matchedNetworkConditions:[{urlPattern:"",...conditions}]});
    await session.send("Network.overrideNetworkState",{offline:false,...conditions});
    await installHostedPerformanceObserver(page);
    const requests=new Map<string,HostedResource>(),resources:HostedResource[]=[],failures:string[]=[];
    let firstRequest:number|null=null,redirectCount=0;
    const elapsed=(timestamp:number)=>Math.max(0,(timestamp-(firstRequest??timestamp))*1000);
    session.on("Network.requestWillBeSent",event=>{
      firstRequest??=event.timestamp;
      if(event.redirectResponse){const previous=requests.get(event.requestId);if(previous){previous.status=event.redirectResponse.status;previous.receivedBytes=event.redirectResponse.encodedDataLength||0;previous.endMs=elapsed(event.timestamp);resources.push(previous);}redirectCount++;}
      const resource:HostedResource={url:event.request.url,method:event.request.method,type:event.type||"Other",status:null,mimeType:null,receivedBytes:0,encodedBodyBytes:null,fromCache:false,fromServiceWorker:false,cacheControl:null,startMs:elapsed(event.timestamp),endMs:null,failure:null};
      requests.set(event.requestId,resource);if(!["GET","HEAD"].includes(event.request.method))failures.push("A non-read-only request was observed.");
    });
    session.on("Network.responseReceived",event=>{const resource=requests.get(event.requestId);if(resource){resource.status=event.response.status;resource.mimeType=event.response.mimeType;resource.fromCache ||= Boolean(event.response.fromDiskCache||event.response.fromPrefetchCache);resource.fromServiceWorker=Boolean(event.response.fromServiceWorker);resource.cacheControl=Object.entries(event.response.headers).find(([key])=>key.toLowerCase()==="cache-control")?.[1]??null;}});
    session.on("Network.requestServedFromCache",event=>{const resource=requests.get(event.requestId);if(resource)resource.fromCache=true;});
    session.on("Network.loadingFinished",event=>{const resource=requests.get(event.requestId);if(resource){resource.receivedBytes=event.encodedDataLength;resource.encodedBodyBytes=(event as typeof event&{encodedBodyLength?:number}).encodedBodyLength??null;resource.endMs=elapsed(event.timestamp);}});
    session.on("Network.loadingFailed",event=>{const resource=requests.get(event.requestId);if(resource){resource.failure=event.errorText||(event.blockedReason?`BLOCKED (${event.blockedReason})`:"Network loading failed");resource.endMs=elapsed(event.timestamp);}});
    const startedAt=new Date().toISOString(),start=Date.now();let metrics:HostedBrowserMetrics|null=null,documentSha256:string|null=null;
    try{
      const response=await page.goto(url,{waitUntil:"load",timeout:settings.navigationTimeoutMs});
      if(!response||response.status()!==200)failures.push(`Main document returned ${response?.status()??"no response"}.`);
      if(response&&!(response.headers()["content-type"]||"").includes("text/html"))failures.push("Main document was not HTML.");
      if(response)documentSha256=createHash("sha256").update(await response.body()).digest("hex");
      await page.waitForTimeout(settings.observationAfterLoadMs);
      metrics=await browserMetrics(page);
      if(metrics.lcpMs===null)failures.push("No LCP observation was available.");
      if(metrics.cls===null)failures.push("Layout Shift API was unavailable.");
      if(metrics.hiddenDuringMeasurement)failures.push("The page was hidden during measurement.");
    }catch(error){failures.push(error instanceof Error?`${error.name}: ${error.message.split("\n")[0].slice(0,200)}`:"Navigation or observation failed.");}
    resources.push(...requests.values());
    for(const resource of resources){if(resource.failure)failures.push(`Resource failed: ${resource.failure}`);else if(resource.status!==null&&resource.status>=400)failures.push(`Resource returned HTTP ${resource.status}.`);else if(resource.endMs===null)failures.push("A resource was still pending when the observation window ended.");}
    const sample:HostedPerformanceSample={url,finalUrl:page.url(),mode,run,startedAt,completedAt:new Date().toISOString(),valid:failures.length===0,failures:[...new Set(failures)],metrics,resources,transferBytes:resources.reduce((sum,resource)=>sum+resource.receivedBytes,0),requestCount:resources.length,cachedRequestCount:resources.filter(resource=>resource.fromCache).length,redirectCount,navigationWallMs:Date.now()-start,documentSha256};
    samples.push(sample);input.onSample?.(sample);await page.close();
  }}finally{await context.close();}
  return samples;
}

export function summarizeHostedPerformance(samples:HostedPerformanceSample[],urls:string[],expectedRuns:number){
  return urls.flatMap(url=>(["cold","warm"] as const).map(mode=>{
    const group=samples.filter(sample=>sample.url===url&&sample.mode===mode),documentHashes=[...new Set(group.map(sample=>sample.documentSha256).filter(Boolean))];
    const complete=group.length===expectedRuns&&group.every(sample=>sample.valid&&sample.documentSha256!==null)&&documentHashes.length===1;
    const value=(read:(sample:HostedPerformanceSample)=>number|null)=>{const numbers=group.map(read);return complete&&numbers.every((number):number is number=>number!==null)?median(numbers):null;};
    const lcpMs=value(sample=>sample.metrics?.lcpMs??null),cls=value(sample=>sample.metrics?.cls??null);
    return {url,mode,expectedRuns,completedRuns:group.length,validRuns:group.filter(sample=>sample.valid).length,complete,
      median:{lcpMs,cls,fcpMs:value(sample=>sample.metrics?.fcpMs??null),ttfbMs:value(sample=>sample.metrics?.ttfbMs??null),loadMs:value(sample=>sample.metrics?.loadMs??null),transferBytes:value(sample=>sample.transferBytes),requestCount:value(sample=>sample.requestCount),cachedRequestCount:value(sample=>sample.cachedRequestCount)},
      engineeringTargets:{lcpAtMost2500ms:lcpMs===null?null:lcpMs<=2500,observedClsAtMostPoint1:cls===null?null:cls<=.1},
      documentHashes,failures:[...new Set([...group.flatMap(sample=>sample.failures),...(documentHashes.length>1?["The document changed between repetitions; no combined median was published."]:[])])]};
  }));
}
