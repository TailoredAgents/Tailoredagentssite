import sharp from "sharp";
import {isIP} from "node:net";
import {create,type Font} from "fontkit";
import {parse,type DefaultTreeAdapterTypes} from "parse5";
import data from "./font-assets/identity-fonts.json";
import {relativeSiteLink,safeSitePath,type SiteFiles} from "./artifacts";
import {designFamilies} from "./families";
import {colorLuminance} from "./design";
import {portableHeroImages,portableLogoImage,portableImagePaths} from "./images";
import {validateBlueprintStructure} from "./validate";
import type {SiteBlueprint} from "./types";

export const siteIdentityPaths={icon32:"assets/identity/favicon-32.png",icon64:"assets/identity/favicon-64.png",touch:"assets/identity/apple-touch-icon.png",social:"assets/identity/social-card.jpg"} as const;
export const siteIdentityLimits={iconBytes:30_000,touchBytes:80_000,socialBytes:300_000};
export const siteIdentityMarkers={start:"<!-- ta:site-identity:start -->",end:"<!-- ta:site-identity:end -->"};
const specs=[{path:siteIdentityPaths.icon32,width:32,height:32,contentType:"image/png",limit:siteIdentityLimits.iconBytes},{path:siteIdentityPaths.icon64,width:64,height:64,contentType:"image/png",limit:siteIdentityLimits.iconBytes},{path:siteIdentityPaths.touch,width:180,height:180,contentType:"image/png",limit:siteIdentityLimits.touchBytes},{path:siteIdentityPaths.social,width:1200,height:630,contentType:"image/jpeg",limit:siteIdentityLimits.socialBytes}] as const;
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
const fonts=new Map<string,Font>();
function localFont(name:"dm-sans.woff2"|"dm-serif-display.woff2"|"manrope.woff2",weight=600){
  const key=`${name}:${weight}`;let font=fonts.get(key);
  if(!font){font=create(Buffer.from(data[name],"base64")) as Font;if(font.variationAxes.wght)font=font.getVariation({wght:weight});fonts.set(key,font);}
  return font;
}
/** Glyph outlines come only from our bundled licensed font bytes (the same
 * WOFF2 subsets losslessly unpacked to TTF so fontkit supports their axes). Neither SVG
 * text/font resolution nor a machine's installed fonts participate in output. */
function textPath(value:string,font:Font,size:number,x:number,y:number,color:string){
  const run=font.layout(value),scale=size/font.unitsPerEm;let advance=0;
  const paths=run.glyphs.map((glyph,index)=>{const p=run.positions[index],markup=`<path d="${glyph.path.toSVG()}" transform="translate(${x+(advance+p.xOffset)*scale} ${y-p.yOffset*scale}) scale(${scale} ${-scale})"/>`;advance+=p.xAdvance;return markup;});
  return `<g fill="${color}">${paths.join("")}</g>`;
}
function textWidth(value:string,font:Font,size:number){return font.layout(value).positions.reduce((sum,p)=>sum+p.xAdvance,0)*size/font.unitsPerEm;}
function supportedText(value:string,font:Font){return Array.from(value.normalize("NFC").replace(/\s+/g," ").trim()).filter(char=>font.hasGlyphForCodePoint(char.codePointAt(0)!)).join("");}
function linesFor(value:string,font:Font,size:number,width:number){
  const lines:string[]=[];let line="";
  for(const word of value.split(" ").filter(Boolean)){
    if(textWidth(`${line}${line?" ":""}${word}`,font,size)<=width){line+=`${line?" ":""}${word}`;continue;}
    if(line){lines.push(line);line="";}
    for(const char of word){if(line&&textWidth(line+char,font,size)>width){lines.push(line);line="";}line+=char;}
  }
  if(line)lines.push(line);return lines;
}
function fitText(value:string,font:Font,width:number,maxLines:number,maximum=66,minimum=26){
  for(let size=maximum;size>=minimum;size-=2){const lines=linesFor(value,font,size,width);if(lines.length<=maxLines)return{lines,size};}
  // The validated brand-name limit is 180 characters. This is a last-resort
  // bounded presentation fallback; full original text remains in page metadata.
  const lines=linesFor(value,font,minimum,width).slice(0,maxLines),last=lines.at(-1)||"";
  lines[lines.length-1]=last.slice(0,-2)+"…";return{lines,size:minimum};
}
function colors(b:SiteBlueprint){const family=designFamilies[b.family],palette=b.design?.palette;return{background:palette?.background||family.background,ink:palette?.ink||family.ink,accent:palette?.accent||b.accent,muted:palette?.muted||family.muted};}
function readableInk(background:string){return colorLuminance(background)>.179?"#000000":"#ffffff";}

/** Free deterministic derivatives of the exact approved site, not another AI
 * image request. A supplied compact logo is kept whole; wide/blank logos use a
 * legible brand initial. No network access and no source metadata is retained. */
export async function prepareSiteIdentity(blueprint:SiteBlueprint,assets:SiteFiles):Promise<SiteFiles>{
  const b=validateBlueprintStructure(blueprint),palette=colors(b),theme=b.presentation?.fontTheme;
  const font=localFont(theme==="editorial"||theme==="warm"||(!theme&&b.fontPair==="editorial")?"dm-serif-display.woff2":theme==="technical"?"manrope.woff2":"dm-sans.woff2",b.design?.typography.weight||600),sans=localFont("dm-sans.woff2",600);
  const name=supportedText(b.brandName,font)||"Website concept",initial=supportedText(b.brandName,sans).match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase()||"•";
  const logoId=b.presentation?.logoAssetId;let usableLogo:Buffer|undefined,logoBackground=palette.background;
  if(logoId){const logo=portableLogoImage(assets,logoId),ratio=logo.fallback.width/logo.fallback.height;
    if(ratio>=.6&&ratio<=1.67){const candidate=Buffer.from(logo.files[logo.fallback.path]),raw=await sharp(candidate).ensureAlpha().raw().toBuffer();let red=0,green=0,blue=0,count=0;
      for(let i=0;i<raw.length;i+=4)if(raw[i+3]>32){red+=raw[i];green+=raw[i+1];blue+=raw[i+2];count++;}
      if(count){usableLogo=candidate;const average=`#${[red,green,blue].map(sum=>Math.round(sum/count).toString(16).padStart(2,"0")).join("")}`,foreground=colorLuminance(average),contrast=(value:string)=>{const background=colorLuminance(value);return(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);};if(contrast(logoBackground)<2)logoBackground=[palette.background,palette.ink,"#ffffff","#000000"].sort((a,b)=>contrast(b)-contrast(a))[0];}
    }
  }
  const iconSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" rx="34" fill="${palette.accent}"/>${textPath(initial,sans,104,(180-textWidth(initial,sans,104))/2,128,readableInk(palette.accent))}</svg>`;
  const icon=usableLogo?await sharp({create:{width:180,height:180,channels:4,background:logoBackground}}).composite([{input:await sharp(usableLogo).resize({width:148,height:148,fit:"inside"}).png().toBuffer(),gravity:"centre"}]).png().toBuffer():await sharp(Buffer.from(iconSvg)).png().toBuffer();
  const result:SiteFiles={};
  for(const spec of specs.filter(spec=>spec.contentType==="image/png"))result[spec.path]=await sharp(icon).resize(spec.width,spec.height).png({compressionLevel:9,adaptiveFiltering:true}).toBuffer();
  // A photo-free identity is a deliberate typographic treatment. This helper
  // does not waive the site's existing hero requirement: renderer/build checks
  // still enforce it. Partial or malformed supplied imagery must still fail.
  const hero=Object.values(portableImagePaths).some(path=>Object.hasOwn(assets,path))?portableHeroImages(assets):null;
  let image:Buffer|undefined;
  if(hero){const cropWidth=Math.min(hero.fallback.width,Math.round(hero.fallback.height*460/630)),cropHeight=Math.min(hero.fallback.height,Math.round(hero.fallback.width*630/460)),focal=b.design?.heroFocalPoint||{x:50,y:50};
    image=await sharp(hero.files[hero.fallback.path],{limitInputPixels:24_000_000,animated:false,failOn:"error"}).extract({left:Math.round((hero.fallback.width-cropWidth)*focal.x/100),top:Math.round((hero.fallback.height-cropHeight)*focal.y/100),width:cropWidth,height:cropHeight}).resize(460,630).flatten({background:palette.background}).png().toBuffer();
  }
  const title=fitText(name,font,image?620:1056,3,image?66:84),tagline=fitText(supportedText(b.tagline,sans),sans,image?610:1000,2,24,20),titleTop=270-(title.lines.length-1)*title.size*.5;
  const titleMarkup=title.lines.map((line,index)=>textPath(line,font,title.size,64,titleTop+index*title.size*1.14,palette.ink)).join("");
  const tagTop=Math.min(458,titleTop+(title.lines.length-1)*title.size*1.14+70);
  const tagMarkup=tagline.lines.map((line,index)=>textPath(line,sans,tagline.size,64,tagTop+index*34,palette.muted)).join("");
  const overlay=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="${image?740:1200}" height="630" fill="${palette.background}"/>${image?"":`<circle cx="1190" cy="620" r="250" fill="${palette.accent}" opacity="0.1"/><circle cx="1190" cy="620" r="300" fill="none" stroke="${palette.ink}" stroke-width="1" opacity="0.08"/>`}<rect x="64" y="541" width="82" height="5" rx="2" fill="${palette.accent}"/>${textPath("WEBSITE CONCEPT",sans,17,136,96,palette.muted)}${titleMarkup}${tagMarkup}</svg>`);
  const composition=sharp({create:{width:1200,height:630,channels:3,background:palette.background}}).composite([...(image?[{input:image,left:740,top:0}]:[]),{input:overlay,left:0,top:0},{input:await sharp(icon).resize(52,52).png().toBuffer(),left:64,top:62}]);
  for(const quality of [86,78,70,62]){const card=await composition.clone().jpeg({quality,mozjpeg:true,chromaSubsampling:"4:2:0"}).toBuffer();if(card.byteLength<=siteIdentityLimits.socialBytes){result[siteIdentityPaths.social]=card;break;}}
  if(!result[siteIdentityPaths.social])throw new Error("The sharing image exceeds its 300 KB delivery budget.");
  portableSiteIdentityAssets(result);return result;
}

const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
function pngDimensions(bytes:Uint8Array){
  const buffer=Buffer.from(bytes);if(buffer.length<45||!buffer.subarray(0,8).equals(pngSignature))throw new Error("An identity icon is not a PNG.");
  let offset=8,header=false,data=false,end=false,width=0,height=0;
  while(offset<buffer.length){if(offset+12>buffer.length)throw new Error("An identity PNG is truncated.");const length=buffer.readUInt32BE(offset),kind=buffer.toString("ascii",offset+4,offset+8),start=offset+8,finish=start+length;if(finish+4>buffer.length||!["IHDR","IDAT","IEND","pHYs"].includes(kind))throw new Error("Identity PNG metadata or animation is not permitted.");
    if(kind==="IHDR"){if(header||offset!==8||length!==13||![2,6].includes(buffer[start+9])||buffer[start+8]!==8||buffer[start+10]||buffer[start+11]||buffer[start+12])throw new Error("An identity PNG header is invalid.");header=true;width=buffer.readUInt32BE(start);height=buffer.readUInt32BE(start+4);}
    else if(kind==="IDAT"){if(!header||end||!length)throw new Error("An identity PNG image is invalid.");data=true;}
    else if(kind==="IEND"){if(!data||length||finish+4!==buffer.length)throw new Error("An identity PNG ending is invalid.");end=true;}
    else if(kind==="pHYs"&&length!==9)throw new Error("An identity PNG density is invalid.");offset=finish+4;
  }
  if(!header||!data||!end)throw new Error("An identity PNG is incomplete.");return{width,height};
}
function jpegDimensions(bytes:Uint8Array){
  const buffer=Buffer.from(bytes);if(buffer.length<20||buffer.readUInt16BE(0)!==0xffd8||buffer.readUInt16BE(buffer.length-2)!==0xffd9)throw new Error("A sharing image is not a complete JPEG.");
  let offset=2,width=0,height=0,frames=0,scans=0;
  while(offset<buffer.length-2){if(buffer[offset++]!==255)throw new Error("A sharing JPEG contains an invalid marker.");while(buffer[offset]===255)offset++;const kind=buffer[offset++];
    if(![0xe0,0xdb,0xc0,0xc2,0xc4,0xdd,0xda].includes(kind)||offset+2>buffer.length)throw new Error("Sharing JPEG metadata or unsupported frames are not permitted.");
    const length=buffer.readUInt16BE(offset),start=offset+2,end=offset+length;if(length<2||end>buffer.length-2)throw new Error("A sharing JPEG is truncated.");
    if(kind===0xe0&&(length!==16||buffer.toString("ascii",start,start+5)!=="JFIF\0"))throw new Error("Only standard JPEG density metadata is allowed.");
    if(kind===0xc0||kind===0xc2){if(length<11||++frames!==1||buffer[start]!==8)throw new Error("A sharing JPEG frame is invalid.");height=buffer.readUInt16BE(start+1);width=buffer.readUInt16BE(start+3);}
    offset=end;if(kind===0xda){scans++;while(offset<buffer.length-2){if(buffer[offset]===255&&buffer[offset+1]!==0&&!(buffer[offset+1]>=0xd0&&buffer[offset+1]<=0xd7))break;offset+=buffer[offset]===255?2:1;}}
  }
  if(offset!==buffer.length-2||frames!==1||!scans)throw new Error("A sharing JPEG is incomplete.");return{width,height};
}

/** Synchronous validation before a stored asset becomes public. Full decoding is
 * checked separately by QA; metadata files/extra paths and partial sets fail closed. */
export function portableSiteIdentityAssets(files:SiteFiles){
  const names=Object.keys(files).filter(name=>name.startsWith("assets/identity/")),result:SiteFiles={};
  if(!names.length)return{files:result,variants:[] as Array<{path:string;width:number;height:number;contentType:string;bytes:number}>};
  if(names.length!==specs.length||names.some(name=>!specs.some(spec=>spec.path===name)))throw new Error("The site needs exactly its four approved identity assets.");
  const variants=specs.map(spec=>{const bytes=files[spec.path];if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.byteLength>spec.limit)throw new Error("An identity asset exceeds its delivery budget.");const dimensions=spec.contentType==="image/png"?pngDimensions(bytes):jpegDimensions(bytes);if(dimensions.width!==spec.width||dimensions.height!==spec.height)throw new Error("An identity asset has incorrect dimensions.");result[spec.path]=bytes;return{path:spec.path,...dimensions,contentType:spec.contentType,bytes:bytes.byteLength};});
  return{files:result,variants};
}

export function identityPublicBase(value:string){
  let url:URL;try{url=new URL(value);}catch{throw new Error("The site identity requires a valid public base URL.");}
  const rawPath=/^https:\/\/[^/]+(\/[^?#]*)?$/.exec(value)?.[1]||"";
  if(!/^https:\/\/[^/]+(?:\/[^?#]*)?$/.test(value)||url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.port||!url.hostname.includes(".")||isIP(url.hostname.replace(/^\[|\]$/g,""))||/(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname)||/[\\%\s]/.test(value)||rawPath.includes("//")||rawPath.split("/").some(part=>part===".."||part==="."))throw new Error("The site identity requires a clean public HTTPS base URL.");
  url.pathname=url.pathname.replace(/\/+$/,"")+"/";return url.href;
}
export function siteIdentityHead(b:SiteBlueprint,page:SiteBlueprint["pages"][number],publicBaseUrl?:string){
  const base=publicBaseUrl?identityPublicBase(publicBaseUrl):undefined,local=(target:string)=>relativeSiteLink(page.path,target),absolute=(target:string)=>base?new URL(target,base).href:local(target),title=`${page.title} | ${b.brandName}`;
  const meta=(key:string,value:string,kind="property")=>`<meta ${kind}="${key}" content="${escape(value)}">`;
  const urlMeta=(key:string,target:string,role:"page"|"asset",kind="property")=>`<meta ${kind}="${key}" content="${escape(absolute(target))}" data-ta-site-url="${role}" data-ta-site-path="${target}">`;
  return `${siteIdentityMarkers.start}<link rel="icon" type="image/png" sizes="32x32" href="${escape(local(siteIdentityPaths.icon32))}"><link rel="icon" type="image/png" sizes="64x64" href="${escape(local(siteIdentityPaths.icon64))}"><link rel="apple-touch-icon" sizes="180x180" href="${escape(local(siteIdentityPaths.touch))}">${meta("theme-color",colors(b).accent,"name")}${meta("og:type","website")}${meta("og:site_name",b.brandName)}${meta("og:title",title)}${meta("og:description",page.description)}${urlMeta("og:url",page.path,"page")}${urlMeta("og:image",siteIdentityPaths.social,"asset")}${meta("og:image:type","image/jpeg")}${meta("og:image:width","1200")}${meta("og:image:height","630")}${meta("og:image:alt",`${b.brandName} — website concept`)}${meta("twitter:card","summary_large_image","name")}${meta("twitter:title",title,"name")}${meta("twitter:description",page.description,"name")}${urlMeta("twitter:image",siteIdentityPaths.social,"asset","name")}${meta("twitter:image:alt",`${b.brandName} — website concept`,"name")}${siteIdentityMarkers.end}`;
}

/** Check trusted, declarative metadata without admitting new active elements.
 * If a base is supplied, every crawler URL must belong to that exact version. */
export function assertSiteIdentityMetadata(files:SiteFiles,publicBaseUrl?:string){
  const identity=portableSiteIdentityAssets(files),hasIdentity=identity.variants.length>0,base=publicBaseUrl?identityPublicBase(publicBaseUrl):undefined;
  const requiredProperties=["og:type","og:site_name","og:title","og:description","og:url","og:image","og:image:type","og:image:width","og:image:height","og:image:alt"],requiredNames=["theme-color","twitter:card","twitter:title","twitter:description","twitter:image","twitter:image:alt"];
  let siteBinding:string|undefined;
  for(const name of Object.keys(files).filter(name=>name.endsWith(".html"))){
    const html=Buffer.from(files[name]).toString("utf8"),start=html.split(siteIdentityMarkers.start),end=html.split(siteIdentityMarkers.end);
    if(!hasIdentity){if(start.length!==1||end.length!==1)throw new Error("Identity metadata requires complete local assets.");continue;}
    if(start.length!==2||end.length!==2||html.indexOf(siteIdentityMarkers.start)>html.indexOf(siteIdentityMarkers.end))throw new Error("Identity metadata requires one trusted head block.");
    const blockStart=html.indexOf(siteIdentityMarkers.start),blockEnd=html.indexOf(siteIdentityMarkers.end);
    const nodes:Array<DefaultTreeAdapterTypes.Element>=[],visit=(node:DefaultTreeAdapterTypes.Node)=>{if("tagName"in node)nodes.push(node);if("childNodes"in node)node.childNodes.forEach(visit);};visit(parse(html,{sourceCodeLocationInfo:true}));
    const head=nodes.find(node=>node.tagName==="head"),metas=nodes.filter(node=>node.tagName==="meta"),read=(node:DefaultTreeAdapterTypes.Element,key:string)=>node.attrs.find(a=>a.name===key)?.value;
    if(!head?.sourceCodeLocation?.startTag||!head.sourceCodeLocation.endTag||blockStart<head.sourceCodeLocation.startTag.endOffset||blockEnd+siteIdentityMarkers.end.length>head.sourceCodeLocation.endTag.startOffset)throw new Error("The identity block must remain inside the head.");
    const inBlock=(node:DefaultTreeAdapterTypes.Element)=>node.parentNode===head&&!!node.sourceCodeLocation&&node.sourceCodeLocation.startOffset>=blockStart+siteIdentityMarkers.start.length&&node.sourceCodeLocation.endOffset<=blockEnd;
    const meta=(key:string,kind="property",identityMeta=true)=>{const matches=metas.filter(node=>read(node,kind)===key);if(matches.length!==1||matches[0].parentNode!==head||!read(matches[0],"content")?.trim()||(identityMeta&&!inBlock(matches[0])))throw new Error("Identity metadata is missing, duplicated or outside its trusted head block.");return matches[0];};
    requiredProperties.forEach(key=>meta(key));requiredNames.forEach(key=>meta(key,"name"));
    const titles=nodes.filter(node=>node.tagName==="title"&&node.parentNode===head),title=titles.length===1?titles[0].childNodes.map(node=>"value"in node?node.value:"").join(""):"",description=read(meta("description","name",false),"content");
    if(!title||read(meta("og:title"),"content")!==title||read(meta("twitter:title","name"),"content")!==title||read(meta("og:description"),"content")!==description||read(meta("twitter:description","name"),"content")!==description||read(meta("og:image:alt"),"content")!==read(meta("twitter:image:alt","name"),"content")||!/^#[a-f\d]{6}$/i.test(read(meta("theme-color","name"),"content")!))throw new Error("Sharing titles, descriptions and identity details must match their page.");
    for(const [key,kind,value]of [["og:type","property","website"],["og:image:type","property","image/jpeg"],["og:image:width","property","1200"],["og:image:height","property","630"],["twitter:card","name","summary_large_image"]])if(read(meta(key,kind),"content")!==value)throw new Error("The sharing metadata does not match its image contract.");
    for(const [key,kind,target,role]of [["og:url","property",name,"page"],["og:image","property",siteIdentityPaths.social,"asset"],["twitter:image","name",siteIdentityPaths.social,"asset"]]){
      const node=meta(key,kind),value=read(node,"content")!;safeSitePath(target);
      if(read(node,"data-ta-site-url")!==role||read(node,"data-ta-site-path")!==target)throw new Error("The sharing URL does not identify its local artifact.");
      if(base){if(value!==new URL(target,base).href)throw new Error("The sharing URL belongs to a different preview version.");}
      else{let candidate="relative";if(value!==relativeSiteLink(name,target)){if(!value.endsWith(target))throw new Error("The sharing URL does not match its local artifact.");candidate=identityPublicBase(value.slice(0,-target.length));if(value!==new URL(target,candidate).href)throw new Error("The sharing URL does not match its local artifact.");}if(siteBinding&&siteBinding!==candidate)throw new Error("The sharing URLs must use one public preview base.");siteBinding=candidate;}
    }
    for(const spec of specs.filter(spec=>spec.contentType==="image/png")){
      const rel=spec.path===siteIdentityPaths.touch?"apple-touch-icon":"icon",links=nodes.filter(node=>node.tagName==="link"&&read(node,"rel")===rel&&read(node,"sizes")===`${spec.width}x${spec.height}`);
      if(links.length!==1||!inBlock(links[0])||read(links[0],"href")!==relativeSiteLink(name,spec.path)||(rel==="icon"&&read(links[0],"type")!=="image/png"))throw new Error("The favicon metadata does not match its local asset.");
    }
  }
}
