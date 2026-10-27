import {createHash} from "node:crypto";
import {describe,it,expect} from "vitest";
import sharp from "sharp";
import {factoryDiagnosticLimits,parseFactoryDraftDiagnostic,prepareFactoryDiagnosticAssets} from "./diagnostic";
import {fixtureBlueprint,fixtureSitePlan} from "./fixtures";
import {portableLogoPath} from "./images";

const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
function fixture(bytes:Uint8Array=new Uint8Array()){
  return {version:1,kind:"factory-draft-diagnostic",websiteVersion:6,plan:{...structuredClone(fixtureSitePlan),pages:[fixtureSitePlan.pages[0]]},blueprint:fixtureBlueprint(),assets:[{id:"hero",role:"photo",file:"images/hero.png",sha256:hash(bytes)}]};
}
async function png(){return sharp({create:{width:80,height:60,channels:3,background:"#123456"}}).png().toBuffer();}

describe("private saved-draft diagnostics",()=>{
  it("keeps the exact saved blueprint and approved plan without worker state",()=>{
    const raw=fixture(),parsed=parseFactoryDraftDiagnostic(raw);
    expect(parsed).toEqual(raw);
    expect(()=>parseFactoryDraftDiagnostic({...raw,workingData:{apiKey:"not-a-real-secret"}})).toThrow();
    expect(()=>parseFactoryDraftDiagnostic({...raw,assets:[{...raw.assets[0],storageKey:"factory/private/assets/hero.png"}]})).toThrow();
    expect(()=>parseFactoryDraftDiagnostic({...raw,blueprint:{...raw.blueprint,contact:{email:"invented@example.test",phone:null,address:null}}})).toThrow(/confirmed or submitted facts/);
  });
  it("rejects escaped paths, unknown slots, role changes, duplicate and missing assets",()=>{
    const raw=fixture();
    for(const file of ["../hero.png","images/../hero.png","https://private.invalid/hero.png","images\\hero.png","images/hero.png?key=value"]){
      expect(()=>parseFactoryDraftDiagnostic({...raw,assets:[{...raw.assets[0],file}]})).toThrow();
    }
    expect(()=>parseFactoryDraftDiagnostic({...raw,assets:[{...raw.assets[0],id:"other",file:"images/other.png"}]})).toThrow();
    expect(()=>parseFactoryDraftDiagnostic({...raw,assets:[{...raw.assets[0],role:"logo"}]})).toThrow();
    expect(()=>parseFactoryDraftDiagnostic({...raw,assets:[...raw.assets,...raw.assets]})).toThrow();
    expect(()=>parseFactoryDraftDiagnostic({...raw,assets:[]})).toThrow();
  });
  it("bounds metadata and refuses malformed or unknown approved-plan fields",()=>{
    const raw=fixture();
    expect(()=>parseFactoryDraftDiagnostic({...raw,plan:{...raw.plan,secret:"not-allowed"}})).toThrow();
    expect(()=>parseFactoryDraftDiagnostic({...raw,plan:{...raw.plan,pages:[]}})).toThrow();
    expect(()=>parseFactoryDraftDiagnostic({...raw,padding:"x".repeat(factoryDiagnosticLimits.jsonBytes)})).toThrow(/content limit/);
  });
  it("checks saved bytes before encoding and uses the same responsive image paths",async()=>{
    const bytes=await png(),parsed=parseFactoryDraftDiagnostic(fixture(bytes)),calls:Array<[string,number]>=[];
    const assets=await prepareFactoryDiagnosticAssets(parsed,async(file,limit)=>{calls.push([file,limit]);return bytes;});
    expect(calls).toEqual([["images/hero.png",factoryDiagnosticLimits.assetBytes]]);
    expect(Object.keys(assets).sort()).toEqual(["assets/images/hero-desktop.webp","assets/images/hero-mobile.webp"]);
    await expect(prepareFactoryDiagnosticAssets(parsed,async()=>new Uint8Array([1,2,3]))).rejects.toThrow(/fingerprint/);
    await expect(prepareFactoryDiagnosticAssets(parsed,async()=>new Uint8Array(factoryDiagnosticLimits.assetBytes+1))).rejects.toThrow(/size limit/);
  });
  it("rejects matching-hash non-PNG files rather than rendering arbitrary content",async()=>{
    const bytes=Buffer.from("<html>not an image</html>");
    await expect(prepareFactoryDiagnosticAssets(parseFactoryDraftDiagnostic(fixture(bytes)),async()=>bytes)).rejects.toThrow(/normalized PNG/);
  });
  it("preserves the logo role and validates every declared supporting image",async()=>{
    const bytes=await png(),raw=fixture(bytes);
    raw.blueprint.media=[{id:"brand-logo",role:"logo",source:"provided",uploadId:"approved-logo",prompt:"",alt:"Supplied test business logo",caption:"Supplied logo"}];
    raw.blueprint.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:"brand-logo",pageImages:[],sectionImages:[]};
    raw.assets.push({id:"brand-logo",role:"logo",file:"images/brand-logo.png",sha256:hash(bytes)});
    const parsed=parseFactoryDraftDiagnostic(raw),assets=await prepareFactoryDiagnosticAssets(parsed,async()=>bytes);
    expect(assets[portableLogoPath("brand-logo")]).toBeDefined();
    expect(assets["assets/images/brand-logo-mobile.webp"]).toBeUndefined();
    await expect(prepareFactoryDiagnosticAssets(parsed,async file=>file.includes("brand-logo")?new Uint8Array([9]):bytes)).rejects.toThrow(/brand-logo image/);
  });
  it("replays an approved supplied-photo binding without private upload metadata",async()=>{
    const bytes=await png(),raw=fixture(bytes);
    raw.blueprint.media=[{id:"shop-photo",role:"photo",source:"provided",uploadId:"frozen-approved-photo",prompt:"",alt:"The supplied business space",caption:"Photo supplied for the approved design"}];
    raw.blueprint.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[{pagePath:"index.html",sectionId:"services",assetId:"shop-photo",itemIndex:null}]};
    raw.assets.push({id:"shop-photo",role:"photo",file:"images/shop-photo.png",sha256:hash(bytes)});
    const parsed=parseFactoryDraftDiagnostic(raw),assets=await prepareFactoryDiagnosticAssets(parsed,async()=>bytes);
    expect(parsed.blueprint.media?.[0].uploadId).toBe("frozen-approved-photo");
    expect(assets["assets/images/shop-photo-mobile.webp"]).toBeDefined();
    expect(assets["assets/images/shop-photo-desktop.webp"]).toBeDefined();
    expect(JSON.stringify(parsed)).not.toMatch(/storageKey|inputUploads|working_data/);
  });
});
