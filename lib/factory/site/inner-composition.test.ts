import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {chromium,type Browser,type BrowserContext} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import sharp from "sharp";
import {factoryBenchmarkCases,benchmarkArtwork} from "./benchmark-fixtures";
import {preparePortableImages} from "./images";
import {renderPortableSite} from "./render";
import {portableBundle} from "./validate";
import {siteContentType,type SiteFiles} from "./artifacts";
import {checkPortableSite} from "./qa";
import type {SiteBlueprint} from "./types";

let browser:Browser;
const output=path.join(tmpdir(),"tailored-agents-inner-compositions");
beforeAll(async()=>{browser=await chromium.launch({headless:true});await mkdir(output,{recursive:true});});
afterAll(async()=>{await browser?.close();});

function readingFixture(sample=0):SiteBlueprint{
  const b=structuredClone(factoryBenchmarkCases()[sample].blueprint);
  const services=b.pages.find(page=>page.path==="services/index.html")!;
  services.sections[0].layout="spotlight";
  b.presentation!.sectionImages=b.presentation!.sectionImages.filter(binding=>binding.pagePath!==services.path);
  const about:SiteBlueprint["pages"][number]={path:"about/index.html",title:"About",description:"Understand the ideas that shape the proposed experience.",hero:{eyebrow:"Our perspective",headline:"Thoughtful details. A clear sense of purpose.",body:"Explore the priorities behind this concept and the kind of experience it sets out to create.",primaryCta:"Start an inquiry",secondaryCta:""},sections:[
    {id:"purpose",kind:"about",layout:"split",eyebrow:"The starting point",title:"An experience shaped around real life.",body:"A good starting point makes room for the way people actually live. This concept keeps everyday priorities in view, brings useful details to the foreground and offers a straightforward next step.",items:[]},
    {id:"care",kind:"about",layout:"band",eyebrow:"The small details",title:"Give the details the attention they deserve.",body:"Clear communication and a considered setting can make a simple interaction feel more useful. The proposed approach puts those qualities at the center, with room to adapt around each conversation.",items:[]},
    {id:"conversation",kind:"about",layout:"editorial",eyebrow:"An open conversation",title:"Start with the question on your mind.",body:"Share the context you already have and the outcome you would like to explore. A useful introduction does not need a polished brief; it needs enough detail to make the next conversation worthwhile.",items:[]},
    {id:"next-step",kind:"contact",layout:"band",eyebrow:"Your next step",title:"Bring your ideas into the conversation.",body:"Tell us what matters to you and how you would like to hear back.",items:[{title:"Start an inquiry",body:"Share a short outline of what you have in mind."}]},
  ]};
  b.pages.push(about);
  b.design!.sectionStyles.push({pagePath:about.path,sectionId:"purpose",tone:"surface"},{pagePath:about.path,sectionId:"care",tone:"contrast"});
  b.interactions!.actions.push({pagePath:about.path,sectionId:"next-step",itemIndex:0,label:"Start an inquiry",targetPage:"contact/index.html",targetSection:"inquiry"});
  return b;
}
async function render(b:SiteBlueprint){
  const assets:SiteFiles=await preparePortableImages(await sharp(Buffer.from(benchmarkArtwork(b.family))).png().toBuffer());
  for(const media of b.media||[])Object.assign(assets,await preparePortableImages(await sharp(Buffer.from(benchmarkArtwork(b.family,true))).png().toBuffer(),media.id));
  return renderPortableSite(portableBundle(b),assets).files;
}
async function serve(context:BrowserContext,files:SiteFiles){
  await context.route("**/*",route=>{const url=new URL(route.request().url()),key=url.pathname.slice(1)||"index.html";return url.origin==="https://inner-composition.test"&&files[key]?route.fulfill({body:Buffer.from(files[key]),contentType:siteContentType(key)}):route.abort();});
}

describe("Content-sized inner compositions",()=>{
  it.each([0,2,3])("keeps text-led sections useful and distinct for benchmark %i",async sample=>{
    const b=readingFixture(sample),original=structuredClone(b),files=await render(b),context=await browser.newContext();
    try{
      await serve(context,files);const page=await context.newPage();
      for(const width of [320,390,1440]){
        await page.setViewportSize({width,height:900});await page.goto("https://inner-composition.test/about/index.html");await page.evaluate(()=>document.fonts.ready);
        expect(await page.locator("h1").evaluate(element=>getComputedStyle(element).textShadow)).toBe("none");
        const sections=b.pages.at(-1)!.sections;
        for(const section of sections.slice(0,3)){
          const rendered=page.locator(`#${section.id}`);
          expect(await rendered.locator("h2").textContent()).toBe(section.title);expect(await rendered.locator(".section-copy").textContent()).toBe(section.body);
          const box=await rendered.evaluate(element=>{
            const title=element.querySelector("h2")!.getBoundingClientRect(),copy=element.querySelector(".section-copy")!.getBoundingClientRect();
            return {height:element.getBoundingClientRect().height,sideBySide:copy.left>=title.right,stacked:copy.top>=title.bottom,headingSize:parseFloat(getComputedStyle(element.querySelector("h2")!).fontSize),padding:parseFloat(getComputedStyle(element).paddingTop)};
          });
          expect(width>760?box.sideBySide:box.stacked).toBe(true);expect(box.headingSize).toBeLessThanOrEqual(width>760?42.4:37.6);
          if(width>760)expect(box.height).toBeLessThan(320);
          expect(box.padding).toBe(width>760?57:40);
        }
        const contact=page.locator("#next-step .contact-item");
        expect(await contact.getByRole("heading",{name:"Start an inquiry"}).count()).toBe(1);
        expect(await contact.getByRole("link",{name:"Start an inquiry"}).count()).toBe(1);
        expect(await contact.locator(".text-link").count()).toBe(0);
        await contact.getByRole("link",{name:"Start an inquiry"}).click();expect(new URL(page.url()).pathname).toBe("/contact/index.html");expect(new URL(page.url()).hash).toBe("#inquiry");
        await page.goto("https://inner-composition.test/about/index.html");
        expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)).toBe(false);
        if(width!==320)await writeFile(path.join(output,`${b.family}-about-${width}.png`),await page.screenshot({fullPage:true,animations:"disabled"}));
        await page.goto("https://inner-composition.test/services/index.html");await page.evaluate(()=>document.fonts.ready);
        const first=page.locator("#service-details .feature-item").first(),layout=await first.evaluate(element=>{
          const heading=element.querySelector("h3")!.getBoundingClientRect(),copy=element.querySelector("p")!.getBoundingClientRect();
          return {height:element.getBoundingClientRect().height,sideBySide:copy.left>=heading.right,stacked:copy.top>=heading.bottom};
        });
        expect(width>760?layout.sideBySide:layout.stacked).toBe(true);if(width>760)expect(layout.height).toBeLessThan(300);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)).toBe(false);
        if(width!==320)await writeFile(path.join(output,`${b.family}-services-${width}.png`),await page.screenshot({fullPage:true,animations:"disabled"}));
      }
      expect(b).toEqual(original);
    }finally{await context.close();}
  },60000);

  it("preserves explicit imagery, expressive statements, long readings, Home composition and selected density",async()=>{
    const b=readingFixture(),about=b.pages.at(-1)!;
    b.presentation!.sectionImages.push({pagePath:about.path,sectionId:"purpose",assetId:"detail",itemIndex:null});
    about.sections[1].kind="statement";
    about.sections[2].body=Array.from({length:7},()=>"A longer explanation gives the reader detailed context for the choices and considerations involved in shaping this proposed experience.").join(" ");
    for(const density of ["compact","airy"] as const){
      b.design!.density=density;const files=await render(b),context=await browser.newContext({viewport:{width:1440,height:900}});
      try{
        await serve(context,files);const page=await context.newPage();await page.goto("https://inner-composition.test/about/index.html");
        expect(await page.locator("#purpose.compact-content,#care.compact-content,#conversation.reading-section").count()).toBe(0);
        expect(await page.locator("#purpose .section-image").count()).toBe(1);
        expect(await page.locator("#conversation").evaluate(element=>parseFloat(getComputedStyle(element).paddingTop))).toBe(density==="compact"?56:96);
        await page.goto("https://inner-composition.test/services/index.html");expect(await page.locator("#service-details").evaluate(element=>parseFloat(getComputedStyle(element).paddingTop))).toBe(density==="compact"?42:72);
        await page.goto("https://inner-composition.test/index.html");expect(await page.locator(".compact-content,.reading-section").count()).toBe(0);
      }finally{await context.close();}
    }
    delete b.presentation;delete b.media;b.pages[0].sections[0].layout="grid";const legacy=Buffer.from((await render(b))[about.path]).toString();expect(legacy).not.toContain("compact-content");expect(legacy).not.toContain("contact-heading-link");
  },60000);

  it("passes full browser QA with an ink contact card and retains near-matching contact labels",async()=>{
    const b=readingFixture(),contact=b.pages.find(page=>page.title==="Contact")!;
    contact.sections.unshift({id:"direct",kind:"contact",layout:"split",eyebrow:"A direct conversation",title:"Choose a useful next step.",body:"Reach out with the question you would like to discuss.",items:[{title:"Call the team",body:"Describe the question on your mind."}]});
    b.interactions!.actions.push({pagePath:contact.path,sectionId:"direct",itemIndex:0,label:"Call Northline",targetPage:contact.path,targetSection:"inquiry"});
    b.design!.sectionStyles.push({pagePath:contact.path,sectionId:"inquiry",tone:"contrast"});
    const files=await render(b),html=Buffer.from(files[contact.path]).toString();expect(html).toContain("<h3>Call the team</h3>");expect(html).toContain("Call Northline <span");
    const qa=await checkPortableSite({files,browser});expect(qa.issues).toEqual([]);expect(qa.passed).toBe(true);
  },90000);
});
