import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {chromium,type Browser} from "playwright";
import sharp from "sharp";
import {fixtureBlueprint,fixtureHeroSvg} from "./fixtures";
import {portableBundle} from "./validate";
import {renderPortableSite} from "./render";
import {checkPortableSite} from "./qa";

let browser:Browser,hero:Buffer;
beforeAll(async()=>{browser=await chromium.launch({headless:true});hero=await sharp(Buffer.from(fixtureHeroSvg)).png().toBuffer();});
afterAll(async()=>{await browser?.close();});
describe("Meaningful browser observations",()=>{
  it("checks accessibility of service content initially hidden behind another tab",async()=>{
    const b=fixtureBlueprint("professional");b.media=[];b.presentation={version:1,fontTheme:"technical",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[]};
    b.pages[0].sections.find(section=>section.id==="services")!.layout="service-tabs";
    const {files}=renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero});
    files["index.html"]=Buffer.from(Buffer.from(files["index.html"]).toString().replace("<h3>Shape the direction</h3>",'<h3>Shape the direction</h3><a href="#contact"><span aria-hidden="true">&#8599;</span></a>'));
    const result=await checkPortableSite({files,browser});
    expect(result.issues.filter(issue=>issue.code==="accessibility_link-name"&&issue.message.includes("services-panel-1")),JSON.stringify(result.issues)).toHaveLength(4);
    expect(result.passed).toBe(false);
  },60000);
  it("rejects fixed contact controls that can cover content while scrolling",async()=>{
    const b=fixtureBlueprint();b.media=[];b.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[]};
    b.contact.phone="+16785550101";
    const {files}=renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero});
    files["assets/site.css"]=Buffer.concat([Buffer.from(files["assets/site.css"]),Buffer.from("@media(max-width:760px){.presentation-v1 .mobile-contact{position:fixed;bottom:0;left:0;width:100%;z-index:30;background:var(--surface)}}")]);
    const result=await checkPortableSite({files,browser});
    expect(result.issues.filter(issue=>issue.code==="mobile_contact_overlap")).toEqual([
      expect.objectContaining({page:"index.html",viewport:"mobile",severity:"error"}),
      expect.objectContaining({page:"index.html",viewport:"mobile",severity:"error",message:expect.stringContaining("320px narrow phone:")}),
    ]);
    expect(result.passed).toBe(false);
  },60000);
  it("catches a valid internal link whose Call label falsely promises to dial",async()=>{
    const b=fixtureBlueprint();b.contact.phone="+16785550101";b.pages[0].hero.primaryCta="Call the team";
    const {files}=renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero});
    files["index.html"]=Buffer.from(Buffer.from(files["index.html"]).toString().replace('href="tel:+16785550101">Call the team','href="#benefits">Call the team'));
    const result=await checkPortableSite({files,browser});
    expect(result.issues.filter(issue=>issue.code==="misleading_action")).toHaveLength(4);expect(result.passed).toBe(false);
    expect(result.issues.some(issue=>issue.code==="broken_link"||issue.code==="broken_anchor")).toBe(false);
    expect(result.labPerformance).toHaveLength(2);
    for(const observation of result.labPerformance!){
      expect(observation).toMatchObject({page:"index.html",environment:"isolated-local-chromium",network:"in-memory-unthrottled"});
      expect(observation.measurementWindowMs).toBeGreaterThan(0);expect(observation.loadMs).toBeGreaterThanOrEqual(0);
      expect(observation.cumulativeLayoutShift).toBeGreaterThanOrEqual(0);expect(observation).not.toHaveProperty("coreWebVitalsPassed");
    }
    expect(result.screenshots.every(shot=>(shot.regions?.length||0)>1)).toBe(true);
  },60000);
  it("checks every inner page at extra widths without adding stored screenshots or lab observations",async()=>{
    const b=fixtureBlueprint("trades",undefined,true);
    const {files}=renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero});
    files["assets/site.css"]=Buffer.concat([Buffer.from(files["assets/site.css"]),Buffer.from(`
      @media(max-width:330px){body[data-page="approach/index.html"] main{min-width:500px}}
      @media(min-width:760px) and (max-width:780px){body[data-page="services/index.html"] main{min-width:1000px}}
    `)]);
    const result=await checkPortableSite({files,browser});
    expect(result.issues.filter(issue=>issue.code==="horizontal_overflow")).toEqual([
      expect.objectContaining({page:"approach/index.html",viewport:"mobile",message:expect.stringContaining("320px narrow phone:")}),
      expect.objectContaining({page:"services/index.html",viewport:"desktop",message:expect.stringContaining("768px tablet:")}),
    ]);
    expect(result.issues.some(issue=>issue.code==="qa_interrupted")).toBe(false);
    expect(result.screenshots.map(shot=>`${shot.page}:${shot.viewport}`)).toEqual([
      "approach/index.html:desktop","index.html:desktop","services/index.html:desktop",
      "approach/index.html:mobile","index.html:mobile","services/index.html:mobile",
    ]);
    expect(result.labPerformance).toHaveLength(6);
  },120000);
  it("passes keyboard menus, service choices, long text and demo forms across the four widths",async()=>{
    const b=fixtureBlueprint("professional");b.media=[];b.presentation={version:1,fontTheme:"technical",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[]};
    b.pages[0].sections.find(section=>section.id==="services")!.layout="service-tabs";
    b.pages[0].hero.headline="A thoughtful approach to complicated business decisions and the next chapter of your organization.";
    // Keep the renderer's legacy demonstration form for a true submit check.
    delete b.interactions;
    const {files}=renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero});
    const result=await checkPortableSite({files,browser});
    expect(result.issues,JSON.stringify(result.issues)).toEqual([]);expect(result.passed).toBe(true);
    expect(result.screenshots).toHaveLength(2);expect(result.labPerformance).toHaveLength(2);
  },60000);
  it("reports inaccessible narrow-phone navigation and a tablet reduced-motion regression at their actual widths",async()=>{
    const b=fixtureBlueprint();
    const {files}=renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero});
    files["assets/site.css"]=Buffer.concat([Buffer.from(files["assets/site.css"]),Buffer.from(`
      @media(max-width:330px){#site-menu a{visibility:hidden}}
      @keyframes qa-motion{from{transform:translateX(0)}to{transform:translateX(1px)}}
      @media(prefers-reduced-motion:reduce) and (max-width:330px){.site-hero{animation:qa-motion 1s linear infinite!important}}
      @media(prefers-reduced-motion:reduce) and (min-width:760px) and (max-width:780px){html{scroll-behavior:smooth!important}}
    `)]);
    const result=await checkPortableSite({files,browser});
    expect(result.issues.filter(issue=>issue.code==="mobile_menu_keyboard")).toEqual([
      expect.objectContaining({page:"index.html",viewport:"mobile",message:"320px narrow phone: Keyboard focus did not reach the first visible navigation link."}),
    ]);
    expect(result.issues.filter(issue=>issue.code==="reduced_motion")).toEqual([
      expect.objectContaining({page:"index.html",viewport:"mobile",message:expect.stringContaining("320px narrow phone:")}),
      expect.objectContaining({page:"index.html",viewport:"desktop",message:expect.stringContaining("768px tablet:")}),
    ]);
    expect(result.issues.some(issue=>issue.code==="qa_interrupted")).toBe(false);expect(result.passed).toBe(false);
  },60000);
});
