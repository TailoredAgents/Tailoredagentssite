import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {chromium,webkit,type Browser} from "playwright";
import sharp from "sharp";
import {fixtureBlueprint,fixtureSitePlan,fixtureHeroSvg} from "./fixtures";
import {applyApprovedDesign,approvedHomeSurface,assertApprovedOpeningContrast} from "./design";
import {portableBundle,validateBlueprintStructure} from "./validate";
import {renderPortableSite,configuredHeroTarget} from "./render";
import {checkPortableSite} from "./qa";
import {siteContentType,type SiteFiles} from "./artifacts";
import type {FactoryPlanContent} from "../types";
import type {SiteBlueprint} from "./types";

// Synthetic reconstruction of the failure shape; no client identity, facts,
// uploads, private plan or provider response is included.
function example(){
  const b=fixtureBlueprint("professional","asymmetric");
  b.brandName="Move Planning Concept";
  b.presentation={version:1,fontTheme:"editorial",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[]};
  const section=(id:string,kind:"services"|"contact")=>({id,kind,layout:"rows" as const,eyebrow:"Your next step",title:"Consider the choices ahead.",body:"Explore the priorities and practical considerations that can shape a useful next step.",items:kind==="services"?[{title:"Set priorities",body:"Think through the practical needs and timing that matter for this decision."},{title:"Compare options",body:"Consider the available choices and their tradeoffs before choosing a direction."},{title:"Prepare questions",body:"Bring the remaining questions to an individual conversation about your circumstances."}]:[]});
  const hero={eyebrow:"Planning ahead",headline:"Clarity for your next move.",body:"Understand your options before taking the next step.",primaryCta:"Explore buying",secondaryCta:"Explore selling"};
  b.pages=[{path:"index.html",title:"Home",description:hero.body,hero,sections:[section("pathways","services")]},{path:"guidance/index.html",title:"Buying & Selling",description:hero.body,hero:{...hero,headline:"Understand the decisions ahead."},sections:[section("buying","services"),section("selling","services")]},{path:"contact/index.html",title:"Contact",description:hero.body,hero:{...hero,headline:"Your plans and timing.",primaryCta:"Preview inquiry",secondaryCta:""},sections:[section("inquiry","contact")]}];
  b.interactions={version:1,forms:[{pagePath:"contact/index.html",sectionId:"inquiry",fields:["name","email","message"],submitLabel:"Preview inquiry"}],actions:[{pagePath:"index.html",sectionId:"pathways",itemIndex:0,label:"Explore buying",targetPage:"guidance/index.html",targetSection:"buying"},{pagePath:"index.html",sectionId:"pathways",itemIndex:1,label:"Explore selling",targetPage:"guidance/index.html",targetSection:"selling"}]};
  const plan:FactoryPlanContent={...fixtureSitePlan,pages:b.pages.map(page=>({title:page.title,purpose:page.description,sections:page.sections.map(section=>section.title)})),design:{direction:"A clear contrasting opening",palette:["Background: #faf8f3","Surface: #eeeae2","Ink: #202c28","Muted: #59635d","Accent: #243e5a — opening landmark and primary actions, with Background-colored text","AccentSecondary: #745034"],typography:"Editorial serif headings and sans-serif body text",imagery:"Illustrative architecture",recipe:{version:1,family:"professional",composition:"asymmetric",fontTheme:"editorial",density:"balanced",radius:"soft"}}};
  return {blueprint:applyApprovedDesign(b,plan),saved:b,plan};
}
let browser:Browser,hero:Buffer;
beforeAll(async()=>{browser=await chromium.launch({headless:true});hero=await sharp(Buffer.from(fixtureHeroSvg)).png().toBuffer();},30000);
afterAll(async()=>{await browser?.close();});
function render(b:SiteBlueprint){return renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero}).files;}
async function observe(engine:Browser,width:number){
  const {blueprint,plan,saved}=example(),original=JSON.stringify({plan,saved}),files=render(blueprint);
  const context=await engine.newContext({viewport:{width,height:900}});
  try{
    const outside:string[]=[];
    await context.route("**/*",route=>{const url=new URL(route.request().url()),key=url.pathname.slice(1)||"index.html";if(url.origin==="https://approved-render.test"&&files[key])return route.fulfill({body:Buffer.from(files[key]),contentType:siteContentType(key)});outside.push(url.href);return route.abort();});
    const page=await context.newPage();
    for(const route of ["index.html","guidance/index.html"]){
      await page.goto(`https://approved-render.test/${route}`);await page.evaluate(()=>document.fonts.ready);
      const colors=await page.locator(".site-hero").evaluate(element=>({background:getComputedStyle(element).backgroundColor,color:getComputedStyle(element.querySelector("h1")!).color}));
      if(route==="index.html")expect(colors).toEqual({background:"rgb(36, 62, 90)",color:"rgb(250, 248, 243)"});
      else expect(colors.background).not.toBe("rgb(36, 62, 90)");
      expect(await page.locator("#buying .service-link,#selling .service-link").count()).toBe(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
      for(const [slot,target] of [["primary","buying"],["secondary","selling"]]){
        await page.locator(`[data-hero-action="${slot}"]`).click();
        expect(new URL(page.url()).pathname).toBe("/guidance/index.html");expect(new URL(page.url()).hash).toBe(`#${target}`);
        await page.goto(`https://approved-render.test/${route}`);
      }
    }
    expect(outside).toEqual([]);expect(JSON.stringify({plan,saved})).toBe(original);
  }finally{await context.close();}
}
describe("Approved opening and action contract",()=>{
  it.each([320,768,1440])("renders approved surfaces and follows the actual opening actions at %ipx",async width=>observe(browser,width),60000);
  it.skipIf(process.env.FACTORY_WEBKIT_TESTS!=="true")("preserves the same opening and destinations in phone WebKit",async()=>{const engine=await webkit.launch({headless:true});try{await observe(engine,390);}finally{await engine.close();}},60000);
  it("detects valid-but-wrong destinations, an erased surface and unplanned item links",async()=>{
    const {blueprint}=example(),files:SiteFiles=render(blueprint);
    files["index.html"]=Buffer.from(Buffer.from(files["index.html"]).toString().replace('href="guidance/index.html#buying">Explore buying','href="contact/index.html#inquiry">Explore buying'));
    files["assets/site.css"]=Buffer.concat([Buffer.from(files["assets/site.css"]),Buffer.from("body.page-home .site-hero{background:#faf8f3}")]);
    files["guidance/index.html"]=Buffer.from(Buffer.from(files["guidance/index.html"]).toString().replace('<h3>Set priorities</h3>','<h3>Set priorities</h3><a class="service-link" href="../contact/index.html#inquiry">Discuss your needs</a>'));
    const qa=await checkPortableSite({files,browser,blueprint});
    expect(qa.passed).toBe(false);
    for(const code of ["opening_action","opening_treatment","unplanned_item_action"])expect(qa.issues.some(issue=>issue.code===code&&issue.repairability==="technical")).toBe(true);
    expect(qa.issues.some(issue=>["broken_link","broken_anchor"].includes(issue.code))).toBe(false);
  },120000);
  it("honors explicit opening slots and refuses to guess conflicting saved destinations",()=>{
    const {blueprint:b}=example(),home=b.pages[0];
    b.interactions!.actions.push({...b.interactions!.actions[0],pagePath:"guidance/index.html",sectionId:"buying",itemIndex:0,targetSection:"selling"});
    expect(configuredHeroTarget(b,home,"primary")).toBeNull();
    b.interactions!.heroActions=[{pagePath:"index.html",slot:"primary",targetPage:"guidance/index.html",targetSection:"buying"}];
    expect(configuredHeroTarget(b,home,"primary")).toBe("guidance/index.html#buying");
    expect(()=>validateBlueprintStructure(b)).toThrow("Each labeled opening action");
    b.interactions!.heroActions=b.pages.flatMap(page=>(["primary","secondary"] as const).filter(slot=>page.hero[slot==="primary"?"primaryCta":"secondaryCta"]).map(slot=>({pagePath:page.path,slot,targetPage:"guidance/index.html",targetSection:slot==="primary"?"buying":"selling"})));
    expect(()=>validateBlueprintStructure(b)).not.toThrow();
    b.interactions!.heroActions[0].targetSection="missing";
    expect(()=>validateBlueprintStructure(b)).toThrow("opening action");
  });
  it("keeps deliberate automatic links opt-in and historical rendering compatible",()=>{
    const {blueprint:b}=example();
    expect(Buffer.from(render(b)["guidance/index.html"]).toString().match(/Discuss your needs/g)||[]).toHaveLength(0);
    b.interactions!.serviceLinks="automatic";
    expect(Buffer.from(render(b)["guidance/index.html"]).toString().match(/Discuss your needs/g)).toHaveLength(6);
    delete b.interactions!.serviceLinks;delete b.presentation;
    expect(Buffer.from(render(b)["guidance/index.html"]).toString().match(/Discuss your needs/g)).toHaveLength(6);
  });
  it("does not infer an opening from vague, conflicting or negated palette prose",()=>{
    const {plan}=example();expect(approvedHomeSurface(plan)).toBe("accent");
    plan.design.palette=["Accent: #243e5a — buttons and decorative accents"];expect(approvedHomeSurface(plan)).toBeUndefined();
    plan.design.palette=["Accent: #243e5a — no opening landmark with Background-colored text"];expect(approvedHomeSurface(plan)).toBeUndefined();
    plan.design.palette=["Accent: #243e5a — opening landmark with Background-colored text","Ink: #202c28 — opening landmark with Background-colored text"];expect(approvedHomeSurface(plan)).toBeUndefined();
    plan.design.recipe!.homeSurface="surface";expect(approvedHomeSurface(plan)).toBe("surface");
    plan.design.recipe!.homeSurface="accent";plan.design.palette=["Background: #ffffff","Accent: #eeeeee"];
    expect(()=>assertApprovedOpeningContrast(plan)).toThrow("contrast before approval");
  });
});
