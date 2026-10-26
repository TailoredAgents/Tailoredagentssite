import { createHash } from "node:crypto";
import path from "node:path";

export type SiteFiles = Record<string, Uint8Array>;
export type SiteManifest = {entrypoint:"index.html";files:Array<{path:string;contentType:string;size:number;sha256:string}>};
export type SiteIssue = {code:string;message:string;page:string;viewport?:"desktop"|"mobile";severity:"error"|"warning"};
export type SiteQaResult = {passed:boolean;issues:SiteIssue[];checkedAt:string;screenshots:Array<{page:string;viewport:"desktop"|"mobile";bytes:Uint8Array}>};
export const siteLimits={maximumFiles:80,maximumFileBytes:8_000_000,maximumTotalBytes:40_000_000,maximumPages:10};

/** One portable POSIX path under this project; never an absolute/escaped path. */
export function safeSitePath(value:string) {
  if(!value || value.length>180 || !/^[a-z0-9][a-z0-9._/-]*$/.test(value) || value.includes("//") || value.split("/").some(p=>!p||p==="."||p===".."||p.startsWith("."))
    ||path.posix.normalize(value)!==value||path.posix.isAbsolute(value)) throw new Error("The site contains an invalid artifact path.");
  return value;
}
export function siteContentType(value:string) {
  const types:Record<string,string>={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".svg":"image/svg+xml",".txt":"text/plain; charset=utf-8",".json":"application/json"};
  const type=types[path.posix.extname(value)];if(!type)throw new Error("The site contains an unsupported artifact type.");return type;
}
export function siteManifest(files:SiteFiles):SiteManifest {
  const entries=Object.entries(files);let total=0;
  if(!files["index.html"]||entries.length>siteLimits.maximumFiles)throw new Error("The site has no homepage or too many files.");
  return {entrypoint:"index.html",files:entries.sort(([a],[b])=>a.localeCompare(b)).map(([name,bytes])=>{
    safeSitePath(name);if(!(bytes instanceof Uint8Array)||bytes.byteLength>siteLimits.maximumFileBytes)throw new Error("A site artifact exceeds its size limit.");
    total+=bytes.byteLength;if(total>siteLimits.maximumTotalBytes)throw new Error("The site exceeds its total artifact size limit.");
    return {path:name,contentType:siteContentType(name),size:bytes.byteLength,sha256:createHash("sha256").update(bytes).digest("hex")};
  })};
}
export function relativeSiteLink(fromPage:string,toPath:string) {
  safeSitePath(fromPage);safeSitePath(toPath);
  return path.posix.relative(path.posix.dirname(fromPage),toPath)||"./";
}

/** Standard deterministic store-only ZIP. No archive-supplied code or filesystem access. */
export function zipSiteFiles(files:SiteFiles) {
  const entries=Object.entries(files).sort(([a],[b])=>a.localeCompare(b));
  if(entries.length>160)throw new Error("Too many source archive files.");
  const table=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
  const chunks:Buffer[]=[],directory:Buffer[]=[];let offset=0,total=0;
  for(const [name,data]of entries){
    safeSitePath(name);total+=data.byteLength;if(total>60_000_000)throw new Error("The source archive exceeds its size limit.");
    const filename=Buffer.from(name,"utf8"),content=Buffer.from(data);let crc=0xffffffff;for(const b of content)crc=table[(crc^b)&0xff]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(0,8);local.writeUInt16LE(33,12);
    local.writeUInt32LE(crc,14);local.writeUInt32LE(content.length,18);local.writeUInt32LE(content.length,22);local.writeUInt16LE(filename.length,26);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(33,14);
    central.writeUInt32LE(crc,16);central.writeUInt32LE(content.length,20);central.writeUInt32LE(content.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);
    chunks.push(local,filename,content);directory.push(central,filename);offset+=local.length+filename.length+content.length;
  }
  const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...chunks,central,end]);
}
