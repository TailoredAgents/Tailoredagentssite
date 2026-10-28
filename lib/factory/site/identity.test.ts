import {beforeAll,describe,expect,it} from "vitest";
import sharp from "sharp";
import {fixtureBlueprint,fixtureHeroSvg} from "./fixtures";
import {preparePortableImages,preparePortableLogo} from "./images";
import {prepareSiteIdentity,portableSiteIdentityAssets,siteIdentityPaths,siteIdentityLimits,assertSiteIdentityMetadata,identityPublicBase} from "./identity";
import {renderPortableSite} from "./render";
import {portableBundle} from "./validate";
import {assertPortableSiteSafety} from "./safety";
import type {SiteFiles} from "./artifacts";

const text=(bytes:Uint8Array)=>Buffer.from(bytes).toString("utf8"),base="https://preview.example.com/p/version-one/";
let assets:SiteFiles,identity:SiteFiles;
beforeAll(async()=>{assets=await preparePortableImages(await sharp(Buffer.from(fixtureHeroSvg)).png().toBuffer());identity=await prepareSiteIdentity(fixtureBlueprint("trades","split",true),assets);});
function site(publicBaseUrl?:string){return renderPortableSite(portableBundle(fixtureBlueprint("trades","split",true)),{...assets,...identity},{publicBaseUrl}).files;}
describe("Complete portable website identity",()=>{
  it("uses the selected hero mobile crop for the sharing card without changing icons",async()=>{
    const b=fixtureBlueprint();b.design!.heroFocalPoint={x:0,y:50};
    const red=await sharp({create:{width:800,height:900,channels:3,background:"#ff0000"}}).png().toBuffer();
    const source=await sharp({create:{width:1600,height:900,channels:3,background:"#0000ff"}}).composite([{input:red,left:0,top:0}]).png().toBuffer();
    const images=await preparePortableImages(source);
    const legacy=await prepareSiteIdentity(b,images);
    b.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[],imageFocalPoints:[{assetId:"hero",desktop:{x:0,y:50},mobile:{x:100,y:50}}]};
    const selected=await prepareSiteIdentity(b,images);
    const pixel=async(bytes:Uint8Array)=>[...await sharp(bytes).extract({left:960,top:315,width:1,height:1}).raw().toBuffer()];
    const left=await pixel(legacy[siteIdentityPaths.social]),right=await pixel(selected[siteIdentityPaths.social]);
    expect(left[0]).toBeGreaterThan(240);expect(left[2]).toBeLessThan(20);
    expect(right[2]).toBeGreaterThan(240);expect(right[0]).toBeLessThan(20);
    expect(selected[siteIdentityPaths.icon32]).toEqual(legacy[siteIdentityPaths.icon32]);
  });
  it("creates deterministic, decodable metadata-free icons and a bounded 1200x630 JPEG using bundled fonts",async()=>{
    expect(await prepareSiteIdentity(fixtureBlueprint("trades","split",true),assets)).toEqual(identity);
    expect(Object.keys(identity).sort()).toEqual(Object.values(siteIdentityPaths).sort());
    expect(portableSiteIdentityAssets(identity).variants.map(v=>[v.width,v.height])).toEqual([[32,32],[64,64],[180,180],[1200,630]]);
    for(const [name,bytes]of Object.entries(identity)){const image=sharp(bytes),metadata=await image.metadata();expect(metadata.format).toBe(name.endsWith("jpg")?"jpeg":"png");expect(metadata.exif).toBeUndefined();expect(metadata.icc).toBeUndefined();expect(metadata.xmp).toBeUndefined();expect((await image.raw().toBuffer()).length).toBeGreaterThan(0);}
    expect(identity[siteIdentityPaths.social].byteLength).toBeLessThanOrEqual(siteIdentityLimits.socialBytes);
  });
  it("reuses a compact approved logo without cropping; wide and transparent logos fall back to a readable initial",async()=>{
    const b=fixtureBlueprint(),logo=await sharp({create:{width:120,height:120,channels:4,background:"#ff00aa"}}).png().toBuffer();
    b.media=[{id:"brand",role:"logo",source:"provided",uploadId:"test-upload",prompt:"",alt:"Approved logo",caption:""}];
    b.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:"brand",pageImages:[],sectionImages:[]};
    const supplied=await prepareSiteIdentity(b,{...assets,...await preparePortableLogo(logo,"brand")}),fallback=await prepareSiteIdentity({...b,media:[],presentation:{...b.presentation,logoAssetId:null}},assets);
    expect(supplied[siteIdentityPaths.icon32]).not.toEqual(fallback[siteIdentityPaths.icon32]);
    const center=await sharp(supplied[siteIdentityPaths.touch]).extract({left:90,top:90,width:1,height:1}).raw().toBuffer();expect([...center].slice(0,3)).toEqual([255,0,170]);
    const wide=await sharp({create:{width:600,height:120,channels:4,background:"#ff00aa"}}).png().toBuffer(),blank=await sharp({create:{width:120,height:120,channels:4,background:{r:1,g:2,b:3,alpha:0}}}).png().toBuffer();
    for(const source of [wide,blank])expect((await prepareSiteIdentity(b,{...assets,...await preparePortableLogo(source,"brand")}))[siteIdentityPaths.icon32]).toEqual(fallback[siteIdentityPaths.icon32]);
  });
  it("supports each font theme, dark palettes and long/special-character names without interpreting markup",async()=>{
    for(const fontTheme of ["studio","technical","editorial","warm"] as const){
      const b=fixtureBlueprint("hospitality");b.brandName="Avery & Friends <Design> — Considered Spaces and UncommonlyLongBusinessNamesForTesting";b.presentation={version:1,fontTheme,heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[]};
      const generated=await prepareSiteIdentity(b,assets);expect(portableSiteIdentityAssets(generated).variants).toHaveLength(4);expect((await sharp(generated[siteIdentityPaths.social]).raw().toBuffer()).length).toBe(1200*630*3);
      const files=renderPortableSite(portableBundle(b),{...assets,...generated},{publicBaseUrl:base}).files;assertPortableSiteSafety(files);expect(text(files["index.html"])).toContain("Avery &amp; Friends &lt;Design&gt;");
    }
  });
  it("uses per-page descriptions/URLs and relative icon links while pinning the sharing card to the exact version",()=>{
    const files=site(base);assertPortableSiteSafety(files);assertSiteIdentityMetadata(files,base);
    const home=text(files["index.html"]),inner=text(files["services/index.html"]);
    expect(home).toContain(`content="${base}index.html" data-ta-site-url="page" data-ta-site-path="index.html"`);
    expect(inner).toContain(`content="${base}services/index.html" data-ta-site-url="page"`);
    expect(inner).toContain(`href="../${siteIdentityPaths.icon32}"`);expect(inner).toContain(`content="${base}${siteIdentityPaths.social}"`);
    expect(inner).toContain('name="twitter:card" content="summary_large_image"');expect(inner).toContain('name="robots" content="noindex,nofollow"');
    expect(()=>assertSiteIdentityMetadata(files,"https://preview.example.com/p/other-version/")).toThrow("different preview version");
  });
  it("keeps historical bundles unchanged and makes unbound identity portable through explicit markers",()=>{
    const legacy=renderPortableSite(portableBundle(fixtureBlueprint()),assets).files;assertPortableSiteSafety(legacy);expect(text(legacy["index.html"])).not.toContain("og:image");expect(portableSiteIdentityAssets(legacy).variants).toHaveLength(0);
    const files=site();assertPortableSiteSafety(files);expect(text(files["services/index.html"])).toContain(`content="../${siteIdentityPaths.social}" data-ta-site-url="asset"`);
  });
  it("makes a deliberate typographic card when no photo exists without accepting incomplete imagery or bypassing site requirements",async()=>{
    const b=fixtureBlueprint("professional"),noPhoto=await prepareSiteIdentity(b,{}),image=sharp(noPhoto[siteIdentityPaths.social]);
    expect(portableSiteIdentityAssets(noPhoto).variants).toHaveLength(4);expect((await image.metadata()).width).toBe(1200);expect((await image.raw().toBuffer()).length).toBe(1200*630*3);
    expect(await prepareSiteIdentity(b,{})).toEqual(noPhoto);
    await expect(prepareSiteIdentity(b,{"assets/images/hero-mobile.webp":assets["assets/images/hero-mobile.webp"]})).rejects.toThrow("Both mobile and desktop");
    await expect(prepareSiteIdentity(b,{"assets/images/hero.png":Buffer.from("invalid")})).rejects.toThrow("valid local PNG");
    expect(()=>renderPortableSite(portableBundle(b),noPhoto)).toThrow("valid local PNG");
  });
  it("fails closed for partial assets, unexpected paths, wrong types/dimensions and unbounded image bytes",async()=>{
    const partial={...identity};delete partial[siteIdentityPaths.icon64];expect(()=>portableSiteIdentityAssets(partial)).toThrow("four approved");
    expect(()=>portableSiteIdentityAssets({...identity,"assets/identity/private.svg":Buffer.from("<svg/>")})).toThrow("four approved");
    expect(()=>portableSiteIdentityAssets({...identity,[siteIdentityPaths.icon32]:identity[siteIdentityPaths.social]})).toThrow("not a PNG");
    expect(()=>portableSiteIdentityAssets({...identity,[siteIdentityPaths.icon32]:identity[siteIdentityPaths.icon64]})).toThrow("incorrect dimensions");
    expect(()=>portableSiteIdentityAssets({...identity,[siteIdentityPaths.social]:Buffer.alloc(300001)})).toThrow("delivery budget");
    const metadata=await sharp(identity[siteIdentityPaths.social]).withMetadata().jpeg().toBuffer();expect(()=>portableSiteIdentityAssets({...identity,[siteIdentityPaths.social]:metadata})).toThrow("metadata");
    const tail=Buffer.concat([Buffer.from(identity[siteIdentityPaths.icon32]),Buffer.from("tail")]);expect(()=>portableSiteIdentityAssets({...identity,[siteIdentityPaths.icon32]:tail})).toThrow("ending");
  });
  it("rejects external icon/CSS resources, missing or duplicated metadata and mismatched sharing targets",()=>{
    const files=site(base),html=text(files["index.html"]),patch=(from:string,to:string)=>({...files,"index.html":Buffer.from(html.replace(from,to))});
    for(const modified of [patch(`href="${siteIdentityPaths.icon32}"`,'href="https://evil.example/icon.png"'),patch('property="og:image"','property="og:missing"'),patch('<meta property="og:type" content="website">','<meta property="og:type" content="website"><meta property="og:type" content="website">'),patch(`content="${base}${siteIdentityPaths.social}"`,'content="https://other.example/card.jpg"'),patch('data-ta-site-path="index.html"','data-ta-site-path="private.json"'),patch('rel="stylesheet"','rel="preload"')])expect(()=>assertPortableSiteSafety(modified)).toThrow();
  });
  it("accepts only clean public HTTPS metadata bases",()=>{
    expect(identityPublicBase("https://preview.example.com/p/example")).toBe("https://preview.example.com/p/example/");
    for(const url of ["http://example.com/","https://user:secret@example.com/","https://localhost/","https://127.0.0.1/","https://10.0.0.1/","https://example.com/?key=secret","https://example.com/#fragment","https://example.com:8443/","https://example.com/%2fescape/","https://example.com/foo/../other/","https://example.com//other/","https://8.8.8.8/"])expect(()=>identityPublicBase(url)).toThrow();
  });
  it("requires matching titles and descriptions entirely within one renderer-owned head block",()=>{
    const files=site(base),html=text(files["index.html"]),patch=(content:string)=>({...files,"index.html":Buffer.from(content)});
    expect(()=>assertPortableSiteSafety(patch(html.replace('<meta property="og:type" content="website">',"").replace("</head>",'<meta property="og:type" content="website"></head>')))).toThrow("trusted head block");
    expect(()=>assertPortableSiteSafety(patch(html.replace("<!-- ta:site-identity:start -->","").replace("<body ","<!-- ta:site-identity:start --><body ")))).toThrow("trusted head block");
    expect(()=>assertPortableSiteSafety(patch(html.replace('name="twitter:title" content="Home | Northline Works"','name="twitter:title" content="Different business"')))).toThrow("must match");
    expect(()=>assertPortableSiteSafety({...files,"services/index.html":Buffer.from(text(files["services/index.html"]).replaceAll(base,"https://different.example.com/p/version-one/"))})).toThrow("one public preview base");
  });
});
