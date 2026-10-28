import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {createServer,type Server} from "node:http";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {chromium,type Browser} from "playwright";
import {defaultPreviewOrigins,hostedPerformanceProfile,measureHostedPerformancePair,median,previewNetworkPatterns,summarizeHostedPerformance,validateMeasurementUrl,validatePreviewOrigin,windowedLayoutShift,type HostedPerformanceSample} from "./hosted-performance";

describe("Hosted performance report integrity",()=>{
  it("initializes paint observers through the real tsx CLI without serialized closure helpers",async()=>{
    const code="import {chromium} from 'playwright';import helper from './lib/factory/site/hosted-performance.ts';const browser=await chromium.launch({headless:true});try{const page=await browser.newPage();await helper.installHostedPerformanceObserver(page);await page.goto('data:text/html,<h1>CLI observer fixture</h1>');await page.waitForTimeout(150);console.log(JSON.stringify(await page.evaluate(()=>({initialized:!!window.__taHostedPerformance,support:window.__taHostedPerformance?.support||[]}))));}finally{await browser.close();}";
    const result=await promisify(execFile)(process.execPath,["--import","tsx","--input-type=module","-e",code],{cwd:process.cwd(),timeout:15000});
    const state=JSON.parse(result.stdout.trim());expect(state.initialized).toBe(true);expect(state.support).toContain("largest-contentful-paint");expect(state.support).toContain("layout-shift");
  },20000);
  it("accepts only explicitly allowed public preview routes and clean HTTPS origins",()=>{
    expect(validateMeasurementUrl("https://www.tailoredagents.com/preview/example-v2")).toContain("/preview/example-v2");
    expect(validateMeasurementUrl(`${defaultPreviewOrigins[0]}/p/example-v2/services/index.html`)).toContain("/services/index.html");
    expect(validatePreviewOrigin("https://preview.example.com")).toBe("https://preview.example.com");
    expect(validateMeasurementUrl("https://preview.example.com/p/example/",["https://preview.example.com"])).toContain("/p/example/");
    for(const url of ["https://www.tailoredagents.com/dashboard","https://www.tailoredagents.com/api/private","http://example.com/p/test/","https://unapproved.example.com/p/test/",`${defaultPreviewOrigins[0]}/p/example/?token=private`,`${defaultPreviewOrigins[0]}/p/example/#secret`,`${defaultPreviewOrigins[0]}/p/example/%2e%2e/private`,`${defaultPreviewOrigins[0]}/p/example/assets/site.css`,`https://name:secret@tailored-agents-site-previews.onrender.com/p/test/`])expect(()=>validateMeasurementUrl(url),url).toThrow();
    for(const origin of ["http://example.com","https://127.0.0.1","https://[::1]","https://localhost","https://internal.local","https://preview.example.com:8443","https://preview.example.com/path","https://name:secret@preview.example.com","https://www.tailoredagents.com"])expect(()=>validatePreviewOrigin(origin),origin).toThrow();
    expect(previewNetworkPatterns(defaultPreviewOrigins).at(-1)).toEqual({urlPattern:"*://*:*/*",block:true});
  });
  it("uses the largest CLS session window, excluding recent input and respecting exact gap limits",()=>{
    const entry=(startTime:number,value:number,hadRecentInput=false)=>({startTime,value,hadRecentInput});
    expect(windowedLayoutShift([entry(0,.1),entry(500,.2),entry(1500,.4),entry(1600,1,true)])).toBeCloseTo(.4);
    expect(windowedLayoutShift([entry(0,.1),...Array.from({length:5},(_,index)=>entry((index+1)*900,.1)),entry(5000,.2)])).toBeCloseTo(.6);
    expect(windowedLayoutShift([entry(10,.1),entry(20,.2),entry(6000,.05)])).toBeCloseTo(.3);
    expect(windowedLayoutShift([])).toBe(0);expect(windowedLayoutShift([entry(NaN,2),entry(10,-1)])).toBe(0);
  });
  it("does not hide failed, missing, non-finite or changed-document runs behind a survivor median",()=>{
    expect(median([9,1,5])).toBe(5);expect(median([1,9])).toBe(5);expect(median([])).toBeNull();expect(median([1,NaN,3])).toBeNull();
    const base={url:"https://example.com/p/test/",mode:"cold",valid:true,documentSha256:"same-document",failures:[],transferBytes:100,requestCount:2,cachedRequestCount:0,metrics:{lcpMs:2000,cls:0,fcpMs:1500,ttfbMs:500,loadMs:3000}} as unknown as HostedPerformanceSample;
    const samples=[1,2,3].map(run=>({...base,run,metrics:{...base.metrics!,lcpMs:run*1000}}));
    let summary=summarizeHostedPerformance(samples,[base.url],3)[0];expect(summary.complete).toBe(true);expect(summary.median.lcpMs).toBe(2000);
    samples[2].valid=false;samples[2].failures=["Navigation timed out"];
    summary=summarizeHostedPerformance(samples,[base.url],3)[0];expect(summary.complete).toBe(false);expect(summary.median.lcpMs).toBeNull();expect(summary.failures).toContain("Navigation timed out");
    samples[2].valid=true;samples[2].failures=[];samples[2].documentSha256="changed-document";
    expect(summarizeHostedPerformance(samples,[base.url],3)[0].median.lcpMs).toBeNull();
    expect(summarizeHostedPerformance(samples.slice(0,2),[base.url],3)[0].median.lcpMs).toBeNull();
  });
});

describe("Hosted measurement against an isolated local HTTP fixture",()=>{
  let browser:Browser,server:Server,origin:string;
  beforeAll(async()=>{
    server=createServer((request,response)=>{
      if(request.url?.endsWith("style.css")){response.writeHead(200,{"content-type":"text/css","cache-control":"public, max-age=3600"});response.end("body{margin:20px;font:22px sans-serif}h1{font-size:36px;color:#123456}p{max-width:28em}");return;}
      const blocked=request.url?.includes("blocked");
      response.writeHead(200,{"content-type":"text/html","cache-control":"no-store"});
      response.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="style.css"></head><body><h1>Controlled performance fixture</h1><p>This is local synthetic content for testing actual cache reuse and the browser paint observers.</p>${blocked?'<img src="https://blocked.invalid/never-contact-this-host.png">':""}</body></html>`);
    });
    await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw new Error("Fixture listener failed");origin=`http://127.0.0.1:${address.port}`;
    browser=await chromium.launch({headless:true});
  },30000);
  afterAll(async()=>{await browser?.close();await new Promise<void>((resolve,reject)=>server?.close(error=>error?reject(error):resolve()));});
  const settings={...hostedPerformanceProfile,cpuSlowdown:1,latencyMs:0,downloadBytesPerSecond:-1,uploadBytesPerSecond:-1,observationAfterLoadMs:500,navigationTimeoutMs:10000};
  it("observes real paint metrics and actual warm CSS cache reuse without route interception",async()=>{
    const result=await measureHostedPerformancePair({browser,url:`${origin}/p/fixture/index.html`,run:1,userAgent:"Synthetic performance fixture",settings,networkPatterns:[{urlPattern:`${origin}/p/*`,block:false},{urlPattern:"*://*:*/*",block:true}]});
    expect(result).toHaveLength(2);
    for(const sample of result){expect(sample.failures).toEqual([]);expect(sample.valid).toBe(true);expect(sample.metrics?.lcpMs).toBeGreaterThan(0);expect(sample.metrics?.cls).toBe(0);expect(sample.documentSha256).toMatch(/^[a-f0-9]{64}$/);}
    expect(result[0].cachedRequestCount).toBe(0);expect(result[1].cachedRequestCount).toBeGreaterThan(0);expect(result[1].transferBytes).toBeLessThan(result[0].transferBytes);
  },30000);
  it("retains blocked resource failures and invalidates the sample instead of reporting a misleading pass",async()=>{
    const result=await measureHostedPerformancePair({browser,url:`${origin}/p/fixture/blocked.html`,run:1,userAgent:"Synthetic performance fixture",settings,networkPatterns:[{urlPattern:`${origin}/p/*`,block:false},{urlPattern:"*://*:*/*",block:true}]});
    for(const sample of result){expect(sample.valid,JSON.stringify(sample)).toBe(false);expect(sample.resources.find(resource=>resource.url.includes("blocked.invalid"))?.failure).toMatch(/BLOCKED/);expect(sample.failures.some(failure=>failure.startsWith("Resource failed:"))).toBe(true);}
  },30000);
});
