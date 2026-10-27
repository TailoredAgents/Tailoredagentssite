import sharp from "sharp";
import type { SiteFiles } from "./artifacts";

export const portableImagePaths={mobile:"assets/images/hero-mobile.webp",desktop:"assets/images/hero-desktop.webp",legacy:"assets/images/hero.png"} as const;
export const portableImageLimits={mobileBytes:250_000,desktopBytes:400_000,logoBytes:100_000,sourceBytes:8_000_000,sourcePixels:24_000_000};
function imageId(id:string){if(!/^[a-z][a-z0-9-]{0,31}$/.test(id))throw new Error("An image slot has an invalid ID.");return id;}
export function portableImageSlotPaths(id="hero"){imageId(id);return {mobile:`assets/images/${id}-mobile.webp`,desktop:`assets/images/${id}-desktop.webp`,legacy:`assets/images/${id}.png`};}
export function portableLogoPath(id:string){if(imageId(id)==="hero")throw new Error("A logo cannot replace the hero image.");if(/-(?:mobile|desktop)$/.test(id))throw new Error("A logo ID cannot use a reserved responsive-image suffix.");return `assets/images/${id}.webp`;}
/** Leave mobile room for a supplied logo, local fonts, markup and controls.
 * A single-image saved build retains its original 250 KB encoding policy. */
export function portableMobileImageBudget(photoCount:number){if(!Number.isInteger(photoCount)||photoCount<1||photoCount>5)throw new Error("Invalid website photo count.");return photoCount===1?portableImageLimits.mobileBytes:Math.min(portableImageLimits.mobileBytes,Math.floor(450_000/photoCount));}
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
export type PortableImageVariant={path:string;width:number;height:number;bytes:number};

/** The normalized original remains in private build storage. Only these two
 * deterministic, metadata-free derivatives are admitted to new public bundles.
 * Keeping the full composition lets the renderer apply an approved focal point.
 */
export async function preparePortableImages(original:Uint8Array,id="hero",options:{mobileBytes?:number}={}):Promise<SiteFiles> {
  const paths=portableImageSlotPaths(id);
  const mobileBudget=options.mobileBytes??portableImageLimits.mobileBytes;
  if(!Number.isInteger(mobileBudget)||mobileBudget<50_000||mobileBudget>portableImageLimits.mobileBytes)throw new Error("Invalid mobile image delivery budget.");
  if(original.byteLength>portableImageLimits.sourceBytes||!Buffer.from(original).subarray(0,8).equals(pngSignature))throw new Error("Responsive images require a normalized PNG within the source size limit.");
  const source=sharp(original,{limitInputPixels:portableImageLimits.sourcePixels,animated:false,failOn:"error"});
  const meta=await source.metadata();
  if(meta.format!=="png"||!meta.width||!meta.height||meta.width>8192||meta.height>8192||(meta.pages||1)!==1)throw new Error("The normalized source image has invalid dimensions or contains animation.");
  const encode=async(widths:number[],maximumBytes:number,portraitRatio:number)=>{
    for(const width of widths)for(const quality of [82,72,62]){
      const bytes=await source.clone().resize({width,height:Math.round(width*portraitRatio),fit:"inside",withoutEnlargement:true}).webp({quality,effort:4,smartSubsample:true}).toBuffer();
      if(bytes.byteLength<=maximumBytes)return bytes;
    }
    throw new Error(`The image could not meet its ${Math.round(maximumBytes/1000)} KB delivery budget. Choose a less complex image before publishing.`);
  };
  // Sequential encoding bounds peak memory on the worker. A quality floor and
  // bounded dimension ladder avoid silently publishing an oversized original.
  const mobile=await encode(mobileBudget<portableImageLimits.mobileBytes?[720,640,560,480,400,360]:[720,640,560,480],mobileBudget,4/3);
  const desktop=await encode([1600,1440,1280,1120,960],portableImageLimits.desktopBytes,1);
  return {[paths.mobile]:mobile,[paths.desktop]:desktop};
}

/** Logos preserve transparency and their full aspect ratio. They are never
 * synthesized from business names or silently cropped into photographic slots. */
export async function preparePortableLogo(original:Uint8Array,id:string):Promise<SiteFiles>{
  const target=portableLogoPath(id);
  if(original.byteLength>portableImageLimits.sourceBytes||!Buffer.from(original).subarray(0,8).equals(pngSignature))throw new Error("A logo requires a normalized PNG within the source size limit.");
  const source=sharp(original,{limitInputPixels:portableImageLimits.sourcePixels,animated:false,failOn:"error"}),meta=await source.metadata();
  if(meta.format!=="png"||!meta.width||!meta.height||meta.width>8192||meta.height>8192||(meta.pages||1)!==1)throw new Error("The logo has invalid dimensions or contains animation.");
  for(const width of [600,480,360]){
    const bytes=await source.clone().resize({width,height:240,fit:"inside",withoutEnlargement:true}).webp({lossless:true,effort:4}).toBuffer();
    if(bytes.byteLength<=portableImageLimits.logoBytes)return {[target]:bytes};
  }
  throw new Error("The logo exceeds its 100 KB delivery budget. Choose a simpler image.");
}

/** Read dimensions without asynchronous decoding, so rendering remains a pure
 * synchronous operation. The browser QA separately verifies actual decoding.
 * Accept only image chunks produced by our encoder, never EXIF/ICC/animation.
 */
function webpDimensions(bytes:Uint8Array) {
  const data=Buffer.from(bytes);
  if(data.length<20||data.toString("ascii",0,4)!=="RIFF"||data.toString("ascii",8,12)!=="WEBP"||data.readUInt32LE(4)!==data.length-8)throw new Error("A responsive image is not a valid local WebP.");
  let offset=12,width=0,height=0,imageChunks=0,canvas:{width:number;height:number}|null=null;
  while(offset<data.length){
    if(offset+8>data.length)throw new Error("A responsive image contains a truncated WebP chunk.");
    const kind=data.toString("ascii",offset,offset+4),length=data.readUInt32LE(offset+4),start=offset+8,end=start+length;
    if(end>data.length||!["VP8 ","VP8L","VP8X","ALPH"].includes(kind))throw new Error("A responsive image contains unsupported WebP data.");
    if(kind==="VP8X"){
      if(length!==10||(data[start]&~0x10)||canvas)throw new Error("Responsive images cannot contain metadata or animation.");
      canvas={width:data.readUIntLE(start+4,3)+1,height:data.readUIntLE(start+7,3)+1};
    }else if(kind==="VP8 "){
      if(length<10||data.toString("hex",start+3,start+6)!=="9d012a")throw new Error("A responsive image contains an invalid WebP frame.");
      width=data.readUInt16LE(start+6)&0x3fff;height=data.readUInt16LE(start+8)&0x3fff;imageChunks++;
    }else if(kind==="VP8L"){
      if(length<5||data[start]!==0x2f)throw new Error("A responsive image contains an invalid WebP frame.");
      const bits=data.readUInt32LE(start+1);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;imageChunks++;
    }
    offset=end+(length%2);
  }
  if(offset!==data.length||imageChunks!==1||!width||!height||width>1600||height>1600||(canvas&&(canvas.width!==width||canvas.height!==height)))throw new Error("A responsive image has invalid dimensions.");
  return {width,height};
}

export function portableSlotImages(assets:SiteFiles,id="hero"):{files:SiteFiles;variants:PortableImageVariant[];fallback:PortableImageVariant} {
  const paths=portableImageSlotPaths(id),mobile=assets[paths.mobile],desktop=assets[paths.desktop];
  if(mobile||desktop){
    if(!mobile||!desktop)throw new Error("Both mobile and desktop responsive images are required.");
    if(mobile.byteLength>portableImageLimits.mobileBytes||desktop.byteLength>portableImageLimits.desktopBytes)throw new Error("A responsive image exceeds its delivery budget.");
    const variants=[{path:paths.mobile,bytes:mobile.byteLength,...webpDimensions(mobile)},{path:paths.desktop,bytes:desktop.byteLength,...webpDimensions(desktop)}];
    if(variants[0].bytes>portableImageLimits.mobileBytes||variants[1].bytes>portableImageLimits.desktopBytes||variants[0].width>720||variants[0].height>960)throw new Error("A responsive image exceeds its delivery budget or dimensions.");
    return {files:{[paths.mobile]:mobile,[paths.desktop]:desktop},variants,fallback:variants[1]};
  }
  // Backward compatibility for immutable older builds and source fixtures.
  // Additional images never use public originals. Only the historical hero
  // filename is accepted for immutable one-image exports and old fixtures.
  const legacy=id==="hero"?assets[paths.legacy]:undefined,data=Buffer.from(legacy||[]);
  if(data.length<24||data.length>portableImageLimits.sourceBytes||!data.subarray(0,8).equals(pngSignature))throw new Error("A valid local PNG hero image or responsive image pair is required before rendering.");
  const width=data.readUInt32BE(16),height=data.readUInt32BE(20);
  if(!width||!height||width>8192||height>8192)throw new Error("The hero image dimensions exceed their limit.");
  const fallback={path:paths.legacy,width,height,bytes:data.length};
  return {files:{[paths.legacy]:legacy!},variants:[],fallback};
}

export function portableHeroImages(assets:SiteFiles){return portableSlotImages(assets,"hero");}

export function portableLogoImage(assets:SiteFiles,id:string):{files:SiteFiles;variants:PortableImageVariant[];fallback:PortableImageVariant}{
  const target=portableLogoPath(id),bytes=assets[target];
  if(!bytes||bytes.byteLength>portableImageLimits.logoBytes)throw new Error("A local logo within its delivery budget is required.");
  const dimensions=webpDimensions(bytes);
  if(dimensions.width>600||dimensions.height>240)throw new Error("A logo exceeds its delivery dimensions.");
  return {files:{[target]:bytes},variants:[],fallback:{path:target,bytes:bytes.byteLength,...dimensions}};
}

/** Enumerate and validate the actual public asset set at the safety boundary.
 * No arbitrary private uploads, SVGs, originals or half-finished pairs qualify. */
export function portableAllImages(assets:SiteFiles){
  const hero=portableHeroImages(assets),sets=[hero],ids=new Set(["hero"]);let logos=0;
  if(hero.variants.length&&assets[portableImagePaths.legacy])throw new Error("The original PNG must stay private when responsive imagery is published.");
  for(const name of Object.keys(assets).filter(name=>name.startsWith("assets/images/"))){
    if(Object.hasOwn(hero.files,name))continue;
    const pair=/^assets\/images\/([a-z][a-z0-9-]{0,31})-(?:mobile|desktop)\.webp$/.exec(name);
    const logo=/^assets\/images\/([a-z][a-z0-9-]{0,31})\.webp$/.exec(name);
    if(pair){if(assets[`assets/images/${pair[1]}.webp`])throw new Error("Unexpected duplicate image and logo slot.");if(!ids.has(pair[1])){ids.add(pair[1]);sets.push(portableSlotImages(assets,pair[1]));}}
    else if(logo){if(ids.has(logo[1])||++logos>1)throw new Error("Unexpected duplicate or additional public logo.");ids.add(logo[1]);sets.push(portableLogoImage(assets,logo[1]));}
    else throw new Error("Unexpected public image artifact.");
    if(ids.size>5)throw new Error("The public website exceeds its image allowance.");
  }
  return {files:Object.assign({},...sets.map(set=>set.files)) as SiteFiles,variants:sets.flatMap(set=>[set.fallback,...set.variants])};
}
