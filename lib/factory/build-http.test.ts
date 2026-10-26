import {randomUUID} from "node:crypto";
import sharp from "sharp";
import {beforeEach,describe,expect,it,vi} from "vitest";
import {FactoryAccessError} from "./types";
const f=vi.hoisted(()=>({context:vi.fn(),authorize:vi.fn(),put:vi.fn(),get:vi.fn(),register:vi.fn(),complete:vi.fn(),remove:vi.fn(),source:vi.fn(),screenshot:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/dashboard/data",()=>({getOptionalDashboardContext:f.context}));
vi.mock("@/lib/dashboard/db",()=>({getDatabasePool:()=>({})}));
vi.mock("./data",()=>({authorizeFactory:f.authorize}));
vi.mock("./storage",()=>({factoryStorage:()=>({put:f.put,get:f.get})}));
vi.mock("./build-service",()=>({registerFactoryUpload:f.register,completeFactoryUpload:f.complete,deleteFactoryUpload:f.remove}));
vi.mock("./build-data",()=>({getFactorySourceDownload:f.source,getFactoryScreenshotDownload:f.screenshot}));
import {boundedBody,normalizeFactoryImage,uploadFactoryImage} from "./build-http";
import {GET as sourceDownload} from "../../app/api/dashboard/factory/builds/[id]/source/route";
import {GET as screenshotDownload} from "../../app/api/dashboard/factory/builds/[id]/screenshot/route";
const context={user:{id:"member"},workspace:{id:randomUUID()},role:"member"},projectId=randomUUID();
beforeEach(()=>{for(const mock of Object.values(f))mock.mockReset();f.context.mockResolvedValue(context);f.authorize.mockResolvedValue("member");f.register.mockResolvedValue({id:randomUUID(),storageKey:"private/upload.png"});f.put.mockResolvedValue(undefined);f.complete.mockResolvedValue({projectId});f.remove.mockResolvedValue({projectId});f.get.mockResolvedValue(new Uint8Array([1,2,3]));f.source.mockResolvedValue({storageKey:"private/source.zip",filename:"website-v1.zip"});f.screenshot.mockResolvedValue({storageKey:"private/screenshot.png",filename:"website-v1-mobile.png"});});
async function uploadRequest(origin="https://www.tailoredagents.com"){const png=await sharp({create:{width:12,height:12,channels:3,background:"blue"}}).png().toBuffer();const form=new FormData();form.set("file",new File([new Uint8Array(png)],"logo.png",{type:"image/png"}));return new Request(`https://www.tailoredagents.com/api/dashboard/factory/projects/${projectId}/uploads`,{method:"POST",headers:{origin},body:form});}
describe("Factory uploads and authenticated artifacts",()=>{
  it("reencodes accepted images and strips metadata, SVG and invalid formats",async()=>{
    const source=await sharp({create:{width:2200,height:100,channels:3,background:"red"}}).withMetadata({orientation:1}).jpeg().toBuffer();const normalized=await normalizeFactoryImage(source),meta=await sharp(normalized).metadata();expect(meta.format).toBe("png");expect(meta.width).toBe(1800);expect(meta.exif).toBeUndefined();
    await expect(normalizeFactoryImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).rejects.toThrow("PNG, JPEG, or WebP");await expect(normalizeFactoryImage(new Uint8Array([255,216,1,2]))).rejects.toThrow("could not be decoded");
  });
  it("rejects anonymous/cross-origin/read-only uploads before processing or storage",async()=>{
    f.context.mockResolvedValueOnce(null);expect((await uploadFactoryImage(await uploadRequest(),projectId)).status).toBe(401);
    expect((await uploadFactoryImage(await uploadRequest("https://other.example"),projectId)).status).toBe(403);
    f.authorize.mockRejectedValueOnce(new FactoryAccessError("Read only"));expect((await uploadFactoryImage(await uploadRequest(),projectId)).status).toBe(403);expect(f.register).not.toHaveBeenCalled();expect(f.put).not.toHaveBeenCalled();
  });
  it("reserves metadata before upload and leaves cleanup on failed finalization",async()=>{
    expect((await uploadFactoryImage(await uploadRequest(),projectId)).status).toBe(200);expect(f.register.mock.calls[0][1]).toMatchObject({contentType:"image/png"});expect(f.complete).toHaveBeenCalledTimes(1);
    f.complete.mockRejectedValueOnce(new Error("Lead deleted"));expect((await uploadFactoryImage(await uploadRequest(),projectId)).status).toBe(503);expect(f.remove).toHaveBeenCalledTimes(1);
  });
  it("limits body bytes even without content-length",async()=>{
    await expect(boundedBody(new Request("https://example.test",{method:"POST",body:new Uint8Array(32)}),16)).rejects.toThrow("too large");
  });
  it("requires current source/screenshot read access before and after fetching private storage",async()=>{
    const params={params:Promise.resolve({id:randomUUID()})},request=new Request("https://www.tailoredagents.com/source");
    f.context.mockResolvedValueOnce(null);expect((await sourceDownload(request,params)).status).toBe(401);expect(f.get).not.toHaveBeenCalled();
    f.source.mockRejectedValueOnce(new FactoryAccessError("Other workspace"));expect((await sourceDownload(request,params)).status).toBe(404);expect(f.get).not.toHaveBeenCalled();
    expect((await sourceDownload(request,params)).status).toBe(200);expect(f.source).toHaveBeenCalledTimes(3);
    f.source.mockResolvedValueOnce({storageKey:"private/source.zip",filename:"website-v1.zip"}).mockRejectedValueOnce(new FactoryAccessError("Revoked during storage read"));expect((await sourceDownload(request,params)).status).toBe(404);
    expect((await screenshotDownload(new Request("https://www.tailoredagents.com/screenshot?view=invalid"),params)).status).toBe(400);
    expect((await screenshotDownload(new Request("https://www.tailoredagents.com/screenshot?view=mobile"),params)).status).toBe(200);expect(f.screenshot).toHaveBeenCalledTimes(2);
  });
});
