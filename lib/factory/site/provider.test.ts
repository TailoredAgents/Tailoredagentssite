import {describe,expect,it,vi} from "vitest";
import sharp from "sharp";
vi.mock("server-only",()=>({}));
import {generatePortableSite,siteUsage} from "./provider";
import {fixtureBlueprint,fixtureSitePlan} from "./fixtures";
import {validateSiteBlueprint} from "./validate";
import type {SiteAssetDescriptor,SiteAssetEvidence,SiteBlueprint,SiteModelRequest} from "./types";
import {assetEvidenceLimits} from "./asset-evidence";
import {websiteQualityStandards} from "../website-standards";
import {factoryUsageCost} from "../config";
import type {FactoryDesignRecipe} from "../types";
const response=(blueprint:unknown,status="completed")=>({id:"resp_synthetic_site",status,usage:{input_tokens:4000,output_tokens:2000},output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(blueprint)}]}]});
function visualBlueprint(uploadId:string|null):SiteBlueprint{const blueprint=fixtureBlueprint();blueprint.heroImage.uploadId=uploadId;blueprint.media=[];blueprint.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[],imageFocalPoints:[{assetId:"hero",desktop:{x:35,y:45},mobile:{x:65,y:50}}]};return blueprint;}
const approvedPhotos:SiteAssetDescriptor[]=["first","second"].map((id,index)=>({id,path:`approved-reference-${index}.png`,alt:"Approved photo",provenance:"provided",role:"photo"}));

describe("Portable site provider (synthetic responses only)",()=>{
  it("selects a suitable second photo using bounded visual context within the original paid request",async()=>{
    const bytes=await sharp({create:{width:640,height:280,channels:3,background:"#345678"}}).jpeg().toBuffer();
    const evidence:SiteAssetEvidence={references:approvedPhotos.map((item,index)=>({id:item.id,reference:`A${index+1}`,role:"photo",width:1200,height:800,sha256:String(index).repeat(64)})),images:[{bytes,label:"Approved image references A1–A2"}]};
    const execute=vi.fn(async(_request:SiteModelRequest)=>response(visualBlueprint("second")));
    const result=await generatePortableSite({plan:fixtureSitePlan,assets:approvedPhotos,imageSelection:"visual-v1",assetEvidence:evidence},execute);
    expect(execute).toHaveBeenCalledOnce();expect(result.blueprint.heroImage.uploadId).toBe("second");expect(result.blueprint.presentation!.imageFocalPoints).toEqual(visualBlueprint("second").presentation!.imageFocalPoints);
    const request=execute.mock.calls[0][0],content=(request.body.input as Array<{content:Array<{type:string;text?:string;image_url?:string;detail?:string}>}>)[0].content;
    const context=JSON.parse(content[0].text!);expect(context.imageSelection).toBe("visual-v1");expect(context.assetReferences).toEqual(evidence.references);
    const images=content.filter(item=>item.type==="input_image");expect(images).toHaveLength(1);expect(images[0]).toMatchObject({detail:"high",image_url:`data:image/jpeg;base64,${bytes.toString("base64")}`});
    expect(request.stage).toBe("generate");expect(request.body.tools).toBeUndefined();
    expect(request.reservedMicros).toBe(factoryUsageCost(request.inputBytes-bytes.length+8192+assetEvidenceLimits.imageTokens,12000,0));
  });

  it("requires explicit hero selection and crop data for fresh visual-policy builds but accepts old saved responses",async()=>{
    for(const field of ["selection","crops"]){
      const blueprint=visualBlueprint(null);if(field==="selection")delete blueprint.heroImage.uploadId;else delete blueprint.presentation!.imageFocalPoints;
      await expect(generatePortableSite({plan:fixtureSitePlan,imageSelection:"visual-v1"},async()=>response(blueprint))).rejects.toThrow(field==="selection"?"heroImage.uploadId":"presentation.imageFocalPoints");
    }
    const legacy=fixtureBlueprint();expect((await generatePortableSite({plan:fixtureSitePlan},async()=>response(legacy))).blueprint.heroImage).toEqual(legacy.heroImage);
    expect((await generatePortableSite({plan:fixtureSitePlan,imageSelection:"visual-v1"},async()=>response(visualBlueprint(null)))).blueprint.heroImage.uploadId).toBeNull();
  });

  it("keeps historical selection and crops unchanged when a new model returns new-policy fields",async()=>{
    const result=await generatePortableSite({plan:fixtureSitePlan,assets:approvedPhotos,assetEvidence:{references:[],images:[{bytes:new Uint8Array(600000),label:"Must not be sent for historical input"}]}},async request=>{
      const context=JSON.parse((request.body.input as Array<{content:string}>)[0].content);
      expect(context.imageSelection).toBe("legacy-first-photo");expect(context.assetReferences).toEqual([]);
      return response(visualBlueprint("second"));
    });
    expect(result.blueprint.heroImage).not.toHaveProperty("uploadId");expect(result.blueprint.presentation).not.toHaveProperty("imageFocalPoints");
  });

  it("rejects unapproved hero choices, mismatched logo roles and invalid crop references",()=>{
    const logo:SiteAssetDescriptor={id:"approved-logo",path:"logo.png",alt:"Approved logo",provenance:"provided",role:"logo"};
    for(const id of ["another-project","approved-logo"]){expect(()=>validateSiteBlueprint(visualBlueprint(id),fixtureSitePlan,[...approvedPhotos,logo])).toThrow("approved photo");}
    for(const assetIds of [["missing"],["brand"],["hero","hero"]]){
      const blueprint=visualBlueprint("second");blueprint.media=[{id:"brand",role:"logo",source:"provided",uploadId:logo.id,prompt:"",alt:"Business logo",caption:"Team-provided logo"}];blueprint.presentation!.logoAssetId="brand";
      blueprint.presentation!.imageFocalPoints=assetIds.map(assetId=>({assetId,desktop:{x:50,y:50},mobile:{x:50,y:50}}));
      expect(()=>validateSiteBlueprint(blueprint,fixtureSitePlan,[...approvedPhotos,logo])).toThrow("unique photo assets");
    }
    const invalid=visualBlueprint("second");invalid.presentation!.imageFocalPoints![0].mobile.x=101;
    expect(()=>validateSiteBlueprint(invalid,fixtureSitePlan,approvedPhotos)).toThrow();
  });

  it("keeps the paid selected hero during repair while allowing its crop and descriptions to improve",async()=>{
    const previous=visualBlueprint("second"),next=visualBlueprint("first");next.heroImage.prompt="A different image that must not cause replacement or another charge.";next.heroImage.alt="Clearer description of the approved workshop photo";next.presentation!.imageFocalPoints![0].mobile.x=80;
    const execute=vi.fn(async(_request:SiteModelRequest)=>response(next));
    const result=await generatePortableSite({plan:fixtureSitePlan,assets:approvedPhotos,imageSelection:"visual-v1",previousBlueprint:previous,repairIssues:[{code:"imagery",message:"Improve the mobile photo crop.",page:"index.html",severity:"error"}],assetEvidence:{references:[],images:[{bytes:new Uint8Array(600000),label:"Must not re-select approved images during repair"}]}},execute);
    expect(execute).toHaveBeenCalledOnce();expect(result.blueprint.heroImage).toMatchObject({uploadId:"second",prompt:previous.heroImage.prompt,alt:next.heroImage.alt});expect(result.blueprint.presentation!.imageFocalPoints![0].mobile.x).toBe(80);
    const context=JSON.parse((execute.mock.calls[0][0].body.input as Array<{content:string}>)[0].content);expect(context.imageSelection).toBe("preserve-saved");expect(context.assetReferences).toEqual([]);
  });

  it("does not silently give historical saved imagery a new selection or crop policy during repair",async()=>{
    for(const oldPresentation of [false,true]){
      const previous=fixtureBlueprint();if(oldPresentation){previous.presentation={version:1,fontTheme:"studio",heroEmphasis:null,logoAssetId:null,pageImages:[],sectionImages:[]};}
      const next=visualBlueprint("second");next.presentation!.imageFocalPoints!.push({assetId:"imagined-photo",desktop:{x:25,y:50},mobile:{x:75,y:50}});
      const result=await generatePortableSite({plan:fixtureSitePlan,assets:approvedPhotos,previousBlueprint:previous,repairIssues:[{code:"copy",message:"Improve the heading.",page:"index.html",severity:"error"}]},async()=>response(next));
      expect(result.blueprint.heroImage).not.toHaveProperty("uploadId");expect(result.blueprint.presentation).not.toHaveProperty("imageFocalPoints");
    }
  });

  it("rejects foreign or oversized visual evidence before incurring provider charges",async()=>{
    const execute=vi.fn(),reference={id:"foreign",reference:"A1",role:"photo" as const,width:100,height:100,sha256:"a".repeat(64)};
    await expect(generatePortableSite({plan:fixtureSitePlan,assets:approvedPhotos,imageSelection:"visual-v1",assetEvidence:{references:[reference],images:[]}},execute)).rejects.toThrow("unapproved");
    await expect(generatePortableSite({plan:fixtureSitePlan,assets:approvedPhotos,imageSelection:"visual-v1",assetEvidence:{references:[],images:[{bytes:new Uint8Array(assetEvidenceLimits.sheetBytes+1),label:"Photos"}]}},execute)).rejects.toThrow("request limits");
    expect(execute).not.toHaveBeenCalled();
  });
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
