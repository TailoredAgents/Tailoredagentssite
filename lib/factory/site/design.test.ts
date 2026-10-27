import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
import {chromium,type Browser} from "playwright";
import sharp from "sharp";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
vi.mock("server-only",()=>({}));
import {fixtureBlueprint,fixtureHeroSvg,fixtureSitePlan} from "./fixtures";
import {applyApprovedDesign,approvedDesignConstraints} from "./design";
import {validateBlueprintStructure,portableBundle,siteGenerationSchema} from "./validate";
import {renderPortableSite} from "./render";
import {checkPortableSite} from "./qa";
import {preparePortableImages} from "./images";
import {generatePortableSite} from "./provider";
import {siteContentType} from "./artifacts";

let browser:Browser,hero:Buffer;
beforeAll(async()=>{hero=await sharp(Buffer.from(fixtureHeroSvg)).png().toBuffer();browser=await chromium.launch({headless:true});},30000);
afterAll(async()=>{await browser?.close();});
const plan={...fixtureSitePlan,design:{direction:"A crisp comfort-services identity",palette:["Deep navy #142B40","Cooling teal #087F8C","Warm amber #F3AD46 for limited accents","Off-white #F5F7F8","Charcoal #24323D"],typography:"A readable sans-serif such as Inter with bold concise headings",imagery:"Illustrative concept photography"}};

describe("Approved design fidelity and portable presentation",()=>{
  it("keeps all legacy family tokens when an old saved blueprint has no design object",()=>{
    const blueprint=fixtureBlueprint();delete blueprint.design;
    expect(validateBlueprintStructure(blueprint).design).toBeUndefined();
    expect(()=>siteGenerationSchema.parse(blueprint)).toThrow();
    const {files}=renderPortableSite(portableBundle(blueprint),{"assets/images/hero.png":hero}),html=Buffer.from(files["index.html"]).toString(),css=Buffer.from(files["assets/site.css"]).toString();
    expect(html).not.toContain('class="design-v1');expect(css).toContain('--background:#f3f1e9');expect(css).not.toContain('--section-space:');expect(html).toContain('src="assets/images/hero.png"');
  });
  it("honors approved palette roles and sans-serif typography despite a different generated theme",async()=>{
    const blueprint=fixtureBlueprint();blueprint.design!.typography.heading="editorial";
    const result=await generatePortableSite({plan},async request=>{
      expect(JSON.stringify(request.body)).toContain('approvedDesignConstraints');
      return {id:"synthetic-design",status:"completed",usage:{input_tokens:1000,output_tokens:1000},output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(blueprint)}]}]};
    });
    expect(result.blueprint.design?.palette).toMatchObject({background:"#f5f7f8",ink:"#24323d",muted:"#142b40",accent:"#087f8c",accentSecondary:"#f3ad46"});
    expect(result.blueprint.design?.typography).toMatchObject({heading:"modern",body:"modern",weight:700});
    expect(result.blueprint.accent).toBe("#087f8c");
    expect(approvedDesignConstraints({...plan,design:{...plan.design,palette:["Customer brand #125679"]}}).palette).toEqual({});
  });
  it("rejects unsafe tokens, inaccessible explicit colors and nonexistent tone targets",()=>{
    for(const patch of [
      {palette:{...fixtureBlueprint().design!.palette,background:"#ffffff;display:none"}},
      {heroFocalPoint:{x:101,y:0}},
      {palette:{...fixtureBlueprint().design!.palette,ink:"#ffffff"}},
      {sectionStyles:[{pagePath:"../secret",sectionId:"services",tone:"surface"}]},
      {sectionStyles:[{pagePath:"index.html",sectionId:"services",tone:"surface"},{pagePath:"index.html",sectionId:"services",tone:"accent"}]},
    ]){const blueprint=fixtureBlueprint();Object.assign(blueprint.design!,patch);expect(()=>validateBlueprintStructure(blueprint)).toThrow();}
  });
  it("preserves explicit dark palette roles and independently requested heading/body fonts",()=>{
    const darkPlan={...plan,design:{...plan.design,palette:["Navy background #0B1220","Off-white text #F8FAFC","Muted text #CBD5E1","Blue accent #4F83FF"],typography:"Serif headlines with clean sans-serif body text"}};
    const constraints=approvedDesignConstraints(darkPlan);
    expect(constraints).toEqual({palette:{background:"#0b1220",ink:"#f8fafc",muted:"#cbd5e1",accent:"#4f83ff"},typography:{heading:"editorial",body:"modern"}});
    const blueprint=applyApprovedDesign(fixtureBlueprint(),darkPlan);
    expect(validateBlueprintStructure(blueprint).design?.palette).toMatchObject({...constraints.palette,surface:"#0b1220"});
    for(const typography of ["Headings: Georgia; body: Inter","Georgia headlines and Arial body copy","Serif for headings, sans-serif for paragraphs"]){
      expect(approvedDesignConstraints({...darkPlan,design:{...darkPlan.design,typography}}).typography).toEqual({heading:"editorial",body:"modern"});
    }
    expect(approvedDesignConstraints({...darkPlan,design:{...darkPlan.design,typography:"Geometric sans-serif headings alongside humanist sans-serif body"}}).typography).toEqual({heading:"geometric",body:"humanist"});
    expect(approvedDesignConstraints({...darkPlan,design:{...darkPlan.design,typography:"Serif headlines and modern spacing",palette:["Charcoal surface #172025","Cream primary accent #FFF1D0","Off-white body text #F8FAFC","Navy canvas #0B1220"]}})).toEqual({palette:{surface:"#172025",accent:"#fff1d0",ink:"#f8fafc",background:"#0b1220"},typography:{heading:"editorial"}});
  });
  it("keeps explicit palette roles regardless of where heuristic swatches appear",()=>{
    const explicit=["Background #0B1220","Body text #F8FAFC","Primary accent #4F83FF","Secondary accent #ABCDEF","Muted text #CBD5E1"];
    const guessed=["Warm cream #FFF1D0","Charcoal #172025","Cooling teal #087F8C","Warm amber #F3AD46","Muted stone #667788"];
    const expected={background:"#0b1220",ink:"#f8fafc",accent:"#4f83ff",accentSecondary:"#abcdef",muted:"#cbd5e1"};
    for(const palette of [[...explicit,...guessed],[...guessed,...explicit]])expect(approvedDesignConstraints({...plan,design:{...plan.design,palette}}).palette).toEqual(expected);
    for(const palette of [["Background #0B1220","Warm cream #F8FAFC"],["Warm cream #F8FAFC","Background #0B1220"]])expect(approvedDesignConstraints({...plan,design:{...plan.design,palette}}).palette.background).toBe("#0b1220");
  });
  it("renders purposeful palettes, focal points and all new sections without visual or accessibility regressions",async()=>{
    const blueprint=applyApprovedDesign(fixtureBlueprint("trades","framed",true),plan);
    blueprint.design!.density="compact";blueprint.design!.radius="rounded";blueprint.design!.heroFocalPoint={x:72,y:36};
    blueprint.design!.sectionStyles=[{pagePath:"index.html",sectionId:"benefits",tone:"surface"},{pagePath:"index.html",sectionId:"services",tone:"contrast"},{pagePath:"index.html",sectionId:"approach",tone:"accent"}];
    const assets=await preparePortableImages(hero),{files}=renderPortableSite(portableBundle(blueprint),assets);
    const qa=await checkPortableSite({files,browser});expect(qa.issues).toEqual([]);
    const output=path.join(tmpdir(),"tailored-agents-factory-site-core","design-fidelity");await mkdir(output,{recursive:true});
    for(const shot of qa.screenshots.filter(s=>s.page==="index.html"))await writeFile(path.join(output,`${shot.viewport}.png`),shot.bytes);
    const context=await browser.newContext({viewport:{width:320,height:900}});
    try{
      await context.route("**/*",async route=>{const url=new URL(route.request().url()),key=url.pathname.slice(1)||"index.html";if(url.origin!=="https://design.test"||!files[key])return route.abort();return route.fulfill({body:Buffer.from(files[key]),contentType:siteContentType(key)});});
      const page=await context.newPage();await page.goto("https://design.test/index.html");
      const style=await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundColor,heading:getComputedStyle(document.querySelector('h1')!).fontFamily,focal:getComputedStyle(document.querySelector('.hero-image img')!).objectPosition,overflow:document.documentElement.scrollWidth>innerWidth+2,source:(document.querySelector('.hero-image img') as HTMLImageElement).currentSrc,contrast:getComputedStyle(document.querySelector('#services')!).backgroundColor}));
      expect(style).toMatchObject({background:"rgb(245, 247, 248)",focal:"72% 36%",overflow:false,contrast:"rgb(36, 50, 61)"});expect(style.heading).toContain("Arial");expect(style.source).toContain("hero-mobile.webp");
      await page.setViewportSize({width:1440,height:1000});await page.reload();
      expect(await page.locator('.hero-image img').evaluate((img:HTMLImageElement)=>img.currentSrc)).toContain("hero-desktop.webp");
    }finally{await context.close();}
  },120000);
});
