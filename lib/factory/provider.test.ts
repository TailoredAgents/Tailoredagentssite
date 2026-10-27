import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const costs=vi.hoisted(()=>({reserve:vi.fn(),attempt:vi.fn(),settle:vi.fn(),uncertain:vi.fn()}));
vi.mock("./budget",()=>({reserveFactoryCost:costs.reserve,attemptFactoryCost:costs.attempt,settleFactoryCost:costs.settle,uncertainFactoryCost:costs.uncertain}));
import { extractFactoryResearch,parseFactoryPlan,researchFactoryLead,planFactoryWebsite,type FactorySnapshot } from "./provider";
import { factoryReservation,factoryUsageCost,factoryModelPolicy } from "./config";
import { websitePlanningContract,websiteQualityStandards } from "./website-standards";
import { factoryDesignCapabilities } from "./design-recipe";
const request=vi.fn();
const ctx={workspaceId:"w",projectId:"p",jobId:"j",leaseToken:"l",attempt:1};
const snapshot:FactorySnapshot={lead:{organization:"None",website_url:null},notes:[],messages:[],previousPlan:null,contextNotice:"Sparse fixture"};
const plan=()=>({summary:"General concept; business is unverified",goal:"Introduce the business",audience:"Prospective customers",knownDetails:[],uncertainties:["Business identity unknown"],assumptions:["Service-business concept pending review"],pages:[{title:"Home",purpose:"Introduce services",sections:["Introduction","Contact"]}],callsToAction:["Get in touch"],design:{direction:"Editorial blue",palette:["Navy"],typography:"Readable sans serif",imagery:"Illustrations only"},previewFeatures:["Demo contact form"],productionIntegrations:["Connect real form delivery"]});
const response=(text:string,annotations:unknown[]=[],status="completed")=>({id:"resp_fixture",status,usage:{input_tokens:1500,output_tokens:400},output:[{type:"message",content:[{type:"output_text",text,annotations}]}]});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("FACTORY_OPENAI_API_KEY","synthetic-factory-key");vi.stubGlobal("fetch",request);costs.reserve.mockResolvedValue("reservation");});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});

describe("Factory provider boundaries (synthetic responses only)",()=>{
  it("extracts only actual URL citation annotations, not model-authored links",()=>{
    const result=extractFactoryResearch(response("Possible match at https://invented.example. Cited company exists.",[
      {type:"url_citation",url:"https://real.example/about",title:"About",start_index:42,end_index:62},
      {type:"url_citation",url:"javascript:alert(1)",title:"Unsafe"},
      {type:"url_citation",url:"https://u:pass@example.com/",title:"Credentials"},
      {type:"url_citation",url:"https://127.0.0.1/internal",title:"Private"},
      {type:"url_citation",url:"https://real.example/about",title:"Duplicate"},
    ]),new Date("2026-10-26T12:00:00Z"));
    expect(result.sources).toHaveLength(1);expect(result.sources[0]).toMatchObject({id:"source-1",url:"https://real.example/about",retrievedAt:"2026-10-26T12:00:00.000Z"});
    expect(result.sources[0].evidence).toContain("Possible match");
  });
  it("accepts a sparse generic plan but rejects invented source ids and unsourced researched facts",()=>{
    const value={changed:true,reply:"Here is a general concept",changeSummary:"Initial",plan:plan()};
    expect(parseFactoryPlan(value,{text:"No reliable match",sources:[]},null).plan.uncertainties).toContain("Business identity unknown");
    const bad={...value,plan:{...plan(),knownDetails:[{label:"Address",value:"Invented",basis:"sourced",sourceIds:[]}]}};
    expect(()=>parseFactoryPlan(bad,{text:"",sources:[]},null)).toThrow("missing its source");
    bad.plan.knownDetails[0].sourceIds.push("fabricated" as never);
    expect(()=>parseFactoryPlan(bad,{text:"",sources:[]},null)).toThrow("not returned by research");
  });
  it("preserves the exact prior plan for a clarification without a new plan",()=>{
    const previous={...plan(),sources:[]};
    const result=parseFactoryPlan({changed:false,reply:"Yes, the form is a demo.",changeSummary:"Answered question",plan:{...plan(),summary:"This must not silently replace the plan"}},{text:"",sources:[]},previous);
    expect(result.plan).toBe(previous);expect(result.changed).toBe(false);
  });
  it.each([
    ["A one-page website proposal",2,1],
    ["A premium 5-page site",1,5],
    ["Five distinct responsive pages with clear navigation",1,5],
    ["Ten dedicated pages",1,10],
    ["A 10-page redesign proposal",1,10],
  ])("rejects a declared count that disagrees with the actual page list: %s",(declaration,actual,declared)=>{
    const content=plan();content.summary=declaration;content.pages=Array.from({length:actual},(_,index)=>({title:`Page ${index+1}`,purpose:"A distinct visitor purpose",sections:["Introduction"]}));
    expect(()=>parseFactoryPlan({changed:true,reply:"Review the proposal",changeSummary:"Revised scope",plan:content},{text:"",sources:[]},null)).toThrow(`describes ${declared} pages but lists ${actual}`);
  });
  it("rejects the observed five-page feature promise even when its summary uses intervening business words",()=>{
    const content={...plan(),summary:"Version 4: a premium five-page Cosmo’s home-comfort redesign proposal for human review only.",previewFeatures:["Five distinct responsive pages with clear navigation, filled surfaces, concise educational copy and mobile call/contact controls that do not obscure content."]};
    expect(()=>parseFactoryPlan({changed:true,reply:"Review this plan",changeSummary:"Revised",plan:content},{text:"",sources:[]},null)).toThrow("describes 5 pages but lists 1");
  });
  it("accepts matching page declarations at any supported size without imposing a five-page quota",()=>{
    for(const count of [1,5,10]){
      const content=plan();content.summary=`A ${count}-page website proposal`;content.previewFeatures=[`${count} distinct responsive pages`];content.pages=Array.from({length:count},(_,index)=>({title:`Page ${index+1}`,purpose:"A distinct visitor purpose",sections:["Introduction"]}));
      expect(parseFactoryPlan({changed:true,reply:"Review this plan",changeSummary:"Scope",plan:content},{text:"",sources:[]},null).plan.pages).toHaveLength(count);
    }
  });
  it("ignores historical, optional, range, question and form-field counts rather than guessing current scope",()=>{
    for(const summary of ["The existing five-page site needs a fresh direction.","The previous ten-page website was hard to navigate.","Up to five pages could be useful later.","Five pages could be added later.","Between three and five pages may be useful.","A 3–5 pages range remains undecided.","Would a five-page site be useful?","A three-field form and a two-step inquiry process.","A three-page intake form inside the website."]){
      expect(()=>parseFactoryPlan({changed:true,reply:"Review this direction",changeSummary:"Concept",plan:{...plan(),summary}},{text:"",sources:[]},null)).not.toThrow();
    }
  });
  it("checks only current plan declarations and preserves unchanged historical plans exactly",()=>{
    const previous={...plan(),summary:"A five-page website proposal",sources:[]};
    expect(parseFactoryPlan({changed:false,reply:"Previously you requested ten pages",changeSummary:"No scope change",plan:{...plan(),summary:previous.summary}},{text:"",sources:[]},previous).plan).toBe(previous);
    expect(parseFactoryPlan({changed:true,reply:"The old site had ten pages",changeSummary:"Discussed five-page alternative",plan:plan()},{text:"",sources:[]},null).plan.pages).toHaveLength(1);
  });
  it("bounds search tools, output and time; marks data untrusted; never exposes build tools",async()=>{
    request.mockResolvedValue(new Response(JSON.stringify(response("No confident company match. Generic concept remains possible."))));
    const result=await researchFactoryLead(ctx,snapshot);
    expect(result.sources).toEqual([]);const [url,options]=request.mock.calls[0],body=JSON.parse(options.body);
    expect(url).toBe("https://api.openai.com/v1/responses");expect(body.model).toBe(factoryModelPolicy.model);expect(body.max_tool_calls).toBe(2);expect(body.store).toBe(false);
    expect(body.tools).toEqual([{type:"web_search",search_context_size:"low",return_token_budget:"default"}]);expect(body.instructions).toContain("untrusted evidence");
    expect(body.instructions).toContain("No particular business field is required");expect(options.signal).toBeInstanceOf(AbortSignal);expect(costs.settle).toHaveBeenCalledOnce();
  });
  it("uses strict structured planning without tools and attaches provider sources",async()=>{
    request.mockResolvedValue(new Response(JSON.stringify(response(JSON.stringify({changed:true,reply:"Review this plan",changeSummary:"Initial concept",plan:plan()})))));
    const source={id:"source-1",url:"https://real.example/",title:"Source",retrievedAt:new Date().toISOString(),evidence:"Research statement"};
    const result=await planFactoryWebsite(ctx,snapshot,{text:"A possible match",sources:[source]});
    const body=JSON.parse(request.mock.calls[0][1].body);
    expect(body.text.format.strict).toBe(true);expect(body.text.format.name).toBe("factory_plan");expect(body.tools).toBeUndefined();expect(result.plan.sources).toEqual([source]);
    expect(body.instructions).toContain(websiteQualityStandards);expect(body.instructions).toContain(websitePlanningContract);
    expect(JSON.parse(body.input[0].content).rendererCapabilities).toEqual(factoryDesignCapabilities);
    expect(body.text.format.schema.properties.plan.properties.design.required).toContain("recipe");
    const inputBytes=Buffer.byteLength(JSON.stringify({snapshot,research:{text:"A possible match",sources:[source]},rendererCapabilities:factoryDesignCapabilities}))+Buffer.byteLength(body.instructions)+Buffer.byteLength(JSON.stringify(body.text.format.schema));
    expect(costs.reserve).toHaveBeenCalledWith({...ctx,stage:"plan",micros:factoryReservation("plan",inputBytes)});
  });
  it("saves a supported concrete design and rejects conflicting choices before approval",()=>{
    const recipe={version:1 as const,family:"trades" as const,composition:"framed" as const,fontTheme:"technical" as const,density:"compact" as const,radius:"soft" as const};
    const content={...plan(),design:{...plan().design,recipe}};
    const result=parseFactoryPlan({changed:true,reply:"Review this concrete direction",changeSummary:"Set a framed geometric design",plan:content},{text:"",sources:[]},null);
    expect(result.plan.design.recipe).toEqual(recipe);
    expect(()=>parseFactoryPlan({changed:true,reply:"Review",changeSummary:"Invalid",plan:{...content,design:{...content.design,recipe:{...recipe,composition:"minimal"}}}},{text:"",sources:[]},null)).toThrow("does not support");
    expect(()=>parseFactoryPlan({changed:true,reply:"Review",changeSummary:"Conflicting",plan:{...content,design:{...content.design,recipe:{...recipe,fontTheme:"editorial"}}}},{text:"",sources:[]},null)).toThrow("heading typography");
    expect(()=>parseFactoryPlan({changed:true,reply:"Review",changeSummary:"Unsupported",plan:{...content,design:{...content.design,recipe:{...recipe,fontTheme:"remote-font"}}}},{text:"",sources:[]},null)).toThrow();
  });
  it("does not retrofit or change a design recipe when the user only asks a question",()=>{
    const previous={...plan(),sources:[]};
    const result=parseFactoryPlan({changed:false,reply:"The prior direction remains",changeSummary:"Answered question",plan:{...plan(),design:{...plan().design,recipe:{version:1,family:"professional",composition:"minimal",fontTheme:"technical",density:"compact",radius:"square"}}}},{text:"",sources:[]},previous);
    expect(result.plan).toBe(previous);expect(result.plan.design.recipe).toBeUndefined();
  });
  it("never retries an ambiguous transport error and retains its uncertain receipt",async()=>{
    request.mockRejectedValue(new Error("Socket lost"));await expect(researchFactoryLead(ctx,snapshot)).rejects.toThrow();
    expect(request).toHaveBeenCalledOnce();expect(costs.uncertain).toHaveBeenCalledWith("reservation");
  });
  it("redacts non-success response bodies and rejects oversized output",async()=>{
    request.mockResolvedValueOnce(new Response("private-key-and-customer-data",{status:500}));
    await expect(researchFactoryLead(ctx,snapshot)).rejects.toThrow("did not confirm");
    request.mockResolvedValueOnce(new Response("x".repeat(1_000_001)));
    await expect(researchFactoryLead(ctx,snapshot)).rejects.toThrow("size limit");
  });
  it("reserves repeated worst-case web context and rejects unbounded input before sending",async()=>{
    const reserved=factoryReservation("research",110000);
    expect(reserved).toBeGreaterThan(factoryUsageCost(128000*3,4000*3,2));expect(reserved).toBeLessThan(factoryModelPolicy.maximumStageMicros);
    await expect(researchFactoryLead(ctx,{...snapshot,notes:["x".repeat(110001)]})).rejects.toThrow("size limit");expect(request).not.toHaveBeenCalled();
  });
});
