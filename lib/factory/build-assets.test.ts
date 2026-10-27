import {beforeEach,describe,expect,it,vi} from "vitest";
import sharp from "sharp";
import {randomUUID} from "node:crypto";
import {fixtureBlueprint,fixtureSitePlan} from "./site/fixtures";
import {factoryBuildAssetDescriptors,resolveFactoryBuildImages} from "./build-assets";
import type {FactoryClaimedBuild} from "./build-types";
import type {SiteMedia} from "./site/types";
const state=vi.hoisted(()=>({saved:{} as Record<string,unknown>,progress:vi.fn(),advance:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("./build-service",()=>({
  saveFactoryBuildProgress:state.progress,saveFactoryBuildStage:state.advance,
  claimFactoryBuild:vi.fn(),rollbackFactoryBuildAttempt:vi.fn(),finishFactoryBuild:vi.fn(),failFactoryBuild:vi.fn(),recoverFactoryBuilds:vi.fn(),claimFactoryStorageCleanup:vi.fn(),finishFactoryStorageCleanup:vi.fn(),
}));
import {performFactoryBuildStage,type FactoryBuildRuntime} from "./build-worker";

function media(id:string,overrides:Partial<SiteMedia>={}):SiteMedia{return {id,role:"photo",source:"generated",uploadId:null,prompt:`A composed illustrative photograph for the ${id} section, without text or logos.`,alt:`Illustrative ${id} scene`,caption:"Illustrative concept image",...overrides};}
function job():FactoryClaimedBuild{return {id:randomUUID(),workspaceId:randomUUID(),projectId:randomUUID(),buildRequestId:randomUUID(),planId:randomUUID(),plan:fixtureSitePlan,version:1,stage:"images",leaseToken:randomUUID(),leaseUntil:new Date(Date.now()+900000).toISOString(),attempt:1,workingData:{blueprint:fixtureBlueprint()},storagePrefix:"factory/test/project/build/",previewToken:"a".repeat(48),uploads:[]};}
async function harness(){
  const image=await sharp({create:{width:120,height:80,channels:4,background:{r:45,g:95,b:100,alpha:.5}}}).png().toBuffer();
  const objects=new Map<string,Uint8Array>();
  const runtime:FactoryBuildRuntime={storage:{async get(key){const value=objects.get(key);if(!value)throw new Error("Fixture image missing");return value;},async put(key,bytes){objects.set(key,Uint8Array.from(bytes));},async deletePrefix(){}},hero:vi.fn(async()=>({bytes:image,provenance:{kind:"synthetic-test"}})),execute:vi.fn(),qa:vi.fn(),verify:vi.fn()};
  return {runtime,objects,image};
}
beforeEach(()=>{state.saved={};vi.clearAllMocks();state.progress.mockImplementation(async(input:{workingData:Record<string,unknown>})=>{state.saved=structuredClone(input.workingData);return true;});state.advance.mockImplementation(async(input:{workingData:Record<string,unknown>})=>{state.saved=structuredClone(input.workingData);return true;});});

describe("Approved website media and durable image preparation",()=>{
  it("keeps old uploads photographic, chooses the first photo after a logo, and hides storage keys from the model",()=>{
    const build=job(),logoId=randomUUID(),photoId=randomUUID();
    build.uploads=[{id:logoId,role:"logo",alt:"Customer logo",storageKey:"private/logo.png",filename:"logo.png",byteSize:100,contentType:"image/png",createdAt:"2026-10-27"},{id:photoId,filename:"work.png",storageKey:"private/work.png",byteSize:100,contentType:"image/png",createdAt:"2026-10-27"}];
    const blueprint=fixtureBlueprint();blueprint.media=[media("brand",{role:"logo",source:"provided",uploadId:logoId})];
    expect(resolveFactoryBuildImages(build,blueprint).map(slot=>[slot.id,slot.role,slot.uploadId])).toEqual([["hero","photo",photoId],["brand","logo",logoId]]);
    expect(factoryBuildAssetDescriptors(build)).toEqual([expect.objectContaining({id:logoId,role:"logo",alt:"Customer logo"}),expect.objectContaining({id:photoId,path:"assets/images/hero.png",role:"photo"})]);
    expect(JSON.stringify(factoryBuildAssetDescriptors(build))).not.toContain("private/");
  });

  it("rejects unapproved uploads, role changes, generated logos and excessive paid slots before image work",async()=>{
    const build=job(),{runtime}=await harness(),blueprint=fixtureBlueprint();
    for(const assets of [[media("brand",{role:"logo"})],[media("customer",{source:"provided",uploadId:randomUUID()})],[media("one"),media("two"),media("three")],[media("hero")],[media("../escape")]]){
      blueprint.media=assets;build.workingData={blueprint};
      await expect(performFactoryBuildStage(build,runtime)).rejects.toThrow();
    }
    expect(runtime.hero).not.toHaveBeenCalled();expect(state.advance).not.toHaveBeenCalled();
  });

  it("checkpoints each completed image and retries only the remaining slot after a later failure",async()=>{
    const build=job(),{runtime,objects,image}=await harness(),blueprint=fixtureBlueprint();
    blueprint.media=[media("comfort"),media("detail")];build.workingData={blueprint};
    let first=true;
    vi.mocked(runtime.hero).mockImplementation(async(_build,_prompt,id)=>{
      if(id==="detail"&&first){first=false;expect(state.saved).toHaveProperty("imageAssets.comfort.sha256");throw new Error("Synthetic provider interruption");}
      return {bytes:image,provenance:{kind:"synthetic-test",id}};
    });
    await expect(performFactoryBuildStage(build,runtime)).rejects.toThrow("Synthetic provider");
    expect(runtime.hero).toHaveBeenCalledTimes(3);expect(objects.has(`${build.storagePrefix}assets/comfort.png`)).toBe(true);
    build.workingData=structuredClone(state.saved);build.attempt++;
    await performFactoryBuildStage(build,runtime);
    expect(runtime.hero).toHaveBeenCalledTimes(4);expect(vi.mocked(runtime.hero).mock.calls.at(-1)?.[2]).toBe("detail");
    expect(state.advance).toHaveBeenCalledWith(expect.objectContaining({nextStage:"qa"}));
    expect(state.saved).toHaveProperty("imageAssets.hero.sha256");expect(state.saved).toHaveProperty("imageAssets.detail.sha256");
    expect(JSON.stringify(state.saved.provenance)).not.toContain(build.storagePrefix);
  });

  it("prepares supplied logo and photos without generation and uses the team's optional image description",async()=>{
    const build=job(),{runtime,objects,image}=await harness(),logoId=randomUUID(),photoId=randomUUID(),blueprint=fixtureBlueprint();
    build.uploads=[{id:logoId,role:"logo",storageKey:"input/logo.png",filename:"logo.png",byteSize:image.length,contentType:"image/png",createdAt:"2026-10-27"},{id:photoId,role:"photo",alt:"Customer-supplied cooling installation",storageKey:"input/photo.png",filename:"work.png",byteSize:image.length,contentType:"image/png",createdAt:"2026-10-27"}];
    objects.set("input/logo.png",image);objects.set("input/photo.png",image);
    blueprint.media=[media("brand",{role:"logo",source:"provided",uploadId:logoId})];build.workingData={blueprint};
    await performFactoryBuildStage(build,runtime);
    expect(runtime.hero).not.toHaveBeenCalled();expect(state.saved).toHaveProperty("blueprint.heroImage.alt","Customer-supplied cooling installation");expect(state.saved).toHaveProperty("imageAssets.brand.provenance.uploadId",logoId);
  });

  it("resumes an older saved hero without a new charge and refuses corrupted checkpointed bytes",async()=>{
    const build=job(),{runtime,objects,image}=await harness(),key=`${build.storagePrefix}assets/hero.png`;
    objects.set(key,image);build.workingData={...build.workingData,heroKey:key,provenance:{kind:"legacy"}};
    await performFactoryBuildStage(build,runtime);expect(runtime.hero).not.toHaveBeenCalled();
    build.workingData=structuredClone(state.saved);objects.set(key,Buffer.from("changed"));
    await expect(performFactoryBuildStage(build,runtime)).rejects.toThrow("could not be verified");expect(runtime.hero).not.toHaveBeenCalled();
  });
});
