import sharp from "sharp";
import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {factoryUsageCost} from "../config";
import {websiteQualityStandards} from "../website-standards";
import {generateSiteDraftRevision} from "./draft-provider";
import {fixtureBlueprint,fixtureSitePlan} from "./fixtures";
import type {SiteDraftContent} from "./draft";
import type {SiteModelRequest} from "./types";

const patch:SiteDraftContent={headline:"Find a useful starting point.",body:"Explore a clear path from your first idea to the next decision.",layout:null,items:null};
const response=(value:unknown=patch)=>({id:"resp_synthetic_draft",status:"completed",usage:{input_tokens:5000,output_tokens:300},output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(value)}]}]});
function input(){return {plan:fixtureSitePlan,previousBlueprint:fixtureBlueprint("trades","split",true),target:{pagePath:"services/index.html",sectionId:"options"},instruction:"Make the opening concise and specific."};}

describe("Scoped website draft provider (mocked responses only)",()=>{
  it("requests only a content patch and preserves all other pages, integrations and image identities",async()=>{
    const source=input(),snapshot=structuredClone(source.previousBlueprint),execute=vi.fn(async(_request:SiteModelRequest)=>response());
    const result=await generateSiteDraftRevision(source,execute),expected=structuredClone(snapshot);
    expected.pages[2].sections[0].title=patch.headline;expected.pages[2].sections[0].body=patch.body;
    expect(result.blueprint).toEqual(expected);expect(source.previousBlueprint).toEqual(snapshot);
    expect(result.bundle.blueprint).toEqual(result.blueprint);expect(result.usage.providerId).toBe("resp_synthetic_draft");
    expect(execute).toHaveBeenCalledOnce();const request=execute.mock.calls[0][0];
    expect(request.stage).toBe("generate");expect(request.body.tools).toBeUndefined();expect(request.body.instructions).toContain(websiteQualityStandards);
    expect(request.body).toMatchObject({model:"gpt-6.1-sol",store:false,max_output_tokens:6000,text:{format:{name:"factory_site_draft_patch",strict:true}}});
    const schema=(request.body.text as {format:{schema:{properties:Record<string,unknown>}}}).format.schema;
    expect(Object.keys(schema.properties).sort()).toEqual(["body","headline","items","layout"]);
    expect(request.reservedMicros).toBe(factoryUsageCost(request.inputBytes+8192,6000,0));
  });
  it("supplies selected-page screenshot context and replays saved raw patches without image persistence",async()=>{
    const source=input(),bytes=await sharp({create:{width:390,height:2200,channels:3,background:"#28465f"}}).png().toBuffer();
    const execute=vi.fn(async(_request:SiteModelRequest)=>response());
    const result=await generateSiteDraftRevision({...source,repairScreenshots:[{page:source.target.pagePath,viewport:"mobile",bytes,regions:[{id:"options",top:800,height:1200}]}]},execute);
    const request=execute.mock.calls[0][0],content=(request.body.input as Array<{content:Array<{type:string;text?:string;image_url?:string}>}>)[0].content;
    const images=content.filter(item=>item.type==="input_image"),imageBytes=images.reduce((total,image)=>total+Buffer.from(image.image_url!.split(",")[1],"base64").length,0);
    expect(images).toHaveLength(2);expect(content.some(item=>item.text?.includes("readable section (options)"))).toBe(true);
    expect(request.reservedMicros).toBe(factoryUsageCost(request.inputBytes-imageBytes+8192+images.length*32768,6000,0));
    expect((await generateSiteDraftRevision(source,async()=>response())).blueprint).toEqual(result.blueprint);
  });
  it("makes hero edits without allowing another layout, items, forms, page or contact fields",async()=>{
    const source={...input(),target:{pagePath:"index.html",sectionId:"__intro__"}},previous=source.previousBlueprint;
    const result=await generateSiteDraftRevision(source,async()=>response());
    expect(result.blueprint.pages[0].hero).toEqual({...previous.pages[0].hero,headline:patch.headline,body:patch.body});
    for(const value of [{...patch,layout:"rows"},{...patch,items:[]},{...patch,contact:{phone:"+15555550123"}},{...patch,pages:[]},{...patch,forms:[]}]){
      await expect(generateSiteDraftRevision(source,async()=>response(value))).rejects.toThrow("invalid website edit");
    }
  });
  it("preserves item counts for linked sections and rejects a response that would retarget their actions",async()=>{
    const source=input();source.previousBlueprint.interactions!.actions.push({pagePath:source.target.pagePath,sectionId:"options",itemIndex:0,label:"Discuss the process",targetPage:"approach/index.html",targetSection:null});
    const items=structuredClone(source.previousBlueprint.pages[2].sections[0].items),execute=vi.fn(async(_request:SiteModelRequest)=>response({...patch,items:items.slice(1)}));
    await expect(generateSiteDraftRevision(source,execute)).rejects.toThrow("invalid website edit");
    const changed=await generateSiteDraftRevision(source,async()=>response({...patch,items:items.map(item=>({...item,body:"A concise description of this same service concept."}))}));
    expect(changed.blueprint.interactions).toEqual(source.previousBlueprint.interactions);
    expect(changed.blueprint.pages[2].sections[0].items).toHaveLength(items.length);
  });
  it("keeps an actual content section named hero separate from the page introduction",async()=>{
    const source=input();source.previousBlueprint.pages[2].sections[0].id="hero";source.target.sectionId="hero";
    const result=await generateSiteDraftRevision(source,async()=>response({...patch,layout:"rows"}));
    expect(result.blueprint.pages[2].hero).toEqual(source.previousBlueprint.pages[2].hero);
    expect(result.blueprint.pages[2].sections[0]).toMatchObject({id:"hero",title:patch.headline,layout:"rows"});
  });
  it("rejects nonexistent targets, excessive directions and context before a billable request",async()=>{
    const execute=vi.fn(),source=input();
    await expect(generateSiteDraftRevision({...source,target:{pagePath:"missing/index.html",sectionId:"__intro__"}},execute)).rejects.toThrow("Choose a page");
    await expect(generateSiteDraftRevision({...source,target:{...source.target,sectionId:"missing"}},execute)).rejects.toThrow("Choose a section");
    await expect(generateSiteDraftRevision({...source,instruction:"x".repeat(2001)},execute)).rejects.toThrow();
    await expect(generateSiteDraftRevision({...source,plan:{...source.plan,summary:"x".repeat(130001)}},execute)).rejects.toThrow("bounded request");
    expect(execute).not.toHaveBeenCalled();
  });
  it("rejects tool use, refusals and incomplete responses, without automatic retries or provider-value leaks",async()=>{
    for(const raw of [{...response(),status:"incomplete"},{...response(),output:[{type:"web_search_call"}]},{...response(),output:[{type:"message",content:[{type:"refusal",text:"private provider content"}]}]},response({...patch,headline:"private text",layout:"not-supported"})]){
      const execute=vi.fn(async()=>raw);
      let message="";try{await generateSiteDraftRevision(input(),execute);}catch(error){message=(error as Error).message;}
      expect(message).not.toBe("");expect(message).not.toContain("private");expect(execute).toHaveBeenCalledOnce();
    }
    const execute=vi.fn().mockRejectedValue(new Error("Synthetic transport failure"));
    await expect(generateSiteDraftRevision(input(),execute)).rejects.toThrow("Synthetic transport failure");expect(execute).toHaveBeenCalledOnce();
  });
});
