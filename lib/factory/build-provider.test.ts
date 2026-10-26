import {afterEach,describe,expect,it,vi} from "vitest";
import type {FactoryClaimedBuild} from "./build-types";
const mocks=vi.hoisted(()=>({reserve:vi.fn(async()=>"cost-1"),attempt:vi.fn(async()=>{}),settle:vi.fn(async()=>{}),uncertain:vi.fn(async()=>{}),normalize:vi.fn(async()=>Buffer.from("normalized-png"))}));
vi.mock("server-only",()=>({}));
vi.mock("./build-budget",()=>({reserveFactoryBuildCost:mocks.reserve,attemptFactoryBuildCost:mocks.attempt,settleFactoryBuildCost:mocks.settle,uncertainFactoryBuildCost:mocks.uncertain}));
vi.mock("./build-images",()=>({normalizeFactoryImage:mocks.normalize}));
import {factorySiteExecutor,generateFactoryHero,factoryImageUsageMicros,buildImagePolicy} from "./build-provider";
const build={id:"build",leaseToken:"lease",stage:"generate"} as FactoryClaimedBuild;
describe("Website provider cost and request bounds",()=>{
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.clearAllMocks();});
  it("reserves before the request and settles usage before blueprint validation",async()=>{
    vi.stubEnv("FACTORY_OPENAI_API_KEY","synthetic-test-key");
    const fetcher=vi.fn(async(_url:unknown,_init?:RequestInit)=>{
      expect(mocks.reserve).toHaveBeenCalledTimes(1);expect(mocks.attempt).toHaveBeenCalledWith("cost-1","lease");
      return Response.json({id:"r1",status:"completed",usage:{input_tokens:1000,output_tokens:2000},output:[]});
    });vi.stubGlobal("fetch",fetcher);
    await factorySiteExecutor(build)({stage:"generate",model:"gpt-6.1-sol",body:{model:"gpt-6.1-sol"},inputBytes:1000,maxOutputTokens:9000,reservedMicros:200000});
    expect(fetcher.mock.calls[0][0]).toBe("https://api.openai.com/v1/responses");
    expect(mocks.settle).toHaveBeenCalledWith("cost-1",expect.objectContaining({actualMicros:38500,providerId:"r1"}));expect(mocks.uncertain).not.toHaveBeenCalled();
  });
  it("retains an attempted unknown charge and never retries provider errors",async()=>{
    vi.stubEnv("OPENAI_API_KEY","synthetic-test-key");const fetcher=vi.fn(async()=>new Response("unavailable",{status:503}));vi.stubGlobal("fetch",fetcher);
    await expect(factorySiteExecutor(build)({stage:"generate",model:"gpt-6.1-sol",body:{},inputBytes:100,maxOutputTokens:9000,reservedMicros:200000})).rejects.toThrow("did not confirm");
    expect(fetcher).toHaveBeenCalledTimes(1);expect(mocks.uncertain).toHaveBeenCalledWith("cost-1");expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("requests only one bounded hero and charges actual token usage",async()=>{
    vi.stubEnv("OPENAI_API_KEY","synthetic-test-key");const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{
      expect(JSON.parse(init!.body as string)).toMatchObject({n:1,quality:"medium",size:"1536x1024",output_format:"png",model:buildImagePolicy.model});
      return Response.json({data:[{b64_json:Buffer.from("png-fixture").toString("base64")}],usage:{input_tokens:200,output_tokens:4000}});
    });vi.stubGlobal("fetch",fetcher);
    const result=await generateFactoryHero({...build,stage:"images"},"An illustrative architectural photograph without text.");
    expect(result.bytes).toEqual(Buffer.from("normalized-png"));expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({reservedMicros:2_000_000,stage:"images"}));
    expect(mocks.settle).toHaveBeenCalledWith("cost-1",expect.objectContaining({actualMicros:133760}));
  });
  it("does not accept missing/negative usage as a free image",async()=>{
    expect(()=>factoryImageUsageMicros({input_tokens:-1,output_tokens:10})).toThrow();
    vi.stubEnv("OPENAI_API_KEY","synthetic-test-key");vi.stubGlobal("fetch",vi.fn(async()=>Response.json({data:[{b64_json:"YWJj"}]})));
    await expect(generateFactoryHero({...build,stage:"images"},"Illustrative image with sufficient prompt length.")).rejects.toThrow();
    expect(mocks.uncertain).toHaveBeenCalledWith("cost-1");expect(mocks.normalize).not.toHaveBeenCalled();
  });
});
