import {describe,expect,it,vi} from "vitest";
import sharp from "sharp";
vi.mock("server-only",()=>({}));
import {generatePortableSite,siteUsage} from "./provider";
import {fixtureBlueprint,fixtureSitePlan} from "./fixtures";
import {validateSiteBlueprint} from "./validate";
import type {SiteModelRequest} from "./types";
import {websiteQualityStandards} from "../website-standards";
import {factoryUsageCost} from "../config";
import type {FactoryDesignRecipe} from "../types";
const response=(blueprint:unknown,status="completed")=>({id:"resp_synthetic_site",status,usage:{input_tokens:4000,output_tokens:2000},output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(blueprint)}]}]});

describe("Portable site provider (synthetic responses only)",()=>{
  it("requests a bounded strict blueprint with no execution tools or HTML",async()=>{
    const execute=vi.fn(async(_request:SiteModelRequest)=>response(fixtureBlueprint()));
    const result=await generatePortableSite({plan:fixtureSitePlan},execute);
    expect(result.bundle.imageSlots).toHaveLength(1);expect(result.usage.estimatedMicros).toBeGreaterThan(0);
    const request=execute.mock.calls[0][0];expect(request.body).toMatchObject({model:"gpt-6.1-sol",store:false,max_output_tokens:12000,text:{format:{type:"json_schema",name:"factory_site_blueprint",strict:true}}});
    expect(request.body.tools).toBeUndefined();expect(request.reservedMicros).toBeGreaterThan(result.usage.estimatedMicros);expect(request.body.instructions).toContain("untrusted data");expect(request.body.instructions).toContain("possible matches and assumptions are not established facts");
    expect(request.body.instructions).toContain(websiteQualityStandards);
    const body=request.body as {instructions:string;input:Array<{content:string}>;text:{format:{schema:unknown}}};
    expect(request.inputBytes).toBe(Buffer.byteLength(body.input[0].content)+Buffer.byteLength(body.instructions)+Buffer.byteLength(JSON.stringify(body.text.format.schema)));
    expect(request.reservedMicros).toBe(factoryUsageCost(request.inputBytes+8192,12000,0));
  });
  it("treats sparse/fake details as valid while rejecting invented contact facts",()=>{
    const blueprint=fixtureBlueprint();expect(validateSiteBlueprint(blueprint,fixtureSitePlan).contact.email).toBeNull();
    blueprint.contact.email="made-up@example.test";expect(()=>validateSiteBlueprint(blueprint,fixtureSitePlan)).toThrow("Contact details");
    const plan={...fixtureSitePlan,knownDetails:[{label:"Email",value:"made-up@example.test",basis:"possible_match" as const,sourceIds:[]}]};expect(()=>validateSiteBlueprint(blueprint,plan)).toThrow();
    plan.knownDetails[0].basis="submitted" as never;expect(validateSiteBlueprint(blueprint,plan).contact.email).toBe("made-up@example.test");
  });
  it("keeps the approved recipe over inferred industry and a different generated direction",async()=>{
    const recipe:FactoryDesignRecipe={version:1,family:"professional",composition:"minimal",fontTheme:"technical",density:"compact",radius:"square"};
    const plan={...fixtureSitePlan,design:{...fixtureSitePlan.design,recipe}};
    const result=await generatePortableSite({plan,family:"trades"},async request=>{
      const context=JSON.parse((request.body.input as Array<{content:string}>)[0].content);
      expect(context.family).toBe("professional");expect(context.approvedDesignConstraints.recipe).toEqual(recipe);
      expect(context.familySelection).toEqual({source:"approved-recipe",binding:true});
      expect(context.rendererCapabilities.families.professional.compositions).toContain("minimal");
      return response(fixtureBlueprint());
    });
    expect(result.blueprint).toMatchObject({family:"professional",composition:"minimal",presentation:{fontTheme:"technical"},design:{density:"compact",radius:"square"}});
    expect(result.blueprint.pages).toEqual(fixtureBlueprint().pages);
    expect(result.blueprint.contact).toEqual(fixtureBlueprint().contact);
  });
  it("keeps candidate industry hints nonbinding and sends only relevant family defaults",async()=>{
    const plan={...structuredClone(fixtureSitePlan),goal:"A first website",audience:"Future visitors",knownDetails:[{label:"Possible match",value:"A spa with a similar name",basis:"possible_match" as const,sourceIds:["source-1"]}]};
    await generatePortableSite({plan},async request=>{
      const context=JSON.parse((request.body.input as Array<{content:string}>)[0].content);
      expect(context.family).toBe("general");expect(context.familySelection).toEqual({source:"inferred-hint",binding:false});
      expect(context.designFamilies).toBeUndefined();expect(context.familyDefaults.name).toBe("Room to grow");
      expect(context.rendererCapabilities.families.trades.compositions).toContain("immersive");
      expect(context.qualityBenchmark.weakExample).toBeUndefined();expect(context.qualityBenchmark.strongerExample).toBeUndefined();
      // A different supported artistic family is valid; a hint is not approval.
      return response(fixtureBlueprint("professional","minimal"));
    });
  });
  it("rejects invalid paths, duplicate ids, unsupported compositions and claims",()=>{
    for(const path of ["../secret.html","https://evil.test/","/index.html","a/b/index.html"]){const b=fixtureBlueprint();b.pages[0].path=path;expect(()=>validateSiteBlueprint(b,fixtureSitePlan)).toThrow();}
    const duplicate=fixtureBlueprint();duplicate.pages[0].sections[2].id="services-heading";expect(()=>validateSiteBlueprint(duplicate,fixtureSitePlan)).toThrow("duplicate");
    const composition=fixtureBlueprint();composition.composition="minimal";expect(()=>validateSiteBlueprint(composition,fixtureSitePlan)).toThrow("compositions");
    const claim=fixtureBlueprint();claim.factualClaims=[{text:"Licensed for 30 years",detailIndex:0}];expect(()=>validateSiteBlueprint(claim,fixtureSitePlan)).toThrow("not supported");
  });
  it("reuses the initial image during the single bounded repair",async()=>{
    const previous=fixtureBlueprint(),next=fixtureBlueprint();next.heroImage.prompt="A different image that should not create another charge.";
    const result=await generatePortableSite({plan:fixtureSitePlan,previousBlueprint:previous,repairIssues:[{code:"overflow",message:"Long heading",page:"index.html",severity:"error"}]},async request=>{expect(request.stage).toBe("repair");return response(next);});
    expect(result.blueprint.heroImage).toEqual(previous.heroImage);
  });
  it("repairs with actual failing-page screenshots and reserves their input before the single request",async()=>{
    const previous=fixtureBlueprint("trades","split",true),bytes=await sharp({create:{width:390,height:2400,channels:3,background:"#163c50"}}).png().toBuffer();
    const issue={code:"review_quality_copy",message:"Shorten the options section introduction.",page:"services/index.html",severity:"error" as const};
    const execute=vi.fn(async(_request:SiteModelRequest)=>response(previous));
    await generatePortableSite({plan:fixtureSitePlan,previousBlueprint:previous,repairIssues:[issue],repairScreenshots:[
      {page:"index.html",viewport:"mobile",bytes:new Uint8Array([0])}, // Unaffected pages must not enter the request.
      {page:issue.page,viewport:"mobile",bytes,regions:[{id:"options",top:850,height:900}]},
    ]},execute);
    expect(execute).toHaveBeenCalledOnce();
    const request=execute.mock.calls[0][0],content=(request.body.input as Array<{content:Array<{type:string;text?:string;image_url?:string;detail?:string}>}>)[0].content;
    const images=content.filter(item=>item.type==="input_image");expect(images).toHaveLength(2);
    expect(content.some(item=>item.text?.includes("readable section (options) detail; cropped rows 850–1850"))).toBe(true);
    let imageBytes=0;
    for(const image of images){
      expect(image.detail).toBe("high");expect(image.image_url).toMatch(/^data:image\/jpeg;base64,/);
      const bytes=Buffer.from(image.image_url!.split(",")[1],"base64");imageBytes+=bytes.length;
      expect((await sharp(bytes).metadata()).format).toBe("jpeg");
    }
    expect(request.reservedMicros).toBe(factoryUsageCost(request.inputBytes-imageBytes+8192+images.length*32768,12000,0));
    // A saved paid response remains recoverable without retaining image payloads.
    expect((await generatePortableSite({plan:fixtureSitePlan,previousBlueprint:previous,repairIssues:[issue]},async()=>response(previous))).blueprint).toEqual(previous);
  });
  it("rejects invalid selected correction screenshots before making any paid request",async()=>{
    const execute=vi.fn(),previous=fixtureBlueprint(),issue={code:"review_design",message:"Correct the introduction.",page:"index.html",severity:"error" as const};
    await expect(generatePortableSite({plan:fixtureSitePlan,previousBlueprint:previous,repairIssues:[issue],repairScreenshots:[{page:"index.html",viewport:"desktop",bytes:new Uint8Array(12_000_001)}]},execute)).rejects.toThrow("source screenshot exceeds");
    await expect(generatePortableSite({plan:fixtureSitePlan,previousBlueprint:previous,repairIssues:[issue],repairScreenshots:[{page:"index.html",viewport:"desktop",bytes:new Uint8Array([1,2,3])}]},execute)).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
  it("rejects excessive input before a billable call and never retries executor errors",async()=>{
    const execute=vi.fn().mockRejectedValue(new Error("Synthetic transport interruption"));
    await expect(generatePortableSite({plan:{...fixtureSitePlan,summary:"x".repeat(130001)}},execute)).rejects.toThrow("bounded request");expect(execute).not.toHaveBeenCalled();
    await expect(generatePortableSite({plan:fixtureSitePlan},execute)).rejects.toThrow("Synthetic transport interruption");expect(execute).toHaveBeenCalledOnce();
  });
  it("requires a completed response with usage and forbids provider tool calls",async()=>{
    await expect(generatePortableSite({plan:fixtureSitePlan},async()=>response(fixtureBlueprint(),"incomplete"))).rejects.toThrow("did not complete");
    await expect(generatePortableSite({plan:fixtureSitePlan},async()=>({...response(fixtureBlueprint()),output:[{type:"web_search_call"}]}))).rejects.toThrow("external tools");
    expect(()=>siteUsage({id:"bad",status:"completed",output:[]})).toThrow();
  });
  it("reports useful validation errors without exposing returned values",async()=>{
    const invalid=fixtureBlueprint();invalid.interactions!.forms=[{pagePath:"index.html",sectionId:"missing",fields:["name"],submitLabel:"Preview"}];
    await expect(generatePortableSite({plan:fixtureSitePlan},async()=>response(invalid))).rejects.toThrow("A form references a missing, duplicate or non-contact section");
    const badField={...fixtureBlueprint(),fontPair:"private-provider-value"};
    let message="";try{await generatePortableSite({plan:fixtureSitePlan},async()=>response(badField));}catch(error){message=(error as Error).message;}
    expect(message).toContain("fontPair");expect(message).not.toContain("private-provider-value");
    await expect(generatePortableSite({plan:fixtureSitePlan},async()=>({...response(fixtureBlueprint(),"incomplete"),incomplete_details:{reason:"max_output_tokens"}}))).rejects.toThrow("output limit");
    await expect(generatePortableSite({plan:fixtureSitePlan},async()=>({...response(fixtureBlueprint()),output:[{type:"message",content:[{type:"refusal",refusal:"private refusal detail"}]}]}))).rejects.toThrow("AI declined");
  });
});
