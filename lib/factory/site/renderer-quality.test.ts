import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {chromium,type Browser,type BrowserContext} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import sharp from "sharp";
import {factoryBenchmarkCases,benchmarkArtwork} from "./benchmark-fixtures";
import {preparePortableImages} from "./images";
import {renderPortableSite,siteActionTarget} from "./render";
import {portableBundle} from "./validate";
import {siteContentType,type SiteFiles} from "./artifacts";
import type {SiteBlueprint} from "./types";

let browser:Browser;
const output=path.join(tmpdir(),"ta-factory-render-quality-20261028");
const assets=new Map<string,SiteFiles>();
beforeAll(async()=>{browser=await chromium.launch({headless:true});await mkdir(output,{recursive:true});},30000);
afterAll(async()=>{await browser?.close();});
async function render(b:SiteBlueprint){
  if(!assets.has(b.family)){
    const result=await preparePortableImages(await sharp(Buffer.from(benchmarkArtwork(b.family))).png().toBuffer());
    Object.assign(result,await preparePortableImages(await sharp(Buffer.from(benchmarkArtwork(b.family,true))).png().toBuffer(),"detail"));
    assets.set(b.family,result);
  }
  return renderPortableSite(portableBundle(b),assets.get(b.family)!).files;
}
async function serve(context:BrowserContext,files:SiteFiles){
  const outside:string[]=[];
  await context.route("**/*",route=>{
    const url=new URL(route.request().url()),key=url.pathname.slice(1)||"index.html";
    if(url.origin==="https://renderer-quality.test"&&files[key])return route.fulfill({body:Buffer.from(files[key]),contentType:siteContentType(key)});
    outside.push(route.request().url());return route.abort();
  });
  return outside;
}

describe("Observed renderer quality regressions",()=>{
  it.each([390,1440])("uses the approved inquiry route in an automatic closing band at %ipx",async width=>{
    const b=factoryBenchmarkCases().find(sample=>sample.id==="wellness-small-practice")!.blueprint,original=structuredClone(b);
    const files=await render(b),context=await browser.newContext({viewport:{width,height:900}});
    try{
      const outside=await serve(context,files),page=await context.newPage();
      for(const route of ["index.html","services/index.html"]){
        await page.goto(`https://renderer-quality.test/${route}`);await page.evaluate(()=>document.fonts.ready);
        const closing=page.locator("#contact.contact-closing"),link=closing.getByRole("link",{name:"Preview inquiry"});
        expect(await closing.count()).toBe(1);expect(await closing.locator("form").count()).toBe(0);
        await closing.screenshot({path:path.join(output,`closing-${route.startsWith("services")?"inner":"home"}-${width}.png`),animations:"disabled"});
        await link.click();expect(new URL(page.url()).pathname).toBe("/contact/index.html");expect(new URL(page.url()).hash).toBe("#inquiry");
        expect(await page.locator("#inquiry form").isVisible()).toBe(true);
      }
      expect(outside).toEqual([]);expect(b).toEqual(original);
    }finally{await context.close();}
  },30000);

  it.each([320,390,1440])("keeps the sole Contact form reachable without duplicate shortcuts at %ipx",async width=>{
    const b=factoryBenchmarkCases().find(sample=>sample.id==="professional-services")!.blueprint,original=structuredClone(b),files=await render(b);
    const context=await browser.newContext({viewport:{width,height:900}});
    try{
      const outside=await serve(context,files),page=await context.newPage();await page.goto("https://renderer-quality.test/contact/index.html");await page.evaluate(()=>document.fonts.ready);
      expect(await page.locator(".hero-actions,.mobile-contact,#contact").count()).toBe(0);
      expect(await page.locator("main form").count()).toBe(1);
      expect(await page.locator("#inquiry h2").textContent()).toBe(b.pages[2].sections[0].title);
      expect(await page.locator("#inquiry .section-copy").textContent()).toBe(b.pages[2].sections[0].body);
      expect(await page.locator("#inquiry form [name]").evaluateAll(elements=>elements.map(element=>element.getAttribute("name")))).toEqual(["name","preferredContact","contactDetail","message"]);
      const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,inputTop:document.querySelector("#inquiry input")!.getBoundingClientRect().top+scrollY}));
      expect(geometry.overflow).toBe(false);expect(geometry.inputTop).toBeLessThan(width>760?650:1000);
      await writeFile(path.join(output,`single-contact-${width}.png`),await page.screenshot({fullPage:true,animations:"disabled"}));
      await page.getByLabel("Your name",{exact:true}).fill("Synthetic visitor");
      await page.getByLabel("Contact detail",{exact:true}).fill("visitor@example.test");await page.getByLabel("Service concern",{exact:true}).fill("A browser-only demonstration.");
      await page.getByRole("button",{name:"Preview inquiry"}).click();
      expect(await page.locator("[data-demo-feedback]").textContent()).toContain("Your message was not sent or stored.");
      expect(outside).toEqual([]);expect(b).toEqual(original);
    }finally{await context.close();}
  },30000);

  it.each([390,1440])("keeps sparse exploration useful without invented contact controls at %ipx",async width=>{
    const b=factoryBenchmarkCases().find(sample=>sample.id==="sparse-new-business")!.blueprint,original=structuredClone(b),files=await render(b);
    const context=await browser.newContext({viewport:{width,height:900}});
    try{
      await serve(context,files);const page=await context.newPage();await page.goto("https://renderer-quality.test/index.html");await page.evaluate(()=>document.fonts.ready);
      expect(await page.locator("#contact,.nav-contact,.mobile-contact,form").count()).toBe(0);
      const action=page.getByRole("link",{name:"Explore the concept"});expect(await action.getAttribute("href")).toBe("#introduction");
      await writeFile(path.join(output,`sparse-${width}.png`),await page.screenshot({fullPage:true,animations:"disabled"}));
      await action.click();expect(new URL(page.url()).hash).toBe("#introduction");
      expect(await page.locator("#introduction h2").textContent()).toBe(b.pages[0].sections[0].title);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)).toBe(false);expect(b).toEqual(original);
    }finally{await context.close();}
  },30000);

  it("does not silently retarget unsupported contact promises and preserves explicit section actions",async()=>{
    const b=factoryBenchmarkCases().find(sample=>sample.id==="sparse-new-business")!.blueprint;
    for(const label of ["Contact us","Book a meeting","Book now","Booking options","Ready to book?","Call the team","Email us","Start a conversation"]){
      b.pages[0].hero.primaryCta=label;
      const html=Buffer.from((await render(b))["index.html"]).toString();expect(html).not.toContain(`>${label}<span`);
    }
    b.interactions!.actions=[{pagePath:"index.html",sectionId:"direction",itemIndex:0,label:"Explore the introduction",targetPage:"index.html",targetSection:"introduction"}];
    const html=Buffer.from((await render(b))["index.html"]).toString();expect(html).toContain('href="index.html#introduction">Explore the introduction');
    delete b.presentation;
    const legacy=Buffer.from((await render(b))["index.html"]).toString();expect(legacy).toContain('id="contact"');expect(legacy).toContain('class="nav-contact"');
  },30000);

  it("preserves bookkeeping and book-content actions instead of interpreting them as appointment requests",async()=>{
    const b=factoryBenchmarkCases().find(sample=>sample.id==="sparse-new-business")!.blueprint;
    b.pages.push({...structuredClone(b.pages[0]),path:"services/index.html",title:"Services"});
    b.pages[0].hero.primaryCta="Explore bookkeeping services";
    let html=Buffer.from((await render(b))["index.html"]).toString();
    expect(html).toContain('href="services/index.html">Explore bookkeeping services<span');
    b.pages[0].hero.primaryCta="Read our book";
    html=Buffer.from((await render(b))["index.html"]).toString();
    expect(html).toContain('href="#introduction">Read our book<span');
    expect(siteActionTarget("Read our book",b,b.pages[0],"#introduction")).toBe("#introduction");
    b.pages[0].sections.push({id:"inquiry",kind:"contact",layout:"band",eyebrow:"Next step",title:"Arrange a conversation",body:"Try the demonstration inquiry.",items:[]});
    b.interactions!.forms=[{pagePath:"index.html",sectionId:"inquiry",fields:["message"],submitLabel:"Preview inquiry"}];
    for(const label of ["Book a meeting","Book now","Booking options","Ready to book?","Start a conversation"])
      expect(siteActionTarget(label,b,b.pages[0],"#introduction")).toBe("#inquiry");
    expect(siteActionTarget("Explore bookkeeping services",b,b.pages[0],"#introduction")).toBe("services/index.html");
    expect(siteActionTarget("Read our book",b,b.pages[0],"#introduction")).toBe("#introduction");
  },30000);

  it.each([320,390,1440])("keeps framed text-only inner copy inside its border at %ipx",async width=>{
    const b=factoryBenchmarkCases().find(sample=>sample.id==="wellness-small-practice")!.blueprint,files=await render(b);
    const context=await browser.newContext({viewport:{width,height:900}});
    try{
      await serve(context,files);const page=await context.newPage();
      for(const route of ["services/index.html","contact/index.html"]){
        await page.goto(`https://renderer-quality.test/${route}`);await page.evaluate(()=>document.fonts.ready);
        const geometry=await page.locator(".hero-inner").evaluate(element=>{
          const frame=element.getBoundingClientRect(),copy=element.querySelector(".hero-copy")!.getBoundingClientRect();
          return {left:copy.left-frame.left,right:frame.right-copy.right,top:copy.top-frame.top,bottom:frame.bottom-copy.bottom,overflow:document.documentElement.scrollWidth>innerWidth+2};
        });
        expect(geometry.left).toBeGreaterThanOrEqual(20);expect(geometry.right).toBeGreaterThanOrEqual(20);expect(geometry.top).toBeGreaterThanOrEqual(20);expect(geometry.bottom).toBeGreaterThanOrEqual(20);expect(geometry.overflow).toBe(false);
        expect(await page.locator(".hero-image").count()).toBe(0);
        await page.locator(".site-hero").screenshot({path:path.join(output,`framed-${route.startsWith("services")?"services":"contact"}-${width}.png`),animations:"disabled"});
      }
    }finally{await context.close();}
  },30000);

  it.each([390,768,1440])("balances an image-backed spotlight without changing its content at %ipx",async width=>{
    const b=factoryBenchmarkCases().find(sample=>sample.id==="professional-services")!.blueprint,original=structuredClone(b),files=await render(b);
    const context=await browser.newContext({viewport:{width,height:900}});
    try{
      const outside=await serve(context,files),page=await context.newPage();await page.goto("https://renderer-quality.test/index.html");await page.evaluate(()=>document.fonts.ready);
      const items=page.locator("#services .feature-item");expect(await items.locator("h3").allTextContents()).toEqual(b.pages[0].sections[0].items.map(item=>item.title));
      expect(await items.locator(".item-body p").allTextContents()).toEqual(b.pages[0].sections[0].items.map(item=>item.body));
      const geometry=await items.first().evaluate(element=>{
        const image=element.querySelector(".item-image")!.getBoundingClientRect(),copy=element.querySelector(".item-body")!.getBoundingClientRect(),card=element.getBoundingClientRect();
        return {imageWidth:image.width,cardWidth:card.width,cardHeight:card.height,sideBySide:copy.left>=image.right,stacked:copy.top>=image.bottom,overflow:document.documentElement.scrollWidth>innerWidth+2};
      });
      expect(geometry.overflow).toBe(false);
      if(width>760){expect(geometry.sideBySide).toBe(true);expect(geometry.imageWidth).toBeLessThan(geometry.cardWidth*.5);expect(geometry.cardHeight).toBeLessThan(600);}
      else expect(geometry.stacked).toBe(true);
      await page.locator("#services").screenshot({path:path.join(output,`spotlight-${width}.png`),animations:"disabled"});
      await items.first().getByRole("link",{name:"Explore this service"}).click();expect(new URL(page.url()).pathname).toBe("/services/index.html");expect(new URL(page.url()).hash).toBe("#service-details");
      expect(outside).toEqual([]);expect(b).toEqual(original);
    }finally{await context.close();}
  },30000);
});
