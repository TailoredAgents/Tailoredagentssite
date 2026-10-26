import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const costs=vi.hoisted(()=>({reserve:vi.fn(),attempt:vi.fn(),settle:vi.fn(),uncertain:vi.fn()}));
vi.mock("./budget",()=>({reserveFactoryCost:costs.reserve,attemptFactoryCost:costs.attempt,settleFactoryCost:costs.settle,uncertainFactoryCost:costs.uncertain}));
import { extractFactoryResearch,parseFactoryPlan,researchFactoryLead,planFactoryWebsite,type FactorySnapshot } from "./provider";
import { factoryReservation,factoryUsageCost,factoryModelPolicy } from "./config";
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
