import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {chromium,type Browser} from "playwright";
import sharp from "sharp";
import {fixtureBlueprint,fixtureHeroSvg} from "./fixtures";
import {validateBlueprintStructure,siteGenerationSchema,portableBundle} from "./validate";
import {renderPortableSite} from "./render";
import {assertPortableSiteSafety} from "./safety";
import {checkPortableSite} from "./qa";
import {siteContentType} from "./artifacts";
import {publicSiteCopy} from "./quality";
import {contrastRatio} from "./design";

const fixture=()=>{
  const b=fixtureBlueprint("trades","split",true);
  const contact={id:"inquiry",kind:"contact" as const,layout:"split" as const,eyebrow:"Contact",title:"Start an inquiry",body:"Try the demonstration below.",items:[]};
  b.pages.push({...structuredClone(b.pages[1]),path:"contact/index.html",title:"Contact",sections:[contact]});
  b.pages[1].sections.push({...contact,id:"coverage"});
  b.pages[0].sections.push({...contact,id:"contact",body:"Use the contact page to make an inquiry."});
  b.interactions={version:1,forms:[
    {pagePath:"contact/index.html",sectionId:"inquiry",fields:["name","preferredContact","contactDetail","location","message"],submitLabel:"Preview inquiry"},
    {pagePath:"approach/index.html",sectionId:"coverage",fields:["location","message","preferredContact","contactDetail"],submitLabel:"Preview coverage inquiry"},
  ],actions:[{pagePath:"index.html",sectionId:"services",itemIndex:0,label:"Explore the service options",targetPage:"services/index.html",targetSection:"options"}]};
  return b;
};
let hero:Buffer,browser:Browser;
beforeAll(async()=>{hero=await sharp(Buffer.from(fixtureHeroSvg)).png().toBuffer();browser=await chromium.launch({headless:true});});
afterAll(async()=>{await browser?.close();});

describe("Explicit portable forms and service navigation",()=>{
  it("preserves explicit service actions without injecting generic links into explanatory items",()=>{
    const b=fixture();b.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[]};b.media=[];
    b.interactions!.actions[0].itemIndex=2;b.interactions!.actions[0].label="Let's discuss cooling";
    const html=Buffer.from(renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero}).files["index.html"]).toString();
    expect(html).toContain('href="contact/index.html#inquiry">Preview inquiry <span');
    const services=html.match(/<section id="services"[\s\S]*?<\/section>/)![0];
    expect(services.match(/class="service-link"/g)).toHaveLength(1);expect(services).toContain("Let&#39;s discuss cooling");expect(services).toContain('href="services/index.html#options"');
    expect(services).not.toContain("Discuss your needs");
    const configured=b.interactions!.actions;b.interactions!.actions=[];
    const automatic=Buffer.from(renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero}).files["index.html"]).toString().match(/<section id="services"[\s\S]*?<\/section>/)![0];
    expect(automatic.match(/class="service-link"/g)).toHaveLength(3);b.interactions!.actions=configured;
    delete b.presentation;
    const legacy=Buffer.from(renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero}).files["index.html"]).toString().match(/<section id="services"[\s\S]*?<\/section>/)![0];
    expect(legacy.match(/class="service-link"/g)).toHaveLength(3);
  });
  it("shows direct channels once per page and does not duplicate explicit Call or Email actions",()=>{
    const b=fixture();b.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[]};b.media=[];
    b.contact={email:"hello@example.test",phone:"+16785550101",address:"Synthetic test address"};
    b.pages.find(page=>page.path==="contact/index.html")!.sections.push({id:"channels",kind:"contact",layout:"rows",eyebrow:"Direct contact",title:"Choose how to reach us",body:"Use the route that suits your question.",items:[{title:"By phone",body:"Discuss what you need."},{title:"By email",body:"Send the useful details."}]});
    b.interactions!.actions.push({pagePath:"contact/index.html",sectionId:"channels",itemIndex:0,label:"Call our team",targetPage:"contact/index.html",targetSection:"inquiry"},{pagePath:"contact/index.html",sectionId:"channels",itemIndex:1,label:"Email our team",targetPage:"contact/index.html",targetSection:"inquiry"});
    const sections=()=>{
      const html=Buffer.from(renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero}).files["contact/index.html"]).toString();
      return {channels:html.match(/<section id="channels"[\s\S]*?<\/section>/)![0],inquiry:html.match(/<section id="inquiry"[\s\S]*?<\/section>/)![0]};
    };
    const explicit=sections();
    expect(explicit.channels.match(/href="tel:/g)).toHaveLength(1);expect(explicit.channels.match(/href="mailto:/g)).toHaveLength(1);expect(explicit.channels).toContain("Synthetic test address");
    expect(explicit.inquiry).not.toMatch(/href="(?:tel:|mailto:)/);expect(explicit.inquiry).not.toContain("Synthetic test address");expect(explicit.inquiry.match(/<form /g)).toHaveLength(1);
    for(const remaining of ["Call our team","Email our team"]){
      const original=b.interactions!.actions;
      b.interactions!.actions=original.filter(action=>action.pagePath!=="contact/index.html"||action.label===remaining);
      const partial=sections();expect(partial.channels.match(/href="tel:/g)).toHaveLength(1);expect(partial.channels.match(/href="mailto:/g)).toHaveLength(1);
      b.interactions!.actions=original;
    }
    b.interactions!.actions=b.interactions!.actions.filter(action=>action.pagePath!=="contact/index.html");
    const fallback=sections();
    expect(fallback.channels.match(/href="tel:/g)).toHaveLength(1);expect(fallback.channels.match(/href="mailto:/g)).toHaveLength(1);expect(fallback.inquiry).not.toMatch(/href="(?:tel:|mailto:)/);
  });
  it("requires controls in new provider responses while retaining legacy blueprints",()=>{
    const b=fixture();expect(siteGenerationSchema.parse({...b,heroImage:{...b.heroImage,uploadId:null},media:[],presentation:{version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[],imageFocalPoints:[]}}).interactions.forms).toHaveLength(2);
    delete b.interactions;expect(()=>validateBlueprintStructure(b)).not.toThrow();expect(()=>siteGenerationSchema.parse(b)).toThrow();
    const {files}=renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero});
    expect(Buffer.from(files["index.html"]).toString()).toContain('name="email"');
  });
  it("rejects missing/duplicate controls and unsafe or nonexistent action targets",()=>{
    const changes=[
      (b:ReturnType<typeof fixture>)=>{b.interactions!.forms[0].sectionId="missing";},
      (b:ReturnType<typeof fixture>)=>{b.interactions!.forms.push(b.interactions!.forms[0]);},
      (b:ReturnType<typeof fixture>)=>{b.interactions!.forms[0].fields=["name","name"];},
      (b:ReturnType<typeof fixture>)=>{b.interactions!.forms[0].fields=["preferredContact"];},
      (b:ReturnType<typeof fixture>)=>{b.interactions!.actions[0].targetPage="https://outside.test/";},
      (b:ReturnType<typeof fixture>)=>{b.interactions!.actions[0].targetSection="missing";},
      (b:ReturnType<typeof fixture>)=>{b.interactions!.actions[0].itemIndex=7;},
      (b:ReturnType<typeof fixture>)=>{b.interactions!.actions.push(b.interactions!.actions[0]);},
      (b:ReturnType<typeof fixture>)=>{b.pages[0].sections.find(s=>s.id==="services")!.kind="faq";},
    ];
    for(const change of changes){const b=fixture();change(b);expect(()=>validateBlueprintStructure(b)).toThrow();}
  });
  it("renders only configured forms, escaped labels and specific internal service links",()=>{
    const b=fixture();b.interactions!.actions[0].label='Explore <script>bad()</script>';b.interactions!.forms.reverse();
    const {files}=renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero}),home=Buffer.from(files["index.html"]).toString(),contact=Buffer.from(files["contact/index.html"]).toString();
    expect(home).not.toContain('<form ');expect(Buffer.from(files["services/index.html"]).toString()).not.toContain('<form ');
    expect(home).toContain('href="contact/index.html#inquiry">Start an inquiry');
    expect(home).toContain('href="services/index.html#options"');expect(home).toContain('Explore &lt;script&gt;bad()&lt;/script&gt;');
    expect(contact.match(/<form /g)).toHaveLength(1);expect(contact).toContain('name="location"');expect(contact).not.toContain('name="email"');
    expect(contact.indexOf('Demo only')).toBeLessThan(contact.indexOf('type="submit"'));
    expect(publicSiteCopy(b)[0].text).toContain('Explore <script>bad()</script>');
    expect(()=>assertPortableSiteSafety(files)).not.toThrow();
  });
  it("checks every configured form and cross-page anchor on desktop/mobile",async()=>{
    const {files}=renderPortableSite(portableBundle(fixture()),{"assets/images/hero.png":hero});
    const qa=await checkPortableSite({files,browser});expect(qa.issues).toEqual([]);expect(qa.passed).toBe(true);
    const broken={...files,"index.html":Buffer.from(Buffer.from(files["index.html"]).toString().replace('services/index.html#options','services/index.html#missing'))};
    const invalid=await checkPortableSite({files:broken,browser});expect(invalid.issues.some(i=>i.code==="broken_anchor")).toBe(true);
  },120000);
  it("renders closing contact item links without extra forms or duplicate fallback links",async()=>{
    const b=fixture();
    for(const page of [b.pages[0],b.pages[1]]){
      const section=page.sections.find(s=>s.kind==="contact")!;
      section.layout="band";
      b.design!.sectionStyles.push({pagePath:page.path,sectionId:section.id,tone:"contrast"});
      section.items=[{title:"Prefer a written inquiry?",body:"Describe your needs <briefly>."}];
      b.interactions!.actions.push({pagePath:page.path,sectionId:section.id,itemIndex:0,label:"Contact <the team>",targetPage:"contact/index.html",targetSection:"inquiry"});
    }
    expect(()=>validateBlueprintStructure(b)).not.toThrow();
    const {files}=renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero});
    const home=Buffer.from(files["index.html"]).toString(),inner=Buffer.from(files["approach/index.html"]).toString();
    expect(home).toContain('href="contact/index.html#inquiry">Contact &lt;the team&gt;');
    expect(inner).toContain('href="../contact/index.html#inquiry">Contact &lt;the team&gt;');
    expect(home).toContain('Describe your needs &lt;briefly&gt;.');
    expect(home).not.toContain('>Start an inquiry <span');expect(home).not.toContain('<form ');
    expect(inner.match(/<form /g)).toHaveLength(1);
    expect(()=>assertPortableSiteSafety(files)).not.toThrow();
    const context=await browser.newContext();
    await context.route("**/*",async route=>{const key=new URL(route.request().url()).pathname.slice(1);await route.fulfill({body:Buffer.from(files[key]),contentType:siteContentType(key)});});
    try{
      const page=await context.newPage();
      for(const width of [1440,390]){
        await page.setViewportSize({width,height:900});await page.goto("https://contrast-test.invalid/approach/index.html");
        const link=page.locator('#coverage .contact-item a');
        const colors=await link.evaluate(el=>{
          const hex=(rgb:string)=>"#"+rgb.match(/[\d.]+/g)!.slice(0,3).map(n=>Math.round(Number(n)).toString(16).padStart(2,"0")).join("");
          return {ink:hex(getComputedStyle(el).color),background:hex(getComputedStyle(el.closest("section")!).backgroundColor)};
        });
        expect(contrastRatio(colors.ink,colors.background)).toBeGreaterThanOrEqual(4.5);
        await link.focus();expect(await link.evaluate(el=>el===document.activeElement)).toBe(true);
        await link.click();expect(new URL(page.url()).pathname).toBe("/contact/index.html");
      }
    }finally{await context.close();}
    const qa=await checkPortableSite({files,browser});expect(qa.issues).toEqual([]);
  },120000);
  it("switches contact validation and previews submission without network delivery or storage",async()=>{
    const {files}=renderPortableSite(portableBundle(fixture()),{"assets/images/hero.png":hero});
    const context=await browser.newContext(),unexpected:string[]=[];
    await context.route("**/*",async route=>{const u=new URL(route.request().url()),key=u.pathname.slice(1);if(u.origin!=="https://form-test.invalid"||route.request().method()!=="GET"||!files[key]){unexpected.push(route.request().url());await route.abort();return;}await route.fulfill({body:Buffer.from(files[key]),contentType:siteContentType(key)});});
    try{
      const page=await context.newPage();await page.goto("https://form-test.invalid/contact/index.html");
      const form=page.locator('[data-demo-form]'),detail=form.locator('[name="contactDetail"]');
      await form.locator('[name="name"]').fill("Synthetic visitor");await form.locator('[name="location"]').fill("Synthetic city");await form.locator('[name="message"]').fill("Synthetic service concern");
      await detail.fill("not-an-email");expect(await detail.evaluate((e:HTMLInputElement)=>e.checkValidity())).toBe(false);
      await form.locator('[name="preferredContact"]').selectOption("phone");await detail.fill("not-a-phone");expect(await detail.evaluate((e:HTMLInputElement)=>e.checkValidity())).toBe(false);
      await detail.fill("(555) 555-0123");expect(await detail.evaluate((e:HTMLInputElement)=>e.checkValidity())).toBe(true);
      await form.locator('button[type="submit"]').click();expect(await form.locator('[data-demo-feedback]').textContent()).toContain("was not sent or stored");
      expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});expect(unexpected).toEqual([]);
    }finally{await context.close();}
  },30000);
});
