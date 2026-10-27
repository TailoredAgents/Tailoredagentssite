import {createHash} from "node:crypto";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import worker,{serveFactoryPreview,type FactoryPreviewEnv} from "../../apps/factory-preview/worker.mjs";
const token="a".repeat(48),secret="private-preview-secret-".repeat(2),body=new TextEncoder().encode("<!doctype html><title>Preview</title>");
const prefix="factory/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000003/preview/";
const resolution=()=>({storagePrefix:prefix,ready:true,expiresAt:new Date(Date.now()+60000).toISOString(),manifest:{entrypoint:"index.html",files:[{path:"index.html",contentType:"text/html; charset=utf-8",size:body.length,sha256:createHash("sha256").update(body).digest("hex")}]}});
let fetcher:ReturnType<typeof vi.fn<typeof fetch>>,get:ReturnType<typeof vi.fn<FactoryPreviewEnv["SITES"]["get"]>>,env:FactoryPreviewEnv;
const request=(path="/",headers?:HeadersInit)=>new Request(`https://previews.example.test/p/${token}${path}`,{headers});
beforeEach(()=>{fetcher=vi.fn<typeof fetch>(async()=>Response.json(resolution()));get=vi.fn<FactoryPreviewEnv["SITES"]["get"]>(async()=>({size:body.length,arrayBuffer:async()=>Uint8Array.from(body).buffer}));env={FACTORY_RESOLVER_URL:"https://www.tailoredagents.com/api/integrations/factory/preview",FACTORY_PREVIEW_SECRET:secret,SITES:{get}};});
afterEach(()=>vi.unstubAllGlobals());
describe("Isolated preview capability service",()=>{
  it("serves named previews and preserves their relative asset/navigation base",async()=>{
    const url="https://previews.example.test/p/cosmos-heating-air";
    const redirect=await serveFactoryPreview(new Request(url),env,fetcher);
    expect(redirect.status).toBe(308);expect(redirect.headers.get("location")).toBe("/p/cosmos-heating-air/");
    expect((await serveFactoryPreview(new Request(url+"/"),env,fetcher)).status).toBe(200);
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({token:"cosmos-heating-air",verification:false});
    fetcher.mockResolvedValueOnce(new Response(null,{status:404}));
    expect((await serveFactoryPreview(new Request(url+"/"),env,fetcher)).status).toBe(404);
  });
  it("resolves every request without caching and serves only the exact checked bytes",async()=>{
    const response=await serveFactoryPreview(request(),env,fetcher);expect(response.status).toBe(200);expect(await response.text()).toContain("Preview");expect(response.headers.get("cache-control")).toBe("no-store");expect(response.headers.get("content-security-policy")).toContain("form-action 'none'");expect(response.headers.get("x-robots-tag")).toContain("noindex");expect(get).toHaveBeenCalledWith(prefix+"index.html");
    fetcher.mockResolvedValueOnce(new Response(null,{status:404}));expect((await serveFactoryPreview(request(),env,fetcher)).status).toBe(404);expect(fetcher).toHaveBeenCalledTimes(2);expect(get).toHaveBeenCalledTimes(1);
  });
  it("hides source archives and unlisted files and refuses unsafe paths/methods",async()=>{
    for(const path of ["source.zip","../source.zip","%2e%2e%2fsource.zip","assets/%5csecret.js","missing.html"]){expect((await serveFactoryPreview(request("/"+path),env,fetcher)).status).toBe(404);}
    expect(get).not.toHaveBeenCalled();expect((await serveFactoryPreview(new Request(request(),{method:"POST"}),env,fetcher)).status).toBe(404);
  });
  it("rejects expired or malformed metadata and same-size artifact substitutions",async()=>{
    fetcher.mockResolvedValueOnce(Response.json({...resolution(),expiresAt:"invalid"}));expect((await serveFactoryPreview(request(),env,fetcher)).status).toBe(404);
    fetcher.mockResolvedValueOnce(Response.json({...resolution(),expiresAt:"2000-01-01T00:00:00Z"}));expect((await serveFactoryPreview(request(),env,fetcher)).status).toBe(404);
    get.mockResolvedValueOnce({size:body.length,arrayBuffer:async()=>new Uint8Array(body.length).buffer});expect((await serveFactoryPreview(request(),env,fetcher)).status).toBe(503);
  });
  it("only lets the verification secret expose a staged preview",async()=>{
    fetcher.mockImplementation(async()=>Response.json({...resolution(),ready:false}));expect((await serveFactoryPreview(request(),env,fetcher)).status).toBe(404);expect((await serveFactoryPreview(request("/",{"x-factory-verify":"wrong"}),env,fetcher)).status).toBe(404);
    expect((await serveFactoryPreview(request("/",{"x-factory-verify":secret}),env,fetcher)).status).toBe(200);expect(JSON.parse(fetcher.mock.calls.at(-1)![1]!.body as string).verification).toBe(true);
  });
  it("does not forward the private resolver secret to another origin or follow redirects",async()=>{
    expect((await serveFactoryPreview(request(),{...env,FACTORY_RESOLVER_URL:"https://example.test/api/integrations/factory/preview"},fetcher)).status).toBe(503);expect(fetcher).not.toHaveBeenCalled();
    await serveFactoryPreview(request(),env,fetcher);expect(fetcher.mock.calls[0][1]!.redirect).toBe("error");
  });
  it("uses fetch rather than Cloudflare execution context as the request function",async()=>{
    vi.stubGlobal("fetch",fetcher);expect((await worker.fetch(request(),env,{waitUntil:vi.fn()})).status).toBe(200);
    const response=await worker.fetch(new Request(request(),{method:"HEAD"}),env,{});expect(response.status).toBe(200);expect(await response.text()).toBe("");
  });
});
