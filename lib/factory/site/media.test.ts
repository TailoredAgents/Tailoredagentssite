import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {z} from "zod";
import {fixtureBlueprint,fixtureSitePlan} from "./fixtures";
import {siteGenerationSchema,validateBlueprintStructure,validateSiteBlueprint} from "./validate";
import {generatePortableSite} from "./provider";
import type {SiteAssetDescriptor,SiteBlueprint} from "./types";

const uploads:SiteAssetDescriptor[]=[{id:"approved-logo",path:"reference-logo.png",alt:"Customer logo",provenance:"provided",role:"logo"},{id:"approved-photo",path:"reference-photo.png",alt:"Business photo",provenance:"provided",role:"photo"}];
function presentation():SiteBlueprint{
  const b=fixtureBlueprint();
  b.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:"brand-logo",pageImages:[],sectionImages:[{pagePath:"index.html",sectionId:"services",itemIndex:0,assetId:"detail"}]};
  b.media=[{id:"brand-logo",role:"logo",source:"provided",uploadId:"approved-logo",prompt:"",alt:"Customer logo",caption:""},{id:"detail",role:"photo",source:"generated",uploadId:null,prompt:"Illustrative architectural detail with warm directional sunlight, no text or claims.",alt:"Illustrative architectural detail",caption:"Illustrative concept"}];
  return b;
}
const response=(blueprint:SiteBlueprint)=>({id:"resp_synthetic_media",status:"completed",usage:{input_tokens:100,output_tokens:100},output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(blueprint)}]}]});

describe("Approved premium presentation contract",()=>{
  it("keeps old blueprints usable and accepts sparse concepts without uploads",()=>{
    expect(validateSiteBlueprint(fixtureBlueprint(),fixtureSitePlan)).toBeDefined();
    const b=presentation();b.media=[];b.presentation!.logoAssetId=null;b.presentation!.sectionImages=[];
    expect(validateSiteBlueprint(b,fixtureSitePlan,[]).media).toEqual([]);
  });
  it("requires a matching approved upload for a real logo",()=>{
    const b=presentation();expect(validateSiteBlueprint(b,fixtureSitePlan,uploads).media).toHaveLength(2);
    expect(()=>validateSiteBlueprint(b,fixtureSitePlan,[])).toThrow("approved upload");
    b.media![0].uploadId="approved-photo";expect(()=>validateSiteBlueprint(b,fixtureSitePlan,uploads)).toThrow("matching logo or photo role");
  });
  it("rejects generated logos, missing upload ids and unused paid imagery",()=>{
    const b=presentation();b.media![0].source="generated";b.media![0].uploadId=null;b.media![0].prompt="Generate a fake company logo with a made-up brand.";
    expect(()=>validateBlueprintStructure(b)).toThrow("logos cannot be generated");
    const missing=presentation();missing.media![0].uploadId=null;expect(()=>validateBlueprintStructure(missing)).toThrow("approved upload");
    const unused=presentation();unused.presentation!.sectionImages=[];expect(()=>validateBlueprintStructure(unused)).toThrow("purpose and placement");
  });
  it("rejects duplicate, escaped, hero-replacing and excessive generated media ids",()=>{
    for(const id of ["../private","https://bad.test/img","hero","a".repeat(33)]){const b=presentation();b.media![1].id=id;expect(()=>validateBlueprintStructure(b)).toThrow();}
    const b=presentation();b.media!.push({...b.media![1]});expect(()=>validateBlueprintStructure(b)).toThrow("unique");
    const capped=presentation();capped.media!.push({...capped.media![1],id:"two"},{...capped.media![1],id:"three"});expect(()=>validateBlueprintStructure(capped)).toThrow("at most two");
  });
  it("checks actual section/item/page targets and prevents logos being used as photography",()=>{
    const b=presentation();b.presentation!.sectionImages[0].itemIndex=7;expect(()=>validateBlueprintStructure(b)).toThrow("section or item");
    b.presentation!.sectionImages[0].itemIndex=0;b.presentation!.sectionImages[0].assetId="brand-logo";expect(()=>validateBlueprintStructure(b)).toThrow("non-photo");
    const unsupported=presentation();unsupported.pages[0].sections.find(s=>s.id==="services")!.kind="faq";expect(()=>validateBlueprintStructure(unsupported)).toThrow("not item photos");
    const page=presentation();page.presentation!.pageImages=[{pagePath:"missing/index.html",assetId:"hero"}];expect(()=>validateBlueprintStructure(page)).toThrow("missing or duplicate page");
  });
  it("rejects ambiguous logo filenames, unlabelled generated photos and unversioned layouts before image generation",()=>{
    const logo=presentation();logo.media![0].id="brand-mobile";logo.presentation!.logoAssetId="brand-mobile";expect(()=>validateBlueprintStructure(logo)).toThrow("image variant suffixes");
    const caption=presentation();caption.media![1].caption="";expect(()=>validateBlueprintStructure(caption)).toThrow("illustrative concepts");
    const legacy=fixtureBlueprint();legacy.pages[0].sections[0].layout="service-tabs";expect(()=>validateBlueprintStructure(legacy)).toThrow("explicit presentation");
  });
  it("requires exact headline emphasis and distinct placements",()=>{
    const b=presentation();b.presentation!.heroEmphasis="This is not in the headline";expect(()=>validateBlueprintStructure(b)).toThrow("exact phrase");
    b.presentation!.heroEmphasis=b.pages[0].hero.headline;expect(validateBlueprintStructure(b)).toBeDefined();
    b.presentation!.sectionImages.push({...b.presentation!.sectionImages[0]});expect(()=>validateBlueprintStructure(b)).toThrow("duplicate");
  });
  it("sends a fully required strict schema but can recover an older saved response",async()=>{
    const schema=z.toJSONSchema(siteGenerationSchema,{target:"draft-7"});
    const visit=(value:unknown)=>{if(!value||typeof value!=="object")return;const node=value as Record<string,unknown>;if(node.type==="object"&&node.properties){expect(node.additionalProperties).toBe(false);expect(new Set(node.required as string[])).toEqual(new Set(Object.keys(node.properties as object)));}Object.values(node).forEach(child=>Array.isArray(child)?child.forEach(visit):visit(child));};visit(schema);
    const old=await generatePortableSite({plan:fixtureSitePlan},async()=>response(fixtureBlueprint()));expect(old.blueprint.presentation).toBeUndefined();
  });
  it("freezes paid media during targeted repairs and does not admit new image requests",async()=>{
    const original=presentation(),next=presentation();next.media![1].prompt="A different prompt that must not trigger a replacement image.";
    const result=await generatePortableSite({plan:fixtureSitePlan,assets:uploads,previousBlueprint:original,repairIssues:[{page:"index.html",code:"design",severity:"error",message:"Improve spacing"}]},async()=>response(next));
    expect(result.blueprint.media).toEqual(original.media);expect(result.blueprint.heroImage).toEqual(original.heroImage);
  });
  it("repairs public image claims without regenerating the saved imagery",async()=>{
    const original=presentation(),next=presentation();
    original.heroImage.caption="Our award-winning team";original.media![1].caption="Our 500 completed projects";
    next.heroImage.prompt="A different new image prompt that must never be regenerated.";
    next.heroImage.alt="Illustrative light-filled interior";next.heroImage.caption="Illustrative concept";
    next.media![1].prompt="A different supporting image prompt that must never be regenerated.";
    next.media![1].alt="Illustrative architectural detail";next.media![1].caption="Illustrative concept, not an actual completed project";
    const result=await generatePortableSite({plan:fixtureSitePlan,assets:uploads,previousBlueprint:original,repairIssues:[{page:"index.html",code:"review_content",severity:"error",message:"Remove unsupported claims in image captions"}]},async()=>response(next));
    expect(result.blueprint.heroImage.prompt).toBe(original.heroImage.prompt);expect(result.blueprint.heroImage.caption).toBe(next.heroImage.caption);
    expect(result.blueprint.media![1]).toEqual({...original.media![1],alt:next.media![1].alt,caption:next.media![1].caption});
  });
  it("lets an older build repair into new layouts using only its saved hero",async()=>{
    const original=fixtureBlueprint(),next=presentation();next.pages[0].sections[0].layout="service-tabs";
    next.presentation!.sectionImages.push({pagePath:"index.html",sectionId:"services",itemIndex:null,assetId:"hero"});
    const result=await generatePortableSite({plan:fixtureSitePlan,previousBlueprint:original,repairIssues:[{page:"index.html",code:"review_design",severity:"error",message:"Use a compact service selector and clearer hierarchy"}]},async()=>response(next));
    expect(result.blueprint.media).toBeUndefined();expect(result.blueprint.presentation!.logoAssetId).toBeNull();
    expect(result.blueprint.presentation!.sectionImages).toEqual([{pagePath:"index.html",sectionId:"services",itemIndex:null,assetId:"hero"}]);
    expect(result.blueprint.pages[0].sections[0].layout).toBe("service-tabs");expect(result.blueprint.heroImage.prompt).toBe(original.heroImage.prompt);
  });
  it("can remove unsuitable saved supporting imagery during repair without admitting replacements",async()=>{
    const original=presentation(),next=presentation();next.media=[];next.presentation!.logoAssetId=null;next.presentation!.sectionImages=[];
    const repair={plan:fixtureSitePlan,assets:uploads,previousBlueprint:original,repairIssues:[{page:"index.html",code:"review_imagery",severity:"error" as const,message:"Remove the unsuitable supporting photo and use a typographic identity"}]};
    const result=await generatePortableSite(repair,async()=>response(next));expect(result.blueprint.media).toEqual([]);expect(result.blueprint.heroImage.prompt).toBe(original.heroImage.prompt);
    const replacement=presentation();replacement.media![1].id="replacement";replacement.presentation!.sectionImages[0].assetId="replacement";
    await expect(generatePortableSite(repair,async()=>response(replacement))).rejects.toThrow("cannot request new imagery");
  });
});
