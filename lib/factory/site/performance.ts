import path from "node:path";
import {parse,type DefaultTreeAdapterTypes} from "parse5";
import type {Page} from "playwright";
import type {SiteFiles,SiteIssue} from "./artifacts";

export const deliveryBudgets={mobilePageBytes:800000,mobileHeroBytes:250000,desktopHeroBytes:400000};
export type SiteDelivery={pages:Array<{page:string;mobileBytes:number;desktopBytes:number;mobileInitialBytes:number;desktopInitialBytes:number;mobileResources:string[];desktopResources:string[]}>;issues:SiteIssue[]};
export type SiteLabPerformance={page:string;viewport:"desktop"|"mobile";environment:"isolated-local-chromium";network:"in-memory-unthrottled";domContentLoadedMs:number;loadMs:number;firstContentfulPaintMs:number|null;largestContentfulPaintMs:number|null;cumulativeLayoutShift:number;longTaskCount:number;measurementWindowMs:number};
const localOrigin="https://delivery.factory.test";
type Element=DefaultTreeAdapterTypes.Element;
const attributes=(node:Element)=>Object.fromEntries(node.attrs.map(a=>[a.name,a.value]));
function resolveResource(from:string,value:string):string|null {
  try{const url=new URL(value,new URL(from,`${localOrigin}/`));if(url.origin!==localOrigin||url.search)return null;return decodeURIComponent(url.pathname.slice(1));}catch{return null;}
}
function matchesWidth(media:string,width:number):boolean {
  if(!media)return true;
  const min=/min-width:\s*(\d+)px/.exec(media),max=/max-width:\s*(\d+)px/.exec(media);
  return (!min||width>=Number(min[1]))&&(!max||width<=Number(max[1]));
}
/** DPR 1 estimate at the QA viewports. Every image is counted for full-page totals;
 * lazy images are excluded only from the separately labelled initial totals. */
function imageCandidate(attrs:Record<string,string>,width:number):string {
  const entries=(attrs.srcset||"").split(",").map(entry=>entry.trim().match(/^(\S+)(?:\s+(\d+(?:\.\d+)?)(w|x))?$/)).filter((entry):entry is RegExpMatchArray=>Boolean(entry));
  if(!entries.length)return attrs.src||"";
  const sizes=(attrs.sizes||"").split(",").map(s=>s.trim());
  let display=width;
  for(const size of sizes){const match=/^(?:\(([^)]+)\)\s*)?(\d+(?:\.\d+)?)(vw|px)$/.exec(size);if(match&&matchesWidth(match[1]||"",width)){display=match[3]==="vw"?width*Number(match[2])/100:Number(match[2]);break;}}
  const ordered=entries.map(entry=>({url:entry[1],capacity:entry[3]==="w"?Number(entry[2])/display:Number(entry[2]||1)})).sort((a,b)=>a.capacity-b.capacity);
  return (ordered.find(entry=>entry.capacity>=1)||ordered.at(-1))!.url;
}
function dependencies(files:SiteFiles,page:string,width:number){
  const all=new Set<string>([page]),initial=new Set<string>([page]),images=new Set<string>();
  const add=(from:string,value:string,eager=true,image=false)=>{
    const name=resolveResource(from,value);if(!name||!files[name])return;
    if(eager)initial.add(name);if(image)images.add(name);if(all.has(name))return;all.add(name);
    if(name.endsWith(".css"))for(const match of Buffer.from(files[name]).toString("utf8").matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi))add(name,match[1],eager);
  };
  const visit=(node:DefaultTreeAdapterTypes.Node)=>{
    if("tagName" in node){
      const attrs=attributes(node);
      if(node.tagName==="link"&&["stylesheet","preload"].includes(attrs.rel)&&matchesWidth(attrs.media||"",width))add(page,attrs.href);
      if(node.tagName==="script")add(page,attrs.src);
      if(node.tagName==="img"){
        const parent=node.parentNode;
        const sources=parent&&"tagName" in parent&&parent.tagName==="picture"?parent.childNodes.filter((n):n is Element=>"tagName" in n&&n.tagName==="source"):[];
        const selected=sources.map(attributes).find(source=>matchesWidth(source.media||"",width));
        add(page,imageCandidate(selected||attrs,width),attrs.loading!=="lazy",true);
      }
    }
    if("childNodes" in node)for(const child of node.childNodes)visit(child);
  };
  visit(parse(Buffer.from(files[page]).toString("utf8")));
  return {all:[...all].sort(),initial:[...initial].sort(),images:[...images]};
}
/** Actual page dependencies, including CSS font/image URLs. This is a byte budget
 * estimate, not compression, caching, network timing, or field Core Web Vitals. */
export function checkSiteDelivery(files:SiteFiles):SiteDelivery{
  const issues:SiteIssue[]=[],bytes=(resources:string[])=>resources.reduce((sum,name)=>sum+(files[name]?.byteLength||0),0);
  const pages=Object.keys(files).filter(p=>p.endsWith(".html")).sort().map(page=>{
    const mobile=dependencies(files,page,390),desktop=dependencies(files,page,1440);
    for(const [viewport,graph,budget] of [["mobile",mobile,deliveryBudgets.mobileHeroBytes],["desktop",desktop,deliveryBudgets.desktopHeroBytes]] as const){
      const large=graph.images.filter(name=>files[name].byteLength>budget);
      if(large.length)issues.push({page,severity:"error",code:`${viewport}_image_budget`,message:`An image exceeds the ${Math.round(budget/1000)} KB ${viewport} delivery budget: ${large.map(name=>path.posix.basename(name)).join(", ")}.`});
    }
    const mobileBytes=bytes(mobile.all);
    if(mobileBytes>deliveryBudgets.mobilePageBytes)issues.push({page,severity:"error",code:"mobile_page_budget",message:"This page exceeds its 800 KB full-page mobile resource budget, including imagery, styles, scripts and local fonts."});
    return {page,mobileBytes,desktopBytes:bytes(desktop.all),mobileInitialBytes:bytes(mobile.initial),desktopInitialBytes:bytes(desktop.initial),mobileResources:mobile.all,desktopResources:desktop.all};
  });
  return {pages,issues};
}

type LabWindow=Window&{__factoryLab?:{lcp:number|null;cls:number;longTasks:number;clsSessionStart:number;clsLast:number;clsSession:number}};
/** Observe before navigation and before QA interactions; never infer real-user
 * performance from these fast, unthrottled in-memory artifact checks. */
export async function installSiteLabObserver(page:Page){
  await page.addInitScript(()=>{
    const state={lcp:null as number|null,cls:0,longTasks:0,clsSessionStart:0,clsLast:0,clsSession:0};(window as LabWindow).__factoryLab=state;
    for(const type of ["largest-contentful-paint","layout-shift","longtask"]){
      if(!PerformanceObserver.supportedEntryTypes.includes(type))continue;
      new PerformanceObserver(list=>{for(const entry of list.getEntries()){
        if(type==="largest-contentful-paint")state.lcp=entry.startTime;
        else if(type==="longtask")state.longTasks++;
        else {
          const shift=entry as PerformanceEntry&{hadRecentInput:boolean;value:number};if(shift.hadRecentInput)continue;
          if(entry.startTime-state.clsLast>1000||entry.startTime-state.clsSessionStart>5000){state.clsSession=0;state.clsSessionStart=entry.startTime;}
          state.clsSession+=shift.value;state.clsLast=entry.startTime;state.cls=Math.max(state.cls,state.clsSession);
        }
      }}).observe({type,buffered:true});
    }
  });
}
export async function measureSiteLabPerformance(page:Page,file:string,viewport:"desktop"|"mobile"):Promise<SiteLabPerformance>{
  const measurement=await page.evaluate(async()=>{
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    // Flush buffered paint/layout observer callbacks without waiting for a live network.
    await new Promise(resolve=>setTimeout(resolve,100));
    const nav=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined,state=(window as LabWindow).__factoryLab;

    return {domContentLoadedMs:Math.round((nav?.domContentLoadedEventEnd||0)*100)/100,loadMs:Math.round((nav?.loadEventEnd||0)*100)/100,firstContentfulPaintMs:performance.getEntriesByName("first-contentful-paint")[0]?.startTime??null,largestContentfulPaintMs:state?.lcp??null,cumulativeLayoutShift:Math.round((state?.cls||0)*10000)/10000,longTaskCount:state?.longTasks||0,measurementWindowMs:Math.round(performance.now()*100)/100};
  });
  return {page:file,viewport,environment:"isolated-local-chromium",network:"in-memory-unthrottled",...measurement};
}
