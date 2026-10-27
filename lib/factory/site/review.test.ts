import {randomBytes} from "node:crypto";
import sharp from "sharp";
import {beforeAll,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {factoryModelPolicy,factoryUsageCost} from "../config";
import type {SiteQaResult} from "./artifacts";
import {fixtureBlueprint,fixtureSitePlan} from "./fixtures";
import {reviewPortableSite,parseSiteReview,SiteReviewResponseError,type SiteScorecard} from "./review";
import {siteQualityRubric} from "./benchmarks";
import type {SiteModelRequest} from "./types";

let desktop:Buffer,mobile:Buffer;
beforeAll(async()=>{
  desktop=await sharp({create:{width:2000,height:1200,channels:3,background:"#15374a"}}).png().toBuffer();
  mobile=await sharp({create:{width:390,height:3000,channels:4,background:"#c6e8ef"}}).png().toBuffer();
});
const passingScorecard=()=>Object.fromEntries(Object.keys(siteQualityRubric.dimensions).map(key=>[key,{score:88,evidence:[{page:"index.html",observation:"Synthetic fixture evidence for a deliberately composed and legible section."}],improvement:"Optional: tighten the closing section spacing while preserving its hierarchy."}])) as SiteScorecard;
const response=(result:Record<string,unknown>={verdict:"pass",summary:"The approved concept is coherent and legible.",issues:[]})=>({id:"synthetic-review",status:"completed",usage:{input_tokens:1000,output_tokens:500},output:[{type:"message",content:[{type:"output_text",text:JSON.stringify({scorecard:passingScorecard(),...result})}]}]});
function input(multiplePages=false){
  const blueprint=fixtureBlueprint("trades","split",multiplePages);
  const screenshots:SiteQaResult["screenshots"]=blueprint.pages.flatMap(page=>[{page:page.path,viewport:"desktop" as const,bytes:desktop},{page:page.path,viewport:"mobile" as const,bytes:mobile}]);
  return {plan:fixtureSitePlan,blueprint,screenshots};
}

describe("Website visual/content review (local images and mocked provider only)",()=>{
  it("preserves saved legacy reports but requires an evidence-backed scorecard for new paid reviews",async()=>{
    const raw=response({summary:"Saved legacy review.",issues:[],scorecard:undefined});
    expect(parseSiteReview(raw,["index.html"])).not.toHaveProperty("scorecard");
    await expect(reviewPortableSite(input(),async()=>raw)).rejects.toThrow("omitted its evidence-backed quality scorecard");
  });
  it("computes quality from scored evidence, pauses weak dimensions and supplies bounded repair instructions",()=>{
    const scorecard=passingScorecard();scorecard.copy.score=55;scorecard.copy.improvement="Replace repeated preparation instructions in the services and approach sections with distinct customer benefits from the approved scope.";
    const review=parseSiteReview(response({summary:"Material writing refinement needed.",issues:[],scorecard}),["index.html"]);
    expect(review.overallScore).toBe(83);expect(review.reviewVersion).toBe(2);
    expect(review.issues).toEqual([expect.objectContaining({code:"review_quality_copy",severity:"error",message:expect.stringContaining("Replace repeated preparation")})]);
    for(const dimension of Object.values(scorecard)){dimension.score=65;dimension.improvement="Shorten the generic introduction and give this named section a clear, industry-specific visitor benefit.";}
    expect(parseSiteReview(response({summary:"Generic draft.",issues:[],scorecard}),["index.html"]).issues).toHaveLength(3);
  });
  it("does not allow high aesthetic scores to erase material factual defects",()=>{
    const review=parseSiteReview(response({summary:"Polished but unsupported claim.",issues:[{page:"index.html",category:"plan",severity:"error",message:"Remove the unconfirmed license claim."}]}),["index.html"]);
    expect(review.overallScore).toBe(88);expect(review.issues[0].severity).toBe("error");
  });
  it("rejects fabricated evidence locations and unsupported score-only failure",()=>{
    const scorecard=passingScorecard();scorecard.mobile.evidence[0].page="unknown.html";
    expect(()=>parseSiteReview(response({summary:"Invalid evidence.",issues:[],scorecard}),["index.html"])).toThrow("scorecard referenced an unknown page");
    scorecard.mobile.evidence[0].page="index.html";scorecard.mobile.score=40;scorecard.mobile.improvement="None";
    expect(()=>parseSiteReview(response({summary:"Invalid low score.",issues:[],scorecard}),["index.html"])).toThrow("concrete repair instruction");
  });
  it("reviews every page in desktop/mobile and submits bounded real local JPEGs with no tools",async()=>{
    const execute=vi.fn(async(_request:SiteModelRequest)=>response()),source=input(true);
    const result=await reviewPortableSite(source,execute);
    expect(result.reviewedPages).toEqual(source.blueprint.pages.map(page=>page.path));expect(result.imageCount).toBe(10);
    expect(execute).toHaveBeenCalledOnce();
    const request=execute.mock.calls[0][0];
    expect(request).toMatchObject({stage:"review",model:"gpt-6.1-sol",maxOutputTokens:4500});
    expect(request.body).toMatchObject({model:factoryModelPolicy.model,store:false,truncation:"disabled",max_output_tokens:4500,text:{format:{type:"json_schema",name:"factory_site_review",strict:true}}});
    expect(request.body.tools).toBeUndefined();expect(request.body.instructions).toContain("untrusted data");expect(request.body.instructions).toContain("Missing business information is not a reason to fail");
    const schema=(request.body.text as {format:{schema:{properties:Record<string,any>;required:string[]}}}).format.schema;
    expect(schema.properties.verdict).toBeUndefined();expect(schema.required).not.toContain("verdict");
    expect(schema.required).toContain("scorecard");
    expect(schema.properties.issues.items.properties.page.enum).toEqual(source.blueprint.pages.map(p=>p.path));
    const content=(request.body.input as Array<{content:Array<{type:string;text?:string;image_url?:string;detail?:string}>}>)[0].content;
    expect(JSON.parse(content[0].text!)).toMatchObject({approvedPlan:source.plan,website:source.blueprint});
    for(const page of source.blueprint.pages)for(const viewport of ["desktop","mobile"]){
      expect(content.filter(item=>item.text===`Rendered page: ${page.path}; ${viewport} full-page overview.`)).toHaveLength(1);
    }
    const images=content.filter(item=>item.type==="input_image");expect(images).toHaveLength(10);
    expect(content.filter(item=>item.text?.includes("readable opening detail"))).toHaveLength(2);
    expect(content.filter(item=>item.text?.includes("readable section detail"))).toHaveLength(2);
    let imageBytes=0;
    for(const image of images){
      expect(image.image_url).toMatch(/^data:image\/jpeg;base64,/);expect(image.detail).toBe("high");
      const bytes=Buffer.from(image.image_url!.split(",")[1],"base64");imageBytes+=bytes.length;
      const metadata=await sharp(bytes).metadata();expect(metadata.format).toBe("jpeg");expect(metadata.width!).toBeLessThanOrEqual(1600);expect(metadata.height!).toBeLessThanOrEqual(2400);expect(bytes.length).toBeLessThanOrEqual(500000);
    }
    expect(request.reservedMicros).toBe(factoryUsageCost(request.inputBytes-imageBytes+8192+images.length*32768,4500,0));
  });
  it("supplies a conservative reservation before the executor can make a billable call",async()=>{
    const execute=vi.fn(async(request:SiteModelRequest)=>{
      expect(request.reservedMicros).toBeGreaterThan(factoryUsageCost(2*32768,3000,0));
      expect(request.inputBytes).toBeGreaterThan(0);
      throw new Error("Synthetic budget reservation denied");
    });
    await expect(reviewPortableSite(input(),execute)).rejects.toThrow("reservation denied");expect(execute).toHaveBeenCalledOnce();
  });
  it("requires every page's desktop/mobile capture before calling the provider",async()=>{
    const source=input(true);source.screenshots.pop();const execute=vi.fn();
    await expect(reviewPortableSite(source,execute)).rejects.toThrow("Every page needs desktop and mobile");expect(execute).not.toHaveBeenCalled();
  });
  it("rejects oversized context and unbounded page counts before any billable call",async()=>{
    const execute=vi.fn(),large=input();large.plan={...fixtureSitePlan,summary:"x".repeat(150001)};
    await expect(reviewPortableSite(large,execute)).rejects.toThrow("context exceeds");
    const empty=input();empty.blueprint.pages=[];await expect(reviewPortableSite(empty,execute)).rejects.toThrow("bounded website");
    const excess=input();excess.blueprint.pages=Array.from({length:11},()=>excess.blueprint.pages[0]);await expect(reviewPortableSite(excess,execute)).rejects.toThrow("bounded website");expect(execute).not.toHaveBeenCalled();
  });
  it("rejects oversized or undecodable screenshot bytes before the provider",async()=>{
    const execute=vi.fn(),large=input();large.screenshots[0].bytes=new Uint8Array(12_000_001);
    await expect(reviewPortableSite(large,execute)).rejects.toThrow("Every page needs desktop and mobile");
    const invalid=input();invalid.screenshots[0].bytes=new Uint8Array([1,2,3]);await expect(reviewPortableSite(invalid,execute)).rejects.toThrow();expect(execute).not.toHaveBeenCalled();
  });
  it("bounds the encoded overview even if a valid screenshot contains expensive visual noise",async()=>{
    const source=input(),execute=vi.fn();source.screenshots[0].bytes=await sharp(randomBytes(1600*2400*3),{raw:{width:1600,height:2400,channels:3}}).png().toBuffer();
    await expect(reviewPortableSite(source,execute)).rejects.toThrow("screenshot exceeds its size limit");expect(execute).not.toHaveBeenCalled();
  });
  it("keeps optional refinements as warnings and concrete defects as errors",async()=>{
    const warning=await reviewPortableSite(input(),async()=>response({verdict:"pass",summary:"Ready with an optional refinement.",issues:[{page:"index.html",category:"design",severity:"warning",message:"The closing section could use a little less padding."}]}));
    expect(warning.issues).toEqual([{page:"index.html",code:"review_design",severity:"warning",message:"The closing section could use a little less padding."}]);
    const error=await reviewPortableSite(input(),async()=>response({verdict:"revise",summary:"Fix mobile hierarchy.",issues:[{page:"index.html",category:"mobile",severity:"error",message:"Shorten the hero heading so the primary action remains near the introduction."}]}));
    expect(error.issues[0]).toMatchObject({code:"review_mobile",severity:"error"});
  });
  it("derives new review outcomes from issues and gives safe diagnostic errors for saved responses",()=>{
    const issue={page:"index.html",category:"content",severity:"error",message:"Clarify the service heading."};
    expect(parseSiteReview(response({summary:"Correct this heading.",issues:[issue]}),["index.html"]).issues[0].severity).toBe("error");
    expect(parseSiteReview(response({summary:"Ready to share.",issues:[]}),["index.html"]).issues).toEqual([]);
    const raw=response({summary:"Private text must not leak through validation errors.",issues:[{...issue,category:"invalid"}]});
    try{parseSiteReview(raw,["index.html"]);throw new Error("Expected assessment rejection");}
    catch(error){expect(error).toBeInstanceOf(SiteReviewResponseError);expect((error as Error).message).toContain("assessment format");expect((error as Error).message).not.toContain("Private text");}
  });
  it("rejects issues for unknown pages and inconsistent pass/revise verdicts",async()=>{
    const issue={page:"secret/index.html",category:"content",severity:"error",message:"Fix the title."};
    await expect(reviewPortableSite(input(),async()=>response({verdict:"revise",summary:"Changes needed.",issues:[issue]}))).rejects.toThrow("unknown page");
    await expect(reviewPortableSite(input(),async()=>response({verdict:"pass",summary:"Passed.",issues:[{...issue,page:"index.html"}]}))).rejects.toThrow("inconsistent");
    await expect(reviewPortableSite(input(),async()=>response({verdict:"revise",summary:"Changes needed.",issues:[]}))).rejects.toThrow("inconsistent");
  });
  it("rejects incomplete, refused, tool-calling and malformed responses without retries",async()=>{
    for(const raw of [
      {...response(),status:"incomplete"},
      {...response(),output:[{type:"message",content:[{type:"refusal",text:"Cannot review this."}]}]},
      {...response(),output:[{type:"reasoning",content:response().output[0].content}]},
      {...response(),output:[{type:"message",content:[...response().output[0].content,{type:"refusal",text:"Partial refusal."}]}]},
      {...response(),output:[{type:"web_search_call"}]},
      {...response(),output:[{type:"message",content:[{type:"output_text",text:"not JSON"}]}]},
      response({verdict:"pass",summary:"Invalid extra field.",issues:[],execute:"do something"}),
    ]){
      const execute=vi.fn(async()=>raw);await expect(reviewPortableSite(input(),execute)).rejects.toThrow();expect(execute).toHaveBeenCalledOnce();
    }
  });
  it("rejects output beyond its size limit",async()=>{
    const execute=vi.fn(async()=>({...response(),output:[{type:"message",content:[{type:"output_text",text:"x".repeat(30001)}]}]}));
    await expect(reviewPortableSite(input(),execute)).rejects.toThrow("response exceeds");expect(execute).toHaveBeenCalledOnce();
  });
});
