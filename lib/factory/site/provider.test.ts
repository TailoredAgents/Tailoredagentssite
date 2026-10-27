import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {generatePortableSite,siteUsage} from "./provider";
import {fixtureBlueprint,fixtureSitePlan} from "./fixtures";
import {validateSiteBlueprint} from "./validate";
import type {SiteModelRequest} from "./types";
import {websiteQualityStandards} from "../website-standards";
import {factoryUsageCost} from "../config";
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
