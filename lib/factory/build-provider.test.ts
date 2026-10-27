import {afterEach,describe,expect,it,vi} from "vitest";
import type {FactoryClaimedBuild} from "./build-types";
const mocks=vi.hoisted(()=>({reserve:vi.fn(async()=>"cost-1"),attempt:vi.fn(async()=>{}),settle:vi.fn(async()=>{}),uncertain:vi.fn(async()=>{}),normalize:vi.fn(async()=>Buffer.from("normalized-png"))}));
vi.mock("server-only",()=>({}));
vi.mock("./build-budget",()=>({FactoryBuildBudgetError:class extends Error{},reserveFactoryBuildCost:mocks.reserve,attemptFactoryBuildCost:mocks.attempt,settleFactoryBuildCost:mocks.settle,uncertainFactoryBuildCost:mocks.uncertain}));
vi.mock("./build-images",()=>({normalizeFactoryImage:mocks.normalize}));
import {factorySiteExecutor,generateFactoryHero,factoryImageUsageMicros,buildImagePolicy,FactoryBuildRequestNotAttemptedError} from "./build-provider";
import {FactoryBuildBudgetError} from "./build-budget";
const build={id:"build",leaseToken:"lease",leaseUntil:new Date(Date.now()+15*60*1000).toISOString(),stage:"generate"} as FactoryClaimedBuild;
describe("Website provider cost and request bounds",()=>{
  afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();vi.clearAllMocks();});
  it("does not start a paid response or image when its timeout would cross the worker lease",async()=>{
    vi.stubEnv("FACTORY_OPENAI_API_KEY","synthetic-test-key");const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    for(const leaseUntil of [new Date(Date.now()+269000).toISOString(),new Date(Date.now()-1000).toISOString(),"invalid"]){
      const nearingExpiry={...build,leaseUntil};
      await expect(factorySiteExecutor(nearingExpiry)({stage:"review",model:"gpt-6.1-sol",body:{},inputBytes:100,maxOutputTokens:3000,reservedMicros:200000})).rejects.toBeInstanceOf(FactoryBuildRequestNotAttemptedError);
      await expect(generateFactoryHero({...nearingExpiry,stage:"images"},"A sufficiently detailed illustrative scene.")).rejects.toBeInstanceOf(FactoryBuildRequestNotAttemptedError);
    }
    expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.attempt).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();expect(mocks.uncertain).not.toHaveBeenCalled();
  });
  it("rechecks the deadline after reservation and releases a request that has not crossed the HTTP boundary",async()=>{
    vi.useFakeTimers();const started=Date.now();vi.setSystemTime(started);vi.stubEnv("FACTORY_OPENAI_API_KEY","synthetic-test-key");
    const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    for(const kind of ["response","image"]){
      vi.setSystemTime(started);
      mocks.reserve.mockImplementationOnce(async()=>{vi.setSystemTime(started+31000);return "cost-1";});
      const shortLease={...build,leaseUntil:new Date(started+300000).toISOString()};
      const request=kind==="response"?factorySiteExecutor(shortLease)({stage:"repair",model:"gpt-6.1-sol",body:{},inputBytes:100,maxOutputTokens:9000,reservedMicros:200000}):generateFactoryHero({...shortLease,stage:"images"},"A sufficiently detailed illustrative scene.");
      await expect(request).rejects.toBeInstanceOf(FactoryBuildRequestNotAttemptedError);
    }
    expect(mocks.reserve).toHaveBeenCalledTimes(2);expect(mocks.uncertain).toHaveBeenCalledTimes(2);expect(mocks.attempt).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();expect(mocks.settle).not.toHaveBeenCalled();
  });
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
  it("marks missing provider configuration as unattempted without reserving or calling the provider",async()=>{
    vi.stubEnv("FACTORY_OPENAI_API_KEY","");vi.stubEnv("OPENAI_API_KEY","");const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    await expect(factorySiteExecutor(build)({stage:"review",model:"gpt-6.1-sol",body:{},inputBytes:100,maxOutputTokens:3000,reservedMicros:200000})).rejects.toBeInstanceOf(FactoryBuildRequestNotAttemptedError);
    expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.attempt).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();expect(mocks.uncertain).not.toHaveBeenCalled();
  });
  it("marks a denied reservation as unattempted without making a provider call",async()=>{
    vi.stubEnv("FACTORY_OPENAI_API_KEY","synthetic-test-key");const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    mocks.reserve.mockRejectedValueOnce(new FactoryBuildBudgetError("This build step exceeds the remaining allowance."));
    await expect(factorySiteExecutor(build)({stage:"review",model:"gpt-6.1-sol",body:{},inputBytes:100,maxOutputTokens:3000,reservedMicros:200000})).rejects.toBeInstanceOf(FactoryBuildRequestNotAttemptedError);
    expect(mocks.attempt).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();expect(mocks.uncertain).not.toHaveBeenCalled();
  });
  it("releases the unused reservation when the attempt gate rejects a paused or stale build",async()=>{
    vi.stubEnv("FACTORY_OPENAI_API_KEY","synthetic-test-key");const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    mocks.attempt.mockRejectedValueOnce(new FactoryBuildBudgetError("This request was paused before attempting it."));
    await expect(factorySiteExecutor(build)({stage:"repair",model:"gpt-6.1-sol",body:{},inputBytes:100,maxOutputTokens:9000,reservedMicros:200000})).rejects.toBeInstanceOf(FactoryBuildRequestNotAttemptedError);
    expect(fetcher).not.toHaveBeenCalled();expect(mocks.uncertain).toHaveBeenCalledWith("cost-1");expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("does not label a post-request overage or settlement error as unattempted",async()=>{
    vi.stubEnv("FACTORY_OPENAI_API_KEY","synthetic-test-key");const fetcher=vi.fn(async()=>Response.json({id:"r1",status:"completed",usage:{input_tokens:1000,output_tokens:2000},output:[]}));vi.stubGlobal("fetch",fetcher);
    const failure=new FactoryBuildBudgetError("Provider usage exceeded its reservation.");mocks.settle.mockRejectedValueOnce(failure);
    const result=factorySiteExecutor(build)({stage:"review",model:"gpt-6.1-sol",body:{},inputBytes:100,maxOutputTokens:3000,reservedMicros:200000});
    await expect(result).rejects.toBe(failure);expect(failure).not.toBeInstanceOf(FactoryBuildRequestNotAttemptedError);
    expect(fetcher).toHaveBeenCalledOnce();expect(mocks.uncertain).toHaveBeenCalledWith("cost-1");
  });
  it("does not relabel ambiguous transport failures even when they use a budget error type",async()=>{
    vi.stubEnv("FACTORY_OPENAI_API_KEY","synthetic-test-key");const failure=new FactoryBuildBudgetError("Synthetic transport interruption");const fetcher=vi.fn(async()=>{throw failure;});vi.stubGlobal("fetch",fetcher);
    await expect(factorySiteExecutor(build)({stage:"review",model:"gpt-6.1-sol",body:{},inputBytes:100,maxOutputTokens:3000,reservedMicros:200000})).rejects.toBe(failure);
    expect(failure).not.toBeInstanceOf(FactoryBuildRequestNotAttemptedError);expect(fetcher).toHaveBeenCalledOnce();expect(mocks.uncertain).toHaveBeenCalledWith("cost-1");
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
  it("records separate image-slot reservations and rejects unconfigured or denied image calls before HTTP",async()=>{
    vi.stubEnv("FACTORY_OPENAI_API_KEY","");vi.stubEnv("OPENAI_API_KEY","");const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    await expect(generateFactoryHero({...build,stage:"images"},"A sufficiently detailed illustrative scene.","service-photo")).rejects.toBeInstanceOf(FactoryBuildRequestNotAttemptedError);
    expect(mocks.reserve).not.toHaveBeenCalled();
    vi.stubEnv("FACTORY_OPENAI_API_KEY","synthetic-test-key");mocks.reserve.mockRejectedValueOnce(new FactoryBuildBudgetError("Remaining image allowance exceeded"));
    await expect(generateFactoryHero({...build,stage:"images"},"A sufficiently detailed illustrative scene.","service-photo")).rejects.toBeInstanceOf(FactoryBuildRequestNotAttemptedError);
    expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({requestKey:expect.stringMatching(/^image:service-photo:/),reservedMicros:2_000_000}));expect(fetcher).not.toHaveBeenCalled();expect(mocks.attempt).not.toHaveBeenCalled();
  });
});
