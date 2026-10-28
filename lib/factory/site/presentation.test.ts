import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {chromium,type Browser} from "playwright";
import sharp from "sharp";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {fixtureBlueprint,fixtureHeroSvg,fixtureSitePlan} from "./fixtures";
import {applyApprovedDesign,contrastRatio} from "./design";
import {portableBundle} from "./validate";
import {preparePortableImages,preparePortableLogo} from "./images";
import {renderPortableSite,siteActionTarget} from "./render";
import {portableFontFiles,portableFontCss,stripApprovedFontCss} from "./fonts";
import {assertPortableSiteSafety} from "./safety";
import {checkPortableSite} from "./qa";
import {siteContentType,type SiteFiles} from "./artifacts";
import {designFamilyIds,type DesignFamilyId,type SiteBlueprint} from "./types";

let browser:Browser,assets:SiteFiles;
const output=path.join(tmpdir(),"tailored-agents-premium-renderer");
beforeAll(async()=>{
  browser=await chromium.launch({headless:true});await mkdir(output,{recursive:true});
  const hero=await sharp(Buffer.from(fixtureHeroSvg)).png().toBuffer();
  const detail=await sharp(Buffer.from(fixtureHeroSvg)).extract({left:220,top:250,width:900,height:700}).modulate({saturation:.8}).png().toBuffer();
  const logo=await sharp({create:{width:400,height:130,channels:4,background:"#1c3d32"}}).png().toBuffer();
  assets={...await preparePortableImages(hero),...await preparePortableImages(detail,"detail"),...await preparePortableLogo(logo,"brand")};
},30000);
afterAll(async()=>{await browser?.close();});

function presentationFixture(family:DesignFamilyId="trades",multiple=false):SiteBlueprint{
  const b=fixtureBlueprint(family,undefined,multiple);
  b.presentation={version:1,fontTheme:family==="professional"?"technical":family==="editorial"||family==="hospitality"?"editorial":family==="wellness"?"warm":"studio",heroEmphasis:b.pages[0].hero.headline.split(" ").slice(-3).join(" "),logoAssetId:"brand",pageImages:[],sectionImages:[{pagePath:"index.html",sectionId:"services",itemIndex:0,assetId:"detail"},{pagePath:"index.html",sectionId:"services",itemIndex:1,assetId:"hero"}]};
  b.media=[{id:"brand",role:"logo",source:"provided",uploadId:"synthetic-logo",prompt:"",alt:`${b.brandName} synthetic test mark`,caption:""},{id:"detail",role:"photo",source:"provided",uploadId:"synthetic-photo",prompt:"",alt:"Synthetic architecture detail for renderer verification",caption:"Synthetic test illustration."}];
  b.pages[0].sections.find(s=>s.id==="services")!.layout=family==="professional"?"service-tabs":family==="wellness"||family==="general"?"image-grid":"alternating";
  return b;
}

describe("Premium portable presentation",()=>{
  it("only renders an inner-page introduction image when explicitly bound, preserving legacy heroes",()=>{
    const b=presentationFixture("trades",true);
    const files=renderPortableSite(portableBundle(b),assets).files;
    expect(Buffer.from(files["index.html"]).toString()).toContain('class="hero-image"');
    for(const page of b.pages.slice(1)){
      const html=Buffer.from(files[page.path]).toString();
      expect(html).not.toContain('class="hero-image"');expect(html).toContain('class="hero-inner hero-text-only"');
    }
    b.presentation!.pageImages=[{pagePath:b.pages[1].path,assetId:"detail"}];
    const explicit=Buffer.from(renderPortableSite(portableBundle(b),assets).files[b.pages[1].path]).toString();
    expect(explicit).toContain('class="hero-image"');expect(explicit).toContain('src="../assets/images/detail-desktop.webp"');
    const legacy=renderPortableSite(portableBundle(fixtureBlueprint("trades","split",true)),assets).files;
    expect(Buffer.from(legacy["approach/index.html"]).toString()).toContain('class="hero-image"');
  });
  it.each(["split","immersive","framed"] as const)("keeps mobile contact controls in their own space on every %s route",async composition=>{
    const b=presentationFixture("trades",true);b.composition=composition;b.contact.phone="+16785550101";
    b.pages.push({...structuredClone(b.pages[1]),path:"coverage/index.html",title:"Coverage"},{...structuredClone(b.pages[1]),path:"contact/index.html",title:"Contact"});
    const {files}=renderPortableSite(portableBundle(b),assets);
    const context=await browser.newContext({viewport:{width:390,height:844}});
    try{
      await context.route("**/*",route=>{const key=new URL(route.request().url()).pathname.slice(1)||"index.html";return files[key]?route.fulfill({body:Buffer.from(files[key]),contentType:siteContentType(key)}):route.abort();});
      const page=await context.newPage();
      for(const route of b.pages){
        await page.goto(`https://presentation.test/${route.path}`);await page.evaluate(()=>document.fonts.ready);
        const layout=await page.evaluate(()=>{
          const strip=document.querySelector<HTMLElement>(".mobile-contact")!,hero=document.querySelector(".site-hero")!.getBoundingClientRect(),next=document.querySelector("main > .site-section")!.getBoundingClientRect(),rect=strip.getBoundingClientRect();
          const heroInner=document.querySelector(".hero-inner")!.getBoundingClientRect(),copy=document.querySelector(".hero-copy")!.getBoundingClientRect();
          return {position:getComputedStyle(strip).position,inMain:strip.parentElement?.tagName==="MAIN",afterHero:rect.top>=hero.bottom,beforeContent:rect.bottom<=next.top,overflow:document.documentElement.scrollWidth>innerWidth+2,imageCount:document.querySelectorAll(".site-hero .hero-image").length,copyUsesWidth:copy.width>=heroInner.width-2};
        });
        expect(layout,route.path).toMatchObject({position:"static",inMain:true,afterHero:true,beforeContent:true,overflow:false,imageCount:route.path==="index.html"?1:0});
        if(route.path!=="index.html")expect(layout.copyUsesWidth,route.path).toBe(true);
        await page.locator(".mobile-contact").scrollIntoViewIfNeeded();
        await page.getByRole("navigation",{name:"Quick contact",exact:true}).getByRole("link",{name:"Get in touch",exact:true}).click();
        expect(new URL(page.url()).hash).toBe("#contact");
      }
    }finally{await context.close();}
  },45000);
  it.each(["split","immersive"] as const)("keeps the %s hero disclosure readable below the image on desktop and mobile",async composition=>{
    const b=presentationFixture();b.composition=composition;
    const {files}=renderPortableSite(portableBundle(b),assets),context=await browser.newContext();
    try{
      await context.route("**/*",route=>{const key=new URL(route.request().url()).pathname.slice(1)||"index.html";return files[key]?route.fulfill({body:Buffer.from(files[key]),contentType:siteContentType(key)}):route.abort();});
      const page=await context.newPage();
      for(const width of [390,1440]){
        await page.setViewportSize({width,height:900});await page.goto("https://presentation.test/index.html");await page.evaluate(()=>document.fonts.ready);
        const caption=await page.evaluate(()=>{
          const image=document.querySelector(".hero-image")!.getBoundingClientRect(),note=document.querySelector(".hero-image-caption")!,rect=note.getBoundingClientRect();
          return {belowImage:rect.top>=image.bottom,position:getComputedStyle(note).position,fontSize:parseFloat(getComputedStyle(note).fontSize),text:note.textContent,overPhotoCaptions:document.querySelectorAll(".hero-image figcaption").length,overflow:document.documentElement.scrollWidth>innerWidth+2};
        });
        expect(caption).toMatchObject({belowImage:true,position:"static",text:b.heroImage.caption,overPhotoCaptions:0,overflow:false});expect(caption.fontSize).toBeGreaterThanOrEqual(12);
      }
    }finally{await context.close();}
  },30000);
  it("routes primary, secondary and item CTA language to the real action, including inner-page calls",()=>{
    const b=presentationFixture("trades",true);b.contact.phone="+16785550101";b.contact.email="team@example.test";
    b.pages[1].sections.push({id:"inquiry",kind:"contact",layout:"split",eyebrow:"Start here",title:"Tell us what you need.",body:"Get in touch with our team.",items:[]});
    b.interactions!.forms=[{pagePath:b.pages[1].path,sectionId:"inquiry",fields:["name","email","message"],submitLabel:"Preview inquiry"}];
    b.pages[2].hero.primaryCta="Explore our services";b.pages[2].hero.secondaryCta="Call our team";
    const {files}=renderPortableSite(portableBundle(b),assets),inner=Buffer.from(files["services/index.html"]).toString();
    expect(inner).toContain('href="tel:+16785550101">Call our team');
    expect(inner).toContain('href="../approach/index.html#inquiry">Get in touch');
    expect(siteActionTarget("Email our team",b,b.pages[2],"#options")).toBe("mailto:team@example.test");
    expect(siteActionTarget("Request service",b,b.pages[2],"#options")).toBe("../approach/index.html#inquiry");
    expect(siteActionTarget("View our services",b,b.pages[0],"#benefits")).toBe("services/index.html");
    expect(()=>assertPortableSiteSafety(files)).not.toThrow();
  });
  it("ships locally licensed fonts and all bound imagery without external resources or an invented letter logo",()=>{
    const b=presentationFixture(),{files}=renderPortableSite(portableBundle(b),assets),html=Buffer.from(files["index.html"]).toString();
    expect(html).toContain('class="brand-logo"');expect(html).not.toContain('class="brand-symbol"');expect(html).toContain("<em>");
    expect(html).toContain('src="assets/images/detail-desktop.webp"');expect(html).toContain('loading="lazy"');
    expect(files["assets/fonts/dm-sans.woff2"].byteLength).toBeGreaterThan(20000);
    expect(Buffer.from(files["assets/fonts/licenses.txt"]).toString()).toContain("SIL OPEN FONT LICENSE");
    expect(()=>assertPortableSiteSafety(files)).not.toThrow();
    expect(()=>renderPortableSite(portableBundle(b),Object.fromEntries(Object.entries(assets).filter(([key])=>!key.includes("detail"))))).toThrow();
    const corrupt={...files,"assets/fonts/dm-sans.woff2":Buffer.from("unexpected font")};expect(()=>assertPortableSiteSafety(corrupt)).toThrow("bundled");
    expect(()=>stripApprovedFontCss(`${portableFontCss("studio")}@font-face{src:url(https://outside.test/font.woff2)}`,portableFontFiles("studio"))).toThrow();
    b.pages[0].sections.find(s=>s.id==="services")!.items[0].title="24-Hour Support";
    expect(Buffer.from(renderPortableSite(portableBundle(b),assets).files["index.html"]).toString()).toContain("24-Hour Support");
  });
  it("preserves approved typography, supports sparse assets and leaves legacy bundles on their existing fonts",()=>{
    const b=presentationFixture();b.presentation!.fontTheme="editorial";
    const sans=applyApprovedDesign(b,{...fixtureSitePlan,design:{...fixtureSitePlan.design,typography:"Bold sans-serif headings and readable sans-serif body"}});
    expect(sans.presentation?.fontTheme).toBe("studio");
    b.presentation!.fontTheme="technical";
    const serif=applyApprovedDesign(b,{...fixtureSitePlan,design:{...fixtureSitePlan.design,typography:"Editorial serif headlines with a clean sans-serif body"}});
    expect(serif.presentation?.fontTheme).toBe("editorial");
    const sparse=fixtureBlueprint("general");sparse.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[]};sparse.media=[];
    const sparseFiles=renderPortableSite(portableBundle(sparse),assets).files;expect(Buffer.from(sparseFiles["index.html"]).toString()).toContain('class="brand-wordmark"');
    const legacy=renderPortableSite(portableBundle(fixtureBlueprint()),assets).files;expect(Object.keys(legacy).some(key=>key.endsWith(".woff2"))).toBe(false);expect(Buffer.from(legacy["index.html"]).toString()).not.toContain("presentation-v1");
  });
  for(const family of designFamilyIds)it(`${family} presentation passes desktop/mobile readability and navigation checks`,async()=>{
    const b=presentationFixture(family);if(family==="trades"||family==="hospitality")b.composition="immersive";
    const {files}=renderPortableSite(portableBundle(b),assets),qa=await checkPortableSite({files,browser});
    for(const shot of qa.screenshots)await writeFile(path.join(output,`${family}-${shot.viewport}.png`),shot.bytes);
    expect(qa.issues).toEqual([]);expect(qa.passed).toBe(true);
  },60000);
  it("service tabs support keyboard navigation and keep every service readable without JavaScript",async()=>{
    const {files}=renderPortableSite(portableBundle(presentationFixture("professional")),assets);
    for(const javascript of [true,false]){
      const context=await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:javascript});
      try{
        await context.route("**/*",route=>{const key=new URL(route.request().url()).pathname.slice(1)||"index.html";return files[key]?route.fulfill({body:Buffer.from(files[key]),contentType:siteContentType(key)}):route.abort();});
        const page=await context.newPage();await page.goto("https://presentation.test/index.html");
        if(javascript){
          const tabs=page.getByRole("tab");await tabs.first().focus();await page.keyboard.press("ArrowDown");
          expect(await tabs.nth(1).getAttribute("aria-selected")).toBe("true");expect(await page.getByRole("tabpanel").count()).toBe(1);
          await page.keyboard.press("End");expect(await tabs.last().getAttribute("aria-selected")).toBe("true");
        }else{
          expect(await page.locator("[data-service-panel]:visible").count()).toBe(3);
          expect(await page.locator("[data-tab-list]:visible").count()).toBe(0);
        }
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
      }finally{await context.close();}
    }
  },30000);
  it.each([[320,"#087f8c"],[390,"#f3ad46"],[1440,"#087f8c"]] as const)("keeps text-only service tabs together with a readable selected accent at %ipx",async(width,accent)=>{
    const b=presentationFixture("professional");b.presentation!.sectionImages=[];b.media=b.media!.filter(media=>media.role==="logo");b.accent=accent;b.design!.palette.accent=accent;
    const {files}=renderPortableSite(portableBundle(b),assets),context=await browser.newContext({viewport:{width,height:900}});
    try{
      await context.route("**/*",route=>{const key=new URL(route.request().url()).pathname.slice(1)||"index.html";return files[key]?route.fulfill({body:Buffer.from(files[key]),contentType:siteContentType(key)}):route.abort();});
      const page=await context.newPage();await page.goto("https://presentation.test/index.html");await page.evaluate(()=>document.fonts.ready);
      const tabs=page.getByRole("tab");await tabs.first().focus();await page.keyboard.press("End");
      expect(await tabs.last().getAttribute("aria-selected")).toBe("true");expect(await page.getByRole("tabpanel").count()).toBe(1);
      const result=await page.evaluate(()=>{
        const tab=document.querySelector('[role="tab"][aria-selected="true"]')!,panel=document.querySelector('[role="tabpanel"]:not([hidden])')!,list=document.querySelector('[role="tablist"]')!;
        const hex=(value:string)=>"#"+value.match(/\d+/g)!.slice(0,3).map(value=>Number(value).toString(16).padStart(2,"0")).join("");
        return {ink:hex(getComputedStyle(tab).color),background:hex(getComputedStyle(tab).backgroundColor),gap:panel.querySelector("h3")!.getBoundingClientRect().top-list.getBoundingClientRect().bottom,padding:parseFloat(getComputedStyle(panel.querySelector(".item-body")!).paddingTop),overflow:document.documentElement.scrollWidth>innerWidth+2};
      });
      expect(result.background).toBe(accent);expect(contrastRatio(result.ink,result.background)).toBeGreaterThanOrEqual(4.5);
      expect(result.padding).toBe(0);if(width<=760){expect(result.gap).toBeGreaterThanOrEqual(0);expect(result.gap).toBeLessThanOrEqual(18);}
      expect(result.overflow).toBe(false);expect(await page.getByRole("tabpanel").locator(".service-link").getAttribute("href")).toBe("#contact");
      await page.keyboard.press("Home");expect(await tabs.first().getAttribute("aria-selected")).toBe("true");
    }finally{await context.close();}
  },30000);
  it("keeps a contact photo beside its form without overlap and handles a narrow screen and long name",async()=>{
    const b=presentationFixture("professional",true);
    b.presentation!.logoAssetId=null;b.media=b.media!.filter(m=>m.role!=="logo");
    b.brandName="AnUnusuallyLongIndependentConsultingBusinessName";
    b.pages[0].hero.headline="AReallyLongUnbrokenHeadlineThatMustStayWithinItsColumn";b.presentation!.heroEmphasis=null;
    b.pages[0].sections.push({id:"inquiry",kind:"contact",layout:"split",eyebrow:"Get in touch",title:"Start a conversation.",body:"Tell us what you have in mind.",items:[]});
    b.presentation!.sectionImages.push({pagePath:"index.html",sectionId:"inquiry",itemIndex:null,assetId:"hero"});
    b.interactions!.forms=[{pagePath:"index.html",sectionId:"inquiry",fields:["name","email","message"],submitLabel:"Preview inquiry"}];
    const {files}=renderPortableSite(portableBundle(b),assets);
    for(const width of [320,1440]){
      const context=await browser.newContext({viewport:{width,height:900}});
      try{
        await context.route("**/*",route=>{const key=new URL(route.request().url()).pathname.slice(1)||"index.html";return files[key]?route.fulfill({body:Buffer.from(files[key]),contentType:siteContentType(key)}):route.abort();});
        const page=await context.newPage();await page.goto("https://presentation.test/index.html");await page.evaluate(()=>document.fonts.ready);
        const result=await page.evaluate(()=>{
          const photo=document.querySelector("#inquiry .section-image")!.getBoundingClientRect(),form=document.querySelector("#inquiry form")!.getBoundingClientRect();
          return {overflow:document.documentElement.scrollWidth>innerWidth+2,overlap:Math.max(0,Math.min(photo.right,form.right)-Math.max(photo.left,form.left))*Math.max(0,Math.min(photo.bottom,form.bottom)-Math.max(photo.top,form.top))};
        });
        const overflowing=await page.evaluate(()=>[...document.querySelectorAll("body *")].filter(element=>element.getBoundingClientRect().right>innerWidth+2).slice(0,8).map(element=>({tag:element.tagName,class:element.className,width:element.getBoundingClientRect().width})));
        expect(result,JSON.stringify({width,overflowing})).toEqual({overflow:false,overlap:0});
      }finally{await context.close();}
    }
  },30000);
});
