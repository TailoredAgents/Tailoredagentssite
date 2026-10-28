import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {chromium,type Browser,type BrowserContext} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import sharp from "sharp";
import {fixtureBlueprint,fixtureHeroSvg,fixtureSitePlan} from "./fixtures";
import {preparePortableImages} from "./images";
import {renderPortableSite} from "./render";
import {portableBundle} from "./validate";
import {siteContentType,type SiteFiles} from "./artifacts";
import {applyApprovedDesign} from "./design";
import {checkPortableSite} from "./qa";
import type {SiteBlueprint} from "./types";

let browser:Browser,assets:SiteFiles;
const output=path.join(tmpdir(),"tailored-agents-contact-layout");
const contactPath="contact/index.html";
const expectedFields=["name","preferredContact","contactDetail","location","message"];

beforeAll(async()=>{
  browser=await chromium.launch({headless:true});
  await mkdir(output,{recursive:true});
  assets=await preparePortableImages(await sharp(Buffer.from(fixtureHeroSvg)).png().toBuffer());
},30000);
afterAll(async()=>{await browser?.close();});

function contactFixture():SiteBlueprint{
  const b=fixtureBlueprint("trades","split",true);
  b.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[]};
  b.media=[];
  b.contact={phone:"+16785550101",email:"team@example.test",address:null};
  b.pages.push({path:contactPath,title:"Contact",description:"Discuss your home-comfort questions and choose how to reach the team.",hero:{eyebrow:"Start a conversation",headline:"Let's talk about your home comfort.",body:"Call, email or preview an inquiry with the details you want to discuss.",primaryCta:"Call Northline",secondaryCta:"Preview inquiry"},sections:[
    {id:"direct-contact",kind:"contact",layout:"split",eyebrow:"Reach the team",title:"Choose the way that works for you.",body:"Use a direct channel to discuss your question.",items:[{title:"Talk by phone",body:"Describe what you have noticed and the next step you have in mind."},{title:"Send an email",body:"Share a short outline of your question with the team."}]},
    {id:"inquiry",kind:"contact",layout:"split",eyebrow:"A useful starting point",title:"Preview your inquiry.",body:"Add your preferred contact method, location and service concern.",items:[]},
  ]});
  b.interactions={version:1,forms:[{pagePath:contactPath,sectionId:"inquiry",fields:["name","preferredContact","contactDetail","location","message"],submitLabel:"Preview inquiry"}],actions:[
    {pagePath:contactPath,sectionId:"direct-contact",itemIndex:0,label:"Call Northline",targetPage:contactPath,targetSection:"direct-contact"},
    {pagePath:contactPath,sectionId:"direct-contact",itemIndex:1,label:"Email Northline",targetPage:contactPath,targetSection:"direct-contact"},
  ]};
  return b;
}

async function serve(context:BrowserContext,files:SiteFiles){
  const outside:string[]=[];
  await context.route("**/*",route=>{
    const url=new URL(route.request().url()),key=url.pathname.slice(1)||"index.html";
    if(url.origin==="https://contact-layout.test"&&files[key])return route.fulfill({body:Buffer.from(files[key]),contentType:siteContentType(key)});
    outside.push(route.request().url());return route.abort();
  });
  return outside;
}

function closingAndCoverageFixture(){
  const b=contactFixture();
  for(const page of b.pages.filter(page=>page.path!==contactPath)){
    page.sections.push({id:"next-step",kind:"contact",layout:"band",eyebrow:"Your next step",title:"Talk about the next step for your home.",body:"Share your question and choose a useful starting point for the conversation.",items:[{title:"Preview an inquiry",body:"Include your preferred contact method, city or ZIP code and a short description of the concern."}]});
    b.interactions!.actions.push({pagePath:page.path,sectionId:"next-step",itemIndex:0,label:"Preview inquiry",targetPage:contactPath,targetSection:"inquiry"});
  }
  b.pages.push({path:"areas/index.html",title:"Service Areas",description:"Share your location when asking about service coverage.",hero:{eyebrow:"Location matters",headline:"Start with your city or ZIP code.",body:"Use your location to begin a conversation about coverage and the help you are looking for.",primaryCta:"Preview coverage inquiry",secondaryCta:"Call Northline"},sections:[
    {id:"area-story",kind:"statement",layout:"editorial",eyebrow:"A useful conversation",title:"A little context helps start the conversation.",body:"Share the concern you want to discuss and the location of the property.",items:[]},
    {id:"area-context",kind:"statement",layout:"editorial",eyebrow:"Before your inquiry",title:"A clear location helps the team understand your question.",body:"Provide your city or ZIP code and mention any access details that may affect a visit. Coverage and available services are discussed directly with the business.",items:[]},
    {id:"coverage-inquiry",kind:"contact",layout:"split",eyebrow:"Your location",title:"Preview your coverage inquiry.",body:"Include your city or ZIP code, a short service concern and how you would prefer to hear back.",items:[]},
  ]});
  b.interactions!.forms.push({pagePath:"areas/index.html",sectionId:"coverage-inquiry",fields:["location","message","preferredContact","contactDetail"],submitLabel:"Preview coverage inquiry"});
  return applyApprovedDesign(b,{...fixtureSitePlan,design:{...fixtureSitePlan.design,typography:"Bold sans-serif headings and readable sans-serif body",palette:["Background: #F5F7F8","Surface: #FFFFFF","Ink: #142B40","Muted: #52616B","Accent: #087F8C","Secondary accent: #F3AD46"]}});
}

describe("Compact dedicated contact pages",()=>{
  it.each([320,390,1440])("keeps direct channels and the five-field inquiry compact and usable at %ipx",async width=>{
    const b=contactFixture(),original=structuredClone(b),{files}=renderPortableSite(portableBundle(b),assets);
    const context=await browser.newContext({viewport:{width,height:900}});
    try{
      const outside=await serve(context,files),page=await context.newPage();
      await page.goto(`https://contact-layout.test/${contactPath}`);await page.evaluate(()=>document.fonts.ready);
      expect(await page.locator(".contact-composition").count()).toBe(1);
      expect(await page.locator(".contact-composition > #direct-contact").count()).toBe(1);
      expect(await page.locator(".contact-composition > #inquiry").count()).toBe(1);
      for(const section of b.pages.at(-1)!.sections){
        expect(await page.locator(`#${section.id}`).count()).toBe(1);
        expect(await page.locator(`#${section.id}-heading`).textContent()).toBe(section.title);
        expect(await page.locator(`#${section.id} .section-copy`).textContent()).toBe(section.body);
      }
      expect(await page.locator("#direct-contact .contact-item h3").allTextContents()).toEqual(["Talk by phone","Send an email"]);
      expect(await page.locator("#inquiry form [name]").evaluateAll(elements=>elements.map(element=>element.getAttribute("name")))).toEqual(expectedFields);
      expect(await page.locator("main form").count()).toBe(1);
      expect(await page.locator('main a[href="tel:+16785550101"]').count()).toBe(1);
      expect(await page.locator('main a[href="mailto:team@example.test"]').count()).toBe(1);
      expect(await page.locator(".site-hero .hero-index,.site-hero .hero-actions a,.mobile-contact").count()).toBe(0);
      expect(await page.getByRole("navigation",{name:"Primary navigation",exact:true,includeHidden:true}).count()).toBe(1);
      expect(await page.getByRole("navigation",{name:"Footer navigation",exact:true}).count()).toBe(1);

      const layout=await page.evaluate(()=>{
        const direct=document.getElementById("direct-contact")!.getBoundingClientRect(),inquiry=document.getElementById("inquiry")!.getBoundingClientRect(),input=document.querySelector("#inquiry input")!.getBoundingClientRect();
        return {overflow:document.documentElement.scrollWidth>innerWidth+2,sideBySide:inquiry.left>=direct.right-1,stacked:inquiry.top>=direct.bottom-1,firstInputTop:input.top+scrollY,inputWidth:input.width,overlap:Math.max(0,Math.min(direct.right,inquiry.right)-Math.max(direct.left,inquiry.left))*Math.max(0,Math.min(direct.bottom,inquiry.bottom)-Math.max(direct.top,inquiry.top))};
      });
      expect(layout.overflow).toBe(false);expect(layout.overlap).toBe(0);
      if(width>760)expect(layout.sideBySide).toBe(true);else {expect(layout.stacked).toBe(true);expect(layout.inputWidth).toBeGreaterThanOrEqual(width-90);}
      expect(layout.firstInputTop).toBeLessThanOrEqual(width>760?800:1400);
      await writeFile(path.join(output,`contact-${width}.png`),await page.screenshot({fullPage:true,animations:"disabled"}));

      // Existing incoming links still reach the same original section/form.
      await page.getByRole("navigation",{name:"Footer navigation",exact:true}).getByRole("link",{name:"Contact",exact:true}).click();
      await page.goto(`https://contact-layout.test/${contactPath}#inquiry`);
      expect(new URL(page.url()).hash).toBe("#inquiry");
      expect(await page.locator("#inquiry form").isVisible()).toBe(true);
      expect(b).toEqual(original);expect(outside).toEqual([]);
    }finally{await context.close();}
  },30000);

  it("preserves selected contact validation and honest no-send/no-store form behavior",async()=>{
    const {files}=renderPortableSite(portableBundle(contactFixture()),assets),context=await browser.newContext({viewport:{width:390,height:844}});
    try{
      const outside=await serve(context,files),page=await context.newPage();await page.goto(`https://contact-layout.test/${contactPath}`);
      const form=page.locator("#inquiry form"),detail=form.getByLabel("Contact detail",{exact:true});
      expect(await form.getByText("Demo only—nothing is sent or stored.",{exact:true}).count()).toBe(1);
      await form.getByLabel("Your name",{exact:true}).fill("Preview visitor");
      await detail.fill("not-an-email");
      expect(await detail.evaluate((element:HTMLInputElement)=>element.checkValidity())).toBe(false);
      await form.locator('[name="preferredContact"]').selectOption("phone");
      expect(await detail.getAttribute("type")).toBe("tel");
      await detail.fill("(555) 555-0123");await form.getByLabel("City or ZIP code",{exact:true}).fill("30000");await form.getByLabel("Service concern",{exact:true}).fill("Synthetic inquiry for browser verification.");
      expect(await detail.evaluate((element:HTMLInputElement)=>element.checkValidity())).toBe(true);
      await form.getByRole("button",{name:"Preview inquiry"}).click();
      expect(await form.locator("[data-demo-feedback]").isVisible()).toBe(true);
      expect(await form.locator("[data-demo-feedback]").textContent()).toContain("Your message was not sent or stored.");
      expect(new URL(page.url()).pathname).toBe(`/${contactPath}`);expect(outside).toEqual([]);
      expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
    }finally{await context.close();}
  },30000);

  it("retains a useful non-contact hero action alongside the compact composition",async()=>{
    const b=contactFixture();b.pages.at(-1)!.hero.primaryCta="Explore our services";b.pages.at(-1)!.hero.secondaryCta="Call Northline";
    const {files}=renderPortableSite(portableBundle(b),assets),context=await browser.newContext({viewport:{width:1440,height:900}});
    try{
      await serve(context,files);const page=await context.newPage();await page.goto(`https://contact-layout.test/${contactPath}`);
      expect(await page.locator(".contact-composition").count()).toBe(1);
      expect(await page.locator(".site-hero .hero-actions a").count()).toBe(1);
      await page.locator(".site-hero").getByRole("link",{name:"Explore our services"}).click();
      expect(new URL(page.url()).pathname).toBe("/services/index.html");
    }finally{await context.close();}
  },30000);

  it("passes complete browser QA with approved design tokens and includes the contact composition in review crops",async()=>{
    const fixture=contactFixture();fixture.design!.density="compact";fixture.design!.typography.scale="expressive";
    fixture.design!.sectionStyles=[{pagePath:contactPath,sectionId:"direct-contact",tone:"base"},{pagePath:contactPath,sectionId:"inquiry",tone:"surface"}];
    const b=applyApprovedDesign(fixture,{...fixtureSitePlan,pages:fixture.pages.map(page=>({title:page.title,purpose:page.description,sections:page.sections.map(section=>section.title)})),design:{...fixtureSitePlan.design,direction:"A clear home-comfort concept with a compact Contact page.",typography:"Bold sans-serif headings and readable sans-serif body",palette:["Background: #F5F7F8","Surface: #FFFFFF","Ink: #142B40","Muted: #52616B","Accent: #087F8C","Secondary accent: #F3AD46"]}});
    expect(b.presentation?.fontTheme).toBe("studio");
    const {files}=renderPortableSite(portableBundle(b),assets),qa=await checkPortableSite({files,browser});
    expect(qa.issues).toEqual([]);expect(qa.passed).toBe(true);
    expect(qa.screenshots.map(shot=>`${shot.page}:${shot.viewport}`).sort()).toEqual(b.pages.flatMap(page=>[`${page.path}:desktop`,`${page.path}:mobile`]).sort());
    for(const viewport of ["desktop","mobile"] as const){
      const shot=qa.screenshots.find(shot=>shot.page===contactPath&&shot.viewport===viewport)!;
      // Review the combined composition, while keeping both nested sections
      // addressable for targeted screenshot-aware draft corrections.
      expect(shot.regions).toHaveLength(4);
      const composition=shot.regions!.find(region=>region.id==="contact-composition")!;
      expect(composition.top).toBeGreaterThan(shot.regions![0].top);
      expect(composition.height).toBeGreaterThan(500);
      for(const id of ["direct-contact","inquiry"]){
        const section=shot.regions!.find(region=>region.id===id)!;
        expect(section).toBeDefined();
        expect(section.top).toBeGreaterThanOrEqual(composition.top);
        expect(section.top+section.height).toBeLessThanOrEqual(composition.top+composition.height+1);
      }
      await writeFile(path.join(output,`contact-approved-${viewport}.png`),shot.bytes);
    }
  },60000);

  it.each(["nonadjacent","image-bound","legacy","another page"] as const)("keeps %s contact sections on their existing layout",variation=>{
    const b=contactFixture(),contact=b.pages.at(-1)!;
    if(variation==="nonadjacent")contact.sections.splice(1,0,{id:"before-inquiry",kind:"statement",layout:"rows",eyebrow:"Useful context",title:"Bring your questions.",body:"A brief outline helps frame a first conversation.",items:[]});
    if(variation==="image-bound")b.presentation!.sectionImages=[{pagePath:contactPath,sectionId:"direct-contact",assetId:"hero",itemIndex:null}];
    if(variation==="legacy")delete b.presentation;
    if(variation==="another page"){
      contact.title="Coverage";contact.path="coverage/index.html";
      b.interactions!.forms.forEach(form=>{form.pagePath=contact.path;});
      b.interactions!.actions.forEach(action=>{action.pagePath=contact.path;action.targetPage=contact.path;});
    }
    const html=Buffer.from(renderPortableSite(portableBundle(b),assets).files[contact.path]).toString();
    expect(html).not.toContain('class="contact-composition"');
    expect(html).toContain('id="direct-contact"');expect(html).toContain('id="inquiry"');
    expect(html).toContain('name="preferredContact"');expect(html).toContain('name="contactDetail"');
    if(variation==="legacy")expect(html).toContain('class="hero-index"');
    if(variation==="image-bound")expect(html).toContain('class="story-image section-image"');
  });

  it.each([320,390,1440])("balances direct-only closing bands and compact coverage forms at %ipx without removing copy",async width=>{
    const b=closingAndCoverageFixture(),original=structuredClone(b),{files}=renderPortableSite(portableBundle(b),assets),context=await browser.newContext({viewport:{width,height:900}});
    try{
      await serve(context,files);const page=await context.newPage();
      for(const route of b.pages.filter(route=>![contactPath,"areas/index.html"].includes(route.path))){
        await page.goto(`https://contact-layout.test/${route.path}`);await page.evaluate(()=>document.fonts.ready);
        const section=page.locator("#next-step");
        expect(await section.getAttribute("class")).toContain("contact-closing");
        expect(await section.locator("h2").textContent()).toBe(route.sections.at(-1)!.title);
        expect(await section.locator(".section-copy").textContent()).toBe(route.sections.at(-1)!.body);
        expect(await section.locator(".contact-item p").textContent()).toBe(route.sections.at(-1)!.items[0].body);
        const boxes=await section.evaluate(element=>{
          const heading=element.querySelector(".section-heading")!.getBoundingClientRect(),details=element.querySelector(".contact-details")!.getBoundingClientRect();
          return {sideBySide:details.left>=heading.right-1,stacked:details.top>=heading.bottom-1,overflow:document.documentElement.scrollWidth>innerWidth+2,height:element.getBoundingClientRect().height};
        });
        expect(boxes.overflow).toBe(false);expect(width>760?boxes.sideBySide:boxes.stacked).toBe(true);
        if(width>760)expect(boxes.height).toBeLessThan(450);
        if(route.path==="index.html"){
          expect(await page.locator(".site-hero .hero-image").count()).toBe(1);expect(await page.locator(".site-hero .hero-index").count()).toBe(1);
          await writeFile(path.join(output,`closing-${width}.png`),await section.screenshot({animations:"disabled"}));
        }
        await section.getByRole("link",{name:"Preview inquiry"}).click();
        expect(new URL(page.url()).pathname).toBe(`/${contactPath}`);expect(new URL(page.url()).hash).toBe("#inquiry");
      }
      await page.goto("https://contact-layout.test/areas/index.html");await page.evaluate(()=>document.fonts.ready);
      expect(await page.locator(".inquiry-context").count()).toBe(1);expect(await page.locator("#area-context.inquiry-context").count()).toBe(1);
      expect(await page.locator("#coverage-inquiry.compact-inquiry").count()).toBe(1);
      expect(await page.locator("body.brief-inquiry-page").count()).toBe(1);
      expect(await page.locator("#coverage-inquiry form [name]").evaluateAll(elements=>elements.map(element=>element.getAttribute("name")))).toEqual(["location","message","preferredContact","contactDetail"]);
      const areas=b.pages.at(-1)!;
      for(const section of areas.sections){expect(await page.locator(`#${section.id} .section-copy`).textContent()).toBe(section.body);expect(await page.locator(`#${section.id}-heading`).textContent()).toBe(section.title);}
      expect(await page.locator("#area-context h2").evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(width>760?44.8:31);
      const compact=await page.locator("#coverage-inquiry").evaluate(element=>{
        const heading=element.querySelector(".section-heading")!.getBoundingClientRect(),details=element.querySelector(".contact-details")!.getBoundingClientRect();
        return {channelGap:details.top-heading.bottom,headingSize:parseFloat(getComputedStyle(element.querySelector("h2")!).fontSize)};
      });
      expect(compact.channelGap).toBeGreaterThanOrEqual(0);expect(compact.channelGap).toBeLessThanOrEqual(30);
      expect(compact.headingSize).toBeLessThanOrEqual(width>760?33.6:27.2);
      expect(await page.locator(".hero-copy h1").evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(width>760?42.4:38.4);
      // Longer approved headings may wrap; constrain decorative space, not content height.
      expect(await page.locator("#area-context").evaluate(element=>parseFloat(getComputedStyle(element).paddingTop))).toBeLessThanOrEqual(width>760?31:25);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)).toBe(false);
      await writeFile(path.join(output,`coverage-${width}.png`),await page.screenshot({fullPage:true,animations:"disabled"}));
      expect(b).toEqual(original);
    }finally{await context.close();}
  },30000);

  it("passes accessibility and full browser QA for closing bands and the coverage inquiry",async()=>{
    const b=closingAndCoverageFixture(),{files}=renderPortableSite(portableBundle(b),assets),qa=await checkPortableSite({files,browser});
    expect(qa.issues).toEqual([]);expect(qa.passed).toBe(true);expect(qa.screenshots).toHaveLength(b.pages.length*2);
  },60000);

  it("balances automatic direct channels and keeps explicit sparse closing copy without inventing forms",async()=>{
    for(const fallback of [true,false]){
      const b=fixtureBlueprint("trades","split");b.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[]};
      if(fallback)b.contact={phone:"+16785550101",email:"team@example.test",address:null};
      else b.pages[0].sections.push({id:"next-step",kind:"contact",layout:"split",eyebrow:"An open conversation",title:"A good starting point.",body:"Bring your questions when the business shares its preferred contact details.",items:[]});
      const {files}=renderPortableSite(portableBundle(b),assets),context=await browser.newContext({viewport:{width:1440,height:900}});
      try{
        await serve(context,files);const page=await context.newPage();await page.goto("https://contact-layout.test/index.html");
        const closing=page.locator(".contact-closing");expect(await closing.count()).toBe(1);
        expect(await page.locator("main .section-contact").count()).toBe(1);expect(await page.locator("main form").count()).toBe(0);
        expect(await closing.locator(".section-inner").evaluate(element=>getComputedStyle(element).display)).toBe(fallback?"grid":"block");
        expect(await closing.locator('a[href^="tel:"]').count()).toBe(fallback?1:0);expect(await closing.locator('a[href^="mailto:"]').count()).toBe(fallback?1:0);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)).toBe(false);
      }finally{await context.close();}
      delete b.presentation;
      expect(Buffer.from(renderPortableSite(portableBundle(b),assets).files["index.html"]).toString()).not.toContain("contact-closing");
    }
  },30000);

  it("preserves explicit section imagery and legacy layouts around inquiry sections",()=>{
    const b=closingAndCoverageFixture();
    b.presentation!.sectionImages=[{pagePath:"index.html",sectionId:"next-step",assetId:"hero",itemIndex:null},{pagePath:"areas/index.html",sectionId:"area-context",assetId:"hero",itemIndex:null},{pagePath:"areas/index.html",sectionId:"coverage-inquiry",assetId:"hero",itemIndex:null}];
    b.presentation!.pageImages=[{pagePath:"areas/index.html",assetId:"hero"}];
    const {files}=renderPortableSite(portableBundle(b),assets),home=Buffer.from(files["index.html"]).toString(),areas=Buffer.from(files["areas/index.html"]).toString();
    expect(home).not.toContain("contact-closing");expect(areas).not.toContain("inquiry-context");expect(areas).not.toContain("compact-inquiry");expect(areas).toContain('class="hero-image"');
    delete b.presentation;
    const legacy=renderPortableSite(portableBundle(b),assets).files;
    expect(Buffer.from(legacy["index.html"]).toString()).not.toContain("contact-closing");expect(Buffer.from(legacy["areas/index.html"]).toString()).not.toContain("compact-inquiry");
  });

  it.each(["long context","section imagery","hero imagery","multiple forms","legacy"] as const)("does not simplify %s into a brief inquiry page",variation=>{
    const b=closingAndCoverageFixture(),areas=b.pages.at(-1)!;
    if(variation==="long context")areas.sections[0].body=Array.from({length:65},()=>"Context").join(" ");
    if(variation==="section imagery")b.presentation!.sectionImages.push({pagePath:areas.path,sectionId:"area-story",assetId:"hero",itemIndex:null});
    if(variation==="hero imagery")b.presentation!.pageImages.push({pagePath:areas.path,assetId:"hero"});
    if(variation==="multiple forms"){
      areas.sections[0].kind="contact";
      b.interactions!.forms.push({pagePath:areas.path,sectionId:"area-story",fields:["email","message"],submitLabel:"Preview second inquiry"});
    }
    if(variation==="legacy")delete b.presentation;
    const original=structuredClone(b),{files}=renderPortableSite(portableBundle(b),assets);
    expect(Buffer.from(files[areas.path]).toString()).not.toContain("brief-inquiry-page");
    expect(Buffer.from(files["index.html"]).toString()).not.toContain("brief-inquiry-page");
    expect(b).toEqual(original);
  });
});
