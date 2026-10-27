import sharp from "sharp";
import type { SiteFiles } from "./artifacts";

export const portableImagePaths={mobile:"assets/images/hero-mobile.webp",desktop:"assets/images/hero-desktop.webp",legacy:"assets/images/hero.png"} as const;
export const portableImageLimits={mobileBytes:250_000,desktopBytes:400_000,sourceBytes:8_000_000,sourcePixels:24_000_000};
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
export type PortableImageVariant={path:string;width:number;height:number;bytes:number};

/** The normalized original remains in private build storage. Only these two
 * deterministic, metadata-free derivatives are admitted to new public bundles.
 * Keeping the full composition lets the renderer apply an approved focal point.
 */
export async function preparePortableImages(original:Uint8Array):Promise<SiteFiles> {
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
  const mobile=await encode([720,640,560,480],portableImageLimits.mobileBytes,4/3);
  const desktop=await encode([1600,1440,1280,1120,960],portableImageLimits.desktopBytes,1);
  return {[portableImagePaths.mobile]:mobile,[portableImagePaths.desktop]:desktop};
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

export function portableHeroImages(assets:SiteFiles):{files:SiteFiles;variants:PortableImageVariant[];fallback:PortableImageVariant} {
  const mobile=assets[portableImagePaths.mobile],desktop=assets[portableImagePaths.desktop];
  if(mobile||desktop){
    if(!mobile||!desktop)throw new Error("Both mobile and desktop responsive images are required.");
    if(mobile.byteLength>portableImageLimits.mobileBytes||desktop.byteLength>portableImageLimits.desktopBytes)throw new Error("A responsive image exceeds its delivery budget.");
    const variants=[{path:portableImagePaths.mobile,bytes:mobile.byteLength,...webpDimensions(mobile)},{path:portableImagePaths.desktop,bytes:desktop.byteLength,...webpDimensions(desktop)}];
    if(variants[0].bytes>portableImageLimits.mobileBytes||variants[1].bytes>portableImageLimits.desktopBytes||variants[0].width>720||variants[0].height>960)throw new Error("A responsive image exceeds its delivery budget or dimensions.");
    return {files:{[portableImagePaths.mobile]:mobile,[portableImagePaths.desktop]:desktop},variants,fallback:variants[1]};
  }
  // Backward compatibility for immutable older builds and source fixtures.
  const legacy=assets[portableImagePaths.legacy],data=Buffer.from(legacy||[]);
  if(data.length<24||data.length>portableImageLimits.sourceBytes||!data.subarray(0,8).equals(pngSignature))throw new Error("A valid local PNG hero image or responsive image pair is required before rendering.");
  const width=data.readUInt32BE(16),height=data.readUInt32BE(20);
  if(!width||!height||width>8192||height>8192)throw new Error("The hero image dimensions exceed their limit.");
  const fallback={path:portableImagePaths.legacy,width,height,bytes:data.length};
  return {files:{[portableImagePaths.legacy]:legacy},variants:[],fallback};
}
