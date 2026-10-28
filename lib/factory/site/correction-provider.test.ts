import sharp from "sharp";
import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {factoryUsageCost} from "../config";
import {websiteQualityStandards} from "../website-standards";
import type {SiteIssue} from "./artifacts";
import {generateSiteCorrections,siteCorrectionLimits,type SiteCorrectionInput,type SiteCorrectionPatch} from "./correction-provider";
import {fixtureBlueprint,fixtureSitePlan} from "./fixtures";
import type {SiteModelRequest} from "./types";

const patch:SiteCorrectionPatch={target:{pagePath:"services/index.html",sectionId:"options"},content:{headline:"Choose the depth your project needs.",body:"Explore the differences between an early idea, a defined brief and an established scope.",layout:"rows",items:null},issueIds:["issue-1"]};
const response=(value:unknown={patches:[patch],unresolved:[]})=>({id:"resp_synthetic_correction",status:"completed",usage:{input_tokens:5000,output_tokens:500},output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(value)}]}]});
function input():SiteCorrectionInput{return {plan:fixtureSitePlan,previousBlueprint:fixtureBlueprint("trades","split",true),issues:[{page:"services/index.html",code:"review_copy",severity:"error",message:"The options section repeats its introduction. Make this section more direct."}]};}
const issue=(values:Record<string,unknown>={}):SiteIssue=>({...input().issues[0],...values});

describe("Bounded website correction provider (mocked responses only)",()=>{
  it("applies multiple related corrections atomically while preserving other content and approved controls",async()=>{
    const source=input(),snapshot=structuredClone(source.previousBlueprint);
    source.issues.push(issue({page:"approach/index.html",message:"Shorten the opening before the process explanation."}));
    const second:SiteCorrectionPatch={target:{pagePath:"approach/index.html",sectionId:"__intro__"},content:{headline:"Turn priorities into a workable brief.",body:"Compare the choices that shape the next step.",layout:null,items:null},issueIds:["issue-2"]};
    const execute=vi.fn(async(_request:SiteModelRequest)=>response({patches:[patch,second],unresolved:[]}));
    const result=await generateSiteCorrections(source,execute),expected=structuredClone(snapshot);
    Object.assign(expected.pages[2].sections[0],{title:patch.content.headline,body:patch.content.body,layout:patch.content.layout});
    Object.assign(expected.pages[1].hero,{headline:second.content.headline,body:second.content.body});
    expect(result.blueprint).toEqual(expected);expect(source.previousBlueprint).toEqual(snapshot);
    expect(result.bundle.blueprint).toEqual(expected);expect(result).toMatchObject({changed:true,addressedIssueIds:["issue-1","issue-2"],unresolved:[],usage:{providerId:"resp_synthetic_correction"}});
    expect(execute).toHaveBeenCalledOnce();const request=execute.mock.calls[0][0];
    expect(request.stage).toBe("repair");expect(request.body.tools).toBeUndefined();expect(request.body.instructions).toContain(websiteQualityStandards);
    expect(request.body).toMatchObject({model:"gpt-6.1-sol",store:false,max_output_tokens:6000,text:{format:{name:"factory_site_corrections",strict:true}}});
    const schema=(request.body.text as {format:{schema:{properties:Record<string,unknown>}}}).format.schema;
    expect(Object.keys(schema.properties).sort()).toEqual(["patches","unresolved"]);
    expect(request.reservedMicros).toBe(factoryUsageCost(request.inputBytes+8192,6000,0));
  });
  it("returns genuine unresolved findings without modifying the saved source",async()=>{
    const source=input();source.issues=[issue({repairability:"technical",message:"The trusted renderer needs a spacing adjustment."})];
    const snapshot=structuredClone(source.previousBlueprint),unresolved=[{issueId:"issue-1",reason:"Spacing is implemented by the trusted renderer and is not an available content control."}];
    const result=await generateSiteCorrections(source,async()=>response({patches:[],unresolved}));
    expect(result).toMatchObject({changed:false,addressedIssueIds:[],unresolved});expect(result.blueprint).toEqual(snapshot);expect(source.previousBlueprint).toEqual(snapshot);
    await expect(generateSiteCorrections(source,async()=>response())).rejects.toThrow("technical or scope change");
    source.issues=[issue({repairability:"scope"})];
    await expect(generateSiteCorrections(source,async()=>response())).rejects.toThrow("technical or scope change");
  });
  it("accounts for every finding and rejects unknown, omitted, duplicate or contradictory accounting",async()=>{
    const source=input();source.issues.push(issue({message:"The existing contact field requires a new integration.",repairability:"scope"}));
    const unresolved={issueId:"issue-2",reason:"A live integration is outside this approved preview."};
    const result=await generateSiteCorrections(source,async()=>response({patches:[patch],unresolved:[unresolved]}));
    expect(result.addressedIssueIds).toEqual(["issue-1"]);expect(result.unresolved).toEqual([unresolved]);
    for(const value of [
      {patches:[patch],unresolved:[]},
      {patches:[{...patch,issueIds:["issue-3"]}],unresolved:[unresolved]},
      {patches:[{...patch,issueIds:["issue-1","issue-1"]}],unresolved:[unresolved]},
      {patches:[patch],unresolved:[unresolved,unresolved]},
      {patches:[patch],unresolved:[unresolved,{issueId:"issue-1",reason:"The content was not actually changed."}]},
    ])await expect(generateSiteCorrections(source,async()=>response(value))).rejects.toThrow();
  });
  it("keeps explicit targets exact and permits multiple sections only for page-wide or shared findings",async()=>{
    const source=input();source.issues=[issue({sectionId:"options",repairability:"content"})];
    await expect(generateSiteCorrections(source,async()=>response())).resolves.toMatchObject({changed:true});
    const faq={...patch,target:{...patch.target,sectionId:"choosing"}};
    await expect(generateSiteCorrections(source,async()=>response({patches:[faq],unresolved:[]}))).rejects.toThrow("finding's page and section");
    source.issues=[issue({sectionId:null,repairability:"content"})];
    await expect(generateSiteCorrections(source,async()=>response({patches:[patch,faq],unresolved:[]}))).resolves.toMatchObject({addressedIssueIds:["issue-1"]});
    const intro={...patch,target:{pagePath:"index.html",sectionId:"__intro__"},content:{...patch.content,layout:null}};
    await expect(generateSiteCorrections(source,async()=>response({patches:[intro],unresolved:[]}))).rejects.toThrow("finding's page and section");
    source.issues=[issue({page:"all"})];
    await expect(generateSiteCorrections(source,async()=>response({patches:[patch,intro],unresolved:[]}))).resolves.toMatchObject({changed:true});
  });
  it("rejects nonexistent and duplicate targets or unsupported fields without partial mutation",async()=>{
    const source=input(),snapshot=structuredClone(source.previousBlueprint);
    for(const value of [
      {patches:[patch,{...patch,content:{...patch.content,body:"Another edit of the same section."}}],unresolved:[]},
      {patches:[{...patch,target:{...patch.target,sectionId:"missing"}}],unresolved:[]},
      {patches:[{...patch,target:{...patch.target,pagePath:"../index.html"}}],unresolved:[]},
      ...["forms","actions","contact","design","media","pages","css"].map(key=>({patches:[{...patch,content:{...patch.content,[key]:[]}}],unresolved:[]})),
      {patches:[patch],unresolved:[],blueprint:snapshot},
    ]){
      await expect(generateSiteCorrections(source,async()=>response(value))).rejects.toThrow();
      expect(source.previousBlueprint).toEqual(snapshot);
    }
    source.issues=[issue({page:"all"})];
    await expect(generateSiteCorrections(source,async()=>response({patches:[{...patch,target:{pagePath:"missing/index.html",sectionId:"__intro__"},content:{...patch.content,layout:null}}],unresolved:[]}))).rejects.toThrow("Choose a page");
  });
  it("rejects unchanged patches instead of counting a fake correction",async()=>{
    const source=input(),section=source.previousBlueprint.pages[2].sections[0];
    for(const content of [{headline:section.title,body:section.body,layout:null,items:null},{headline:section.title,body:section.body,layout:section.layout,items:section.items}]){
      await expect(generateSiteCorrections(source,async()=>response({patches:[{...patch,content}],unresolved:[]}))).rejects.toThrow("unchanged section");
    }
  });
  it("preserves provided photos, logos, bindings, forms, routes and linked item destinations",async()=>{
    const source=input(),blueprint=source.previousBlueprint;
    blueprint.media=[{id:"brand-logo",role:"logo",source:"provided",uploadId:"upload-logo",prompt:"",alt:"Approved synthetic business logo",caption:""},{id:"project-photo",role:"photo",source:"provided",uploadId:"upload-photo",prompt:"",alt:"Approved supplied project illustration",caption:""}];
    blueprint.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:"brand-logo",pageImages:[],sectionImages:[{pagePath:patch.target.pagePath,sectionId:"options",itemIndex:1,assetId:"project-photo"}]};
    source.assets=[{id:"upload-logo",path:"assets/provided-logo.png",alt:"Supplied logo",provenance:"provided",role:"logo"},{id:"upload-photo",path:"assets/provided-photo.png",alt:"Supplied photo",provenance:"provided",role:"photo"}];
    blueprint.interactions!.actions.push({pagePath:patch.target.pagePath,sectionId:"options",itemIndex:0,label:"Discuss the process",targetPage:"approach/index.html",targetSection:null});
    blueprint.pages[1].sections.push({id:"inquiry",kind:"contact",layout:"band",eyebrow:"Get in touch",title:"Explore your next step.",body:"A demonstration inquiry.",items:[]});
    blueprint.interactions!.forms.push({pagePath:"approach/index.html",sectionId:"inquiry",fields:["name","email","message"],submitLabel:"Preview inquiry"});
    const snapshot=structuredClone(blueprint),items=blueprint.pages[2].sections[0].items.map(item=>({...item,body:`${item.body} Explore the same proposed approach in context.`}));
    const result=await generateSiteCorrections(source,async()=>response({patches:[{...patch,content:{...patch.content,items}}],unresolved:[]}));
    for(const key of ["design","media","presentation","interactions","contact","heroImage","factualClaims","productionTasks","assumptions"] as const)expect(result.blueprint[key]).toEqual(snapshot[key]);
    expect(result.blueprint.pages.map(page=>[page.path,page.sections.map(section=>section.id)])).toEqual(snapshot.pages.map(page=>[page.path,page.sections.map(section=>section.id)]));
    await expect(generateSiteCorrections(source,async()=>response({patches:[{...patch,content:{...patch.content,items:items.slice(1)}}],unresolved:[]}))).rejects.toThrow("number and order");
    expect(blueprint).toEqual(snapshot);
  });
  it("supplies bounded screenshot evidence and replays the same raw response without image payloads",async()=>{
    const source=input(),bytes=await sharp({create:{width:390,height:2200,channels:3,background:"#28465f"}}).png().toBuffer(),raw=response();
    const execute=vi.fn(async(_request:SiteModelRequest)=>raw);
    const result=await generateSiteCorrections({...source,repairScreenshots:[{page:patch.target.pagePath,viewport:"mobile",bytes,regions:[{id:"options",top:800,height:1200}]}]},execute);
    const request=execute.mock.calls[0][0],content=(request.body.input as Array<{content:Array<{type:string;text?:string;image_url?:string}>}>)[0].content;
    const images=content.filter(item=>item.type==="input_image"),imageBytes=images.reduce((total,image)=>total+Buffer.from(image.image_url!.split(",")[1],"base64").length,0);
    expect(images).toHaveLength(2);expect(content.some(item=>item.text?.includes("readable section (options)"))).toBe(true);
    expect(request.reservedMicros).toBe(factoryUsageCost(request.inputBytes-imageBytes+8192+images.length*32768,6000,0));
    const replay=await generateSiteCorrections(source,async()=>raw);
    expect(replay).toEqual(result);
  });
  it("bounds targets, findings and context before calling a provider",async()=>{
    const execute=vi.fn(),source=input();
    for(const issues of [[],Array.from({length:21},()=>issue()),[issue({page:"missing/index.html"})],[issue({sectionId:"missing"})],[issue({message:"x".repeat(2001)})]]){
      await expect(generateSiteCorrections({...source,issues},execute)).rejects.toThrow();
    }
    await expect(generateSiteCorrections({...source,plan:{...source.plan,summary:"x".repeat(siteCorrectionLimits.contextBytes)}},execute)).rejects.toThrow("bounded request");
    expect(execute).not.toHaveBeenCalled();
  });
  it("rejects excessive batches, output, incomplete responses, tools and refusals without retry",async()=>{
    for(const raw of [
      response({patches:Array.from({length:13},()=>patch),unresolved:[]}),
      response({patches:[{...patch,content:{...patch.content,body:"x".repeat(siteCorrectionLimits.responseBytes)}}],unresolved:[]}),
      {...response(),status:"incomplete",incomplete_details:{reason:"max_output_tokens"}},
      {...response(),output:[{type:"web_search_call"}]},
      {...response(),output:[{type:"message",content:[{type:"refusal",text:"private provider refusal"}]}]},
      {...response(),output:[{type:"message",content:[{type:"output_text",text:"private invalid JSON"}]}]},
    ]){
      const execute=vi.fn(async()=>raw);let message="";
      try{await generateSiteCorrections(input(),execute);}catch(error){message=(error as Error).message;}
      expect(message).not.toBe("");expect(message).not.toContain("private");expect(execute).toHaveBeenCalledOnce();
    }
    const execute=vi.fn().mockRejectedValue(new Error("Synthetic transport failure"));
    await expect(generateSiteCorrections(input(),execute)).rejects.toThrow("Synthetic transport failure");expect(execute).toHaveBeenCalledOnce();
  });
});
