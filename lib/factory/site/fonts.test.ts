import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {chromium,type Browser} from "playwright";
import sharp from "sharp";
import {fixtureBlueprint,fixtureHeroSvg,fixtureSitePlan} from "./fixtures";
import {applyApprovedDesign} from "./design";
import {preparePortableImages} from "./images";
import {renderPortableSite} from "./render";
import {portableBundle} from "./validate";
import {siteContentType,type SiteFiles} from "./artifacts";
import {assertPortableSiteSafety} from "./safety";
import {portableFontFiles,type PortableFontTheme} from "./fonts";

let browser:Browser,assets:SiteFiles;
beforeAll(async()=>{
  browser=await chromium.launch({headless:true});
  assets=await preparePortableImages(await sharp(Buffer.from(fixtureHeroSvg)).png().toBuffer());
},30000);
afterAll(async()=>{await browser?.close();});

function fontFixture(theme:PortableFontTheme){
  const blueprint=fixtureBlueprint();
  blueprint.presentation={version:1,fontTheme:theme,heroEmphasis:"a clear plan.",logoAssetId:null,pageImages:[],sectionImages:[]};
  blueprint.media=[];
  blueprint.design!.typography.weight=theme==="editorial"||theme==="warm"?400:700;
  return blueprint;
}

async function renderedEmphasis(files:SiteFiles){
  const context=await browser.newContext();
  try{
    await context.route("**/*",route=>{
      const key=new URL(route.request().url()).pathname.slice(1)||"index.html";
      return files[key]?route.fulfill({body:Buffer.from(files[key]),contentType:siteContentType(key)}):route.abort();
    });
    const page=await context.newPage();
    await page.goto("https://font.test/index.html");await page.evaluate(()=>document.fonts.ready);
    return await page.locator("h1 em").evaluate(element=>{
      const style=getComputedStyle(element),headingStyle=getComputedStyle(element.closest("h1")!);
      return {text:element.textContent,family:style.fontFamily,style:style.fontStyle,weight:style.fontWeight,headingFamily:headingStyle.fontFamily,fontLoaded:document.fonts.check(`${style.fontStyle} ${style.fontWeight} 16px ${style.fontFamily}`)};
    });
  }finally{await context.close();}
}

describe("Portable theme typography",()=>{
  it.each([
    {theme:"studio",family:'"Site Sans", Arial, sans-serif',style:"normal",weight:"700"},
    {theme:"technical",family:'"Site Geometric", Arial, sans-serif',style:"normal",weight:"700"},
    {theme:"editorial",family:'"Site Display", Georgia, serif',style:"italic",weight:"400"},
    {theme:"warm",family:'"Site Display", Georgia, serif',style:"italic",weight:"400"},
  ] as const)("keeps emphasized headlines within the $theme typography direction",async ({theme,family,style,weight})=>{
    const {files}=renderPortableSite(portableBundle(fontFixture(theme)),assets);
    expect(await renderedEmphasis(files)).toEqual({text:"a clear plan.",family,style,weight,headingFamily:family,fontLoaded:true});
    expect(()=>assertPortableSiteSafety(files)).not.toThrow();
    const bundledFonts=Object.keys(portableFontFiles(theme)).filter(name=>name.endsWith(".woff2"));
    expect(bundledFonts.some(name=>name.includes("serif"))).toBe(theme==="editorial"||theme==="warm");
  });

  it("keeps the entire approved bold sans-serif headline sans even when generation chose an editorial theme",async()=>{
    const blueprint=applyApprovedDesign(fontFixture("editorial"),{...fixtureSitePlan,design:{...fixtureSitePlan.design,typography:"Bold sans-serif headings and readable sans-serif body"}});
    expect(blueprint.presentation!.fontTheme).toBe("studio");
    const {files}=renderPortableSite(portableBundle(blueprint),assets);
    expect(await renderedEmphasis(files)).toMatchObject({family:'"Site Sans", Arial, sans-serif',style:"normal",weight:"700",headingFamily:'"Site Sans", Arial, sans-serif',fontLoaded:true});
    expect(files["assets/fonts/dm-serif-display-italic.woff2"]).toBeUndefined();
  });
});
