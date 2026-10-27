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
    expect(result.issues.filter(issue=>issue.code==="accessibility_link-name"&&issue.message.includes("services-panel-1")),JSON.stringify(result.issues)).toHaveLength(2);
    expect(result.passed).toBe(false);
  },60000);
  it("rejects fixed contact controls that can cover content while scrolling",async()=>{
    const b=fixtureBlueprint();b.media=[];b.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[]};
    const {files}=renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero});
    files["assets/site.css"]=Buffer.concat([Buffer.from(files["assets/site.css"]),Buffer.from("@media(max-width:760px){.presentation-v1 .mobile-contact{position:fixed;bottom:0;left:0;width:100%;z-index:30;background:var(--surface)}}")]);
    const result=await checkPortableSite({files,browser});
    expect(result.issues.filter(issue=>issue.code==="mobile_contact_overlap")).toEqual([expect.objectContaining({page:"index.html",viewport:"mobile",severity:"error"})]);
    expect(result.passed).toBe(false);
  },60000);
  it("catches a valid internal link whose Call label falsely promises to dial",async()=>{
    const b=fixtureBlueprint();b.contact.phone="+16785550101";b.pages[0].hero.primaryCta="Call the team";
    const {files}=renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero});
    files["index.html"]=Buffer.from(Buffer.from(files["index.html"]).toString().replace('href="tel:+16785550101">Call the team','href="#benefits">Call the team'));
    const result=await checkPortableSite({files,browser});
    expect(result.issues.filter(issue=>issue.code==="misleading_action")).toHaveLength(2);expect(result.passed).toBe(false);
    expect(result.issues.some(issue=>issue.code==="broken_link"||issue.code==="broken_anchor")).toBe(false);
    expect(result.labPerformance).toHaveLength(2);
    for(const observation of result.labPerformance!){
      expect(observation).toMatchObject({page:"index.html",environment:"isolated-local-chromium",network:"in-memory-unthrottled"});
      expect(observation.measurementWindowMs).toBeGreaterThan(0);expect(observation.loadMs).toBeGreaterThanOrEqual(0);
      expect(observation.cumulativeLayoutShift).toBeGreaterThanOrEqual(0);expect(observation).not.toHaveProperty("coreWebVitalsPassed");
    }
    expect(result.screenshots.every(shot=>(shot.regions?.length||0)>1)).toBe(true);
  },60000);
});
