import { parse, type DefaultTreeAdapterTypes } from "parse5";
import path from "node:path";
import { siteManifest, type SiteFiles } from "./artifacts";
import { siteCsp, trustedSiteRuntime } from "./render";
import { portableAllImages } from "./images";
import { portableFontPaths,portableFontLicensePath,stripApprovedFontCss } from "./fonts";
import {portableSiteIdentityAssets,assertSiteIdentityMetadata,siteIdentityPaths} from "./identity";

/** Defense in depth at the browser boundary: even a corrupted stored bundle
 * cannot introduce executable code, remote resources, frames or form delivery.
 */
export function assertPortableSiteSafety(files:SiteFiles) {
  siteManifest(files);
  assertSiteIdentityMetadata(files);
  const identityFiles=new Set(Object.keys(portableSiteIdentityAssets(files).files));
  const imageSet=portableAllImages(files),imageVariants=imageSet.variants;
  const imageFiles=new Set(Object.keys(imageSet.files));
  const fontFiles=new Set([...portableFontPaths,portableFontLicensePath]);
  const text=(name:string)=>Buffer.from(files[name]||[]).toString("utf8");
  if(text("assets/runtime.js")!==trustedSiteRuntime)throw new Error("Only the trusted preview runtime can execute during website QA.");
  if(/@import|url\s*\(|image-set\s*\(|expression\s*\(/i.test(stripApprovedFontCss(text("assets/site.css"),files)))throw new Error("Portable styles cannot load resources or execute expressions.");
  for(const name of Object.keys(files)){
    if(!imageFiles.has(name)&&!identityFiles.has(name)&&!fontFiles.has(name)&&!/^(?:index\.html|[a-z][a-z0-9-]{0,48}\/index\.html|assets\/(?:site\.css|runtime\.js)|robots\.txt)$/.test(name))throw new Error("Unexpected public preview artifact.");
    if(!name.endsWith(".html"))continue;
    const tree=parse(text(name));let scripts=0,styles=0,csp=0;
    const local=(value:string,target:string)=>value===path.posix.relative(path.posix.dirname(name),target);
    const localImage=(value:string)=>imageVariants.find(image=>local(value,image.path));
    const checkSourceSet=(value:string)=>{
      const entries=value.split(",");
      if(!value||entries.length>2)throw new Error("Responsive images require a bounded local source set.");
      const seen=new Set<string>();
      for(const entry of entries){
        const match=entry.trim().match(/^([^\s,]+)(?:\s+([1-9][0-9]{0,3})w)?$/),variant=match?localImage(match[1]):undefined;
        if(!match||!variant||!variant.path.endsWith(".webp")||(match[2]&&Number(match[2])!==variant.width)||seen.has(variant.path)||(entries.length>1&&!match[2]))throw new Error("Only local approved responsive imagery is allowed.");
        seen.add(variant.path);
      }
    };
    const visit=(node:DefaultTreeAdapterTypes.Node)=>{
      if("tagName" in node){
        const attrs=Object.fromEntries(node.attrs.map(a=>[a.name,a.value]));
        if(["iframe","frame","frameset","object","embed","base","svg","math","video","audio","portal"].includes(node.tagName)||node.attrs.some(a=>a.name.startsWith("on")||["style","srcdoc","ping","formaction","background","action"].includes(a.name)))throw new Error("Active or external content is not allowed in portable previews.");
        if(attrs.srcset!==undefined){
          if(!["img","source"].includes(node.tagName))throw new Error("Unexpected responsive image source.");
          checkSourceSet(attrs.srcset);
        }
        if(attrs.sizes!==undefined&&node.tagName!=="link"&&(!attrs.srcset||!["img","source"].includes(node.tagName)||!/^(?:\(max-width: [1-9][0-9]{0,3}px\) )?[1-9][0-9]{0,3}(?:px|vw)(?:, [1-9][0-9]{0,3}(?:px|vw))?$/.test(attrs.sizes)))throw new Error("Unexpected responsive image sizing.");
        if(node.tagName==="script"){
          scripts++;if(!local(attrs.src,"assets/runtime.js")||node.childNodes.some(n=>"value" in n&&n.value.trim()))throw new Error("Only the trusted preview runtime can execute during website QA.");
        }else if(node.tagName==="link"){
          if(attrs.rel==="stylesheet"){styles++;if(!local(attrs.href,"assets/site.css"))throw new Error("Only local portable styles are allowed.");}
          else if(attrs.rel==="icon"||attrs.rel==="apple-touch-icon"){
            const target=attrs.rel==="apple-touch-icon"?siteIdentityPaths.touch:attrs.sizes==="32x32"?siteIdentityPaths.icon32:attrs.sizes==="64x64"?siteIdentityPaths.icon64:null;
            if(!target||!identityFiles.has(target)||!local(attrs.href,target)||attrs.sizes!==(attrs.rel==="apple-touch-icon"?"180x180":target===siteIdentityPaths.icon32?"32x32":"64x64")||(attrs.rel==="icon"&&attrs.type!=="image/png"))throw new Error("Only exact local identity icons are allowed.");
          }else throw new Error("Only local portable styles and identity icons are allowed.");
        }else if(node.tagName==="style")throw new Error("Inline styles are not allowed in portable previews.");
        else if(node.tagName==="img"&&!localImage(attrs.src))throw new Error("Only local approved imagery is allowed.");
        else if(node.tagName==="source"){
          if(!node.parentNode||!("tagName" in node.parentNode)||node.parentNode.tagName!=="picture"||!attrs.srcset||attrs.src||attrs.type!=="image/webp"||(attrs.media&&!/^\(max-width: [1-9][0-9]{0,3}px\)$/.test(attrs.media)))throw new Error("Only local picture image sources are allowed.");
        }else if(node.tagName==="picture"){
          const elements=node.childNodes.filter((child):child is DefaultTreeAdapterTypes.Element=>"tagName" in child);
          if(elements.length!==2||elements[0].tagName!=="source"||elements[1].tagName!=="img")throw new Error("Responsive pictures require one local source and image fallback.");
        }
        else if(node.tagName==="meta"&&attrs["http-equiv"]){
          if(attrs["http-equiv"].toLowerCase()!=="content-security-policy"||attrs.content!==siteCsp)throw new Error("Unexpected preview browser policy.");csp++;
        }
        if(attrs.href&&node.tagName!=="link"&&!/^(?:mailto:[^\s<>]+|tel:[+0-9]+|#[a-z][a-z0-9-]*|(?:\.\.\/)?(?:index\.html|[a-z][a-z0-9-]*\/index\.html)(?:#[a-z][a-z0-9-]*)?)$/.test(attrs.href))throw new Error("A preview link uses an unsupported destination.");
        if(attrs.src&&!["script","img"].includes(node.tagName))throw new Error("Unexpected resource source.");
      }
      if("childNodes" in node)for(const child of node.childNodes)visit(child);
    };
    visit(tree);
    if(scripts!==1||styles!==1||csp!==1)throw new Error("The preview needs exactly its trusted script, stylesheet and browser policy.");
  }
}
