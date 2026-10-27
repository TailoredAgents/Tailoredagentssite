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
