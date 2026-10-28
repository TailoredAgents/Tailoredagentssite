import {createHash} from "node:crypto";
import {parse,type DefaultTreeAdapterTypes} from "parse5";
import type {FactoryBuildManifest} from "./build-types";
import {safeSitePath} from "./site/artifacts";
import {siteIdentityPaths} from "./site/identity";

const identityPaths=Object.values(siteIdentityPaths);
export const hasFactoryIdentity=(manifest:FactoryBuildManifest)=>manifest.files.some(file=>file.path.startsWith("assets/identity/"));
export function factoryManifestFingerprint(manifest:FactoryBuildManifest){
  return createHash("sha256").update(JSON.stringify([manifest.entrypoint,...manifest.files.map(file=>[file.path,file.contentType,file.size,file.sha256]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))] )).digest("hex");
}
export type FactoryPublicWindow={leaseToken:string;manifestHash:string;checkedAt:string};
/** Only already QA-passed, privately byte-verified artifacts may be fetched
 * anonymously during the final five-minute check. Workflow READY is still gated
 * by the anonymous receipt. Lease change, pause/failure, revocation or expiry
 * closes the window; the resolver applies those database boundaries separately. */
export function factoryPublicWindowOpen(input:{status:string;stage:string;leaseToken:string|null;leaseUntil:Date|string|null;manifest:FactoryBuildManifest;qaPassed:boolean;window:unknown},now=Date.now()){
  const until=input.leaseUntil?new Date(input.leaseUntil).getTime():NaN;
  if(input.status!=="running"||input.stage!=="verify"||!input.qaPassed||!input.leaseToken||!Number.isFinite(until)||until<=now)return false;
  if(!input.window||typeof input.window!=="object")return false;
  const value=input.window as Partial<FactoryPublicWindow>,checked=Date.parse(value.checkedAt||"");
  return value.leaseToken===input.leaseToken&&Number.isFinite(checked)&&checked<=now&&checked>now-300000&&value.manifestHash===factoryManifestFingerprint(input.manifest);
}
export type FactoryPublicReceipt={url:string;status:200;checkedAt:string;manifestHash:string};
export class FactoryPublicVerificationError extends Error{}
const fail=()=>new FactoryPublicVerificationError("The public preview link or sharing image could not be verified. Saved pages and images are retained; retry final verification after checking preview hosting.");

function metadata(bytes:Uint8Array){
  const found=new Map<string,string[]>();
  const walk=(node:DefaultTreeAdapterTypes.Node,inHead=false)=>{
    if("tagName" in node){
      inHead=inHead||node.tagName==="head";
      if(inHead&&node.tagName==="meta"){
        const attrs=Object.fromEntries(node.attrs.map(attr=>[attr.name,attr.value])),key=attrs.property||attrs.name;
        if(key)found.set(key,[...(found.get(key)||[]),attrs.content||""]);
      }
    }
    if("childNodes" in node)for(const child of node.childNodes)walk(child,inHead);
  };
  walk(parse(Buffer.from(bytes).toString("utf8")));
  return (key:string)=>{const entries=found.get(key);if(entries?.length!==1||!entries[0].trim())throw fail();return entries[0];};
}
/** No auth, cookies, resolver secret, arbitrary destinations or auto-redirects.
 * Every retrieved body must match the frozen checked manifest exactly. */
export async function verifyFactoryPublicArtifacts(input:{previewUrl:string;shareUrl:string;manifest:FactoryBuildManifest;checkDeadline?:()=>void},fetcher:typeof fetch=fetch):Promise<FactoryPublicReceipt>{
  const base=new URL(input.previewUrl),share=new URL(input.shareUrl);
  if(base.protocol!=="https:"||base.username||base.password||base.search||base.hash||!/^\/p\/[a-f0-9]{48}\/$/.test(base.pathname)||!base.hostname.includes(".")||base.hostname.endsWith(".localhost")||base.hostname.endsWith(".local")||base.hostname.endsWith(".internal")||base.hostname.endsWith(".")||base.hostname.startsWith("[")||/^\d+(\.\d+){3}$/.test(base.hostname))throw fail();
  const alias=share.origin==="https://www.tailoredagents.com"&&!share.search&&!share.hash&&!share.username&&!share.password&&/^\/preview\/[a-z][a-z0-9-]{1,63}$/.test(share.pathname);
  if(share.href!==base.href&&!alias)throw fail();
  const files=new Map(input.manifest.files.map(file=>[file.path,file]));
  if(files.size!==input.manifest.files.length||files.size>160)throw fail();
  for(const file of input.manifest.files){safeSitePath(file.path);if(!Number.isSafeInteger(file.size)||file.size<0||file.size>8_000_000||!/^[a-f0-9]{64}$/.test(file.sha256))throw fail();}
  if(!identityPaths.every(path=>files.has(path))||!files.has("index.html"))throw fail();
  const get=async(url:string)=>{input.checkDeadline?.();try{return await fetcher(url,{redirect:"manual",cache:"no-store",credentials:"omit",headers:{"user-agent":"TailoredAgents-PreviewCheck/1.0"},signal:AbortSignal.timeout(15000)});}catch{throw fail();}};
  const read=async(response:Response,path:string)=>{
    const entry=files.get(path);
    if(!entry||response.status!==200||response.headers.get("content-type")?.split(";")[0]!==entry.contentType.split(";")[0]||!response.headers.get("x-robots-tag")?.includes("noindex")){
      await response.body?.cancel();throw fail();
    }
    if(!response.body)throw fail();
    const reader=response.body.getReader(),parts:Uint8Array[]=[];let length=0;
    try{for(;;){const item=await reader.read();if(item.done)break;length+=item.value.length;if(length>entry.size){await reader.cancel();throw fail();}parts.push(item.value);}}catch{throw fail();}finally{reader.releaseLock();}
    const bytes=Buffer.concat(parts);
    if(length!==entry.size||createHash("sha256").update(bytes).digest("hex")!==entry.sha256)throw fail();
    return bytes;
  };
  let landing=await get(share.href);
  if(alias){
    const location=landing.headers.get("location"),expected=`${base.origin}/p/${share.pathname.split("/").at(-1)}/`;
    let destination="";try{destination=location?new URL(location,share).href:"";}catch{throw fail();}
    if(![307,308].includes(landing.status)||destination!==expected){await landing.body?.cancel();throw fail();}
    await landing.body?.cancel();landing=await get(expected);
  }
  const home=await read(landing,"index.html");
  for(const file of input.manifest.files.filter(file=>file.path.endsWith(".html"))){
    const bytes=file.path==="index.html"?home:await read(await get(new URL(file.path,base).href),file.path),meta=metadata(bytes);
    if(meta("og:image")!==new URL(siteIdentityPaths.social,base).href||meta("twitter:image")!==meta("og:image")||meta("og:url")!==new URL(file.path,base).href||meta("og:type")!=="website"||meta("og:image:width")!=="1200"||meta("og:image:height")!=="630"||meta("twitter:card")!=="summary_large_image")throw fail();
    for(const name of ["og:title","og:description","og:image:alt","twitter:card"])meta(name);
  }
  for(const file of identityPaths)await read(await get(new URL(file,base).href),file);
  return {url:share.href,status:200,checkedAt:new Date().toISOString(),manifestHash:factoryManifestFingerprint(input.manifest)};
}
