import {describe,it,expect,vi} from "vitest";
import {siteManifest,type SiteFiles} from "./site/artifacts";
import {factoryManifestFingerprint,factoryPublicWindowOpen,verifyFactoryPublicArtifacts} from "./public-verification";

const token="a".repeat(48),base=`https://previews.example.test/p/${token}/`,share="https://www.tailoredagents.com/preview/example-business";
const paths=["assets/identity/favicon-32.png","assets/identity/favicon-64.png","assets/identity/apple-touch-icon.png","assets/identity/social-card.jpg"];
function fixture(change?:{page?:string;key?:string;value?:string}){
  const files:SiteFiles={};
  for(const path of paths)files[path]=Buffer.from(`Synthetic validated-asset stand-in ${path}`);
  for(const page of ["index.html","services/index.html"]){
    const tags:Record<string,string>={"og:title":"Example business","og:description":"A useful website concept.","og:image:alt":"Example business concept card","og:type":"website","og:url":new URL(page,base).href,"og:image":base+paths[3],"og:image:width":"1200","og:image:height":"630","twitter:card":"summary_large_image","twitter:image":base+paths[3]};
    if(change?.page===page&&change.key)tags[change.key]=change.value!;
    files[page]=Buffer.from(`<!doctype html><html><head>${Object.entries(tags).map(([key,value])=>`<meta ${key.startsWith("og:")?"property":"name"}="${key}" content="${value}">`).join("")}</head><body>Example</body></html>`);
  }
  const manifest=siteManifest(files);
  const fetcher=vi.fn<typeof fetch>(async(input,options)=>{
    expect(options?.redirect).toBe("manual");expect(options?.credentials).toBe("omit");expect(new Headers(options?.headers).get("authorization")).toBeNull();expect(new Headers(options?.headers).get("x-factory-verify")).toBeNull();
    const url=String(input);
    if(url===share)return new Response(null,{status:307,headers:{location:"https://previews.example.test/p/example-business/"}});
    const path=url==="https://previews.example.test/p/example-business/"||url===base?"index.html":url.startsWith(base)?url.slice(base.length):"";
    const file=manifest.files.find(file=>file.path===path);
    return file?new Response(Uint8Array.from(files[path]),{headers:{"content-type":file.contentType,"x-robots-tag":"noindex, nofollow"}}):new Response(null,{status:404});
  });
  return {files,manifest,fetcher};
}
describe("Anonymous sharing verification",()=>{
  it("follows only the intended short-link redirect and verifies every page and identity file without secrets",async()=>{
    const f=fixture(),result=await verifyFactoryPublicArtifacts({previewUrl:base,shareUrl:share,manifest:f.manifest},f.fetcher);
    expect(result).toMatchObject({url:share,status:200,manifestHash:factoryManifestFingerprint(f.manifest)});
    expect(f.fetcher).toHaveBeenCalledTimes(7);expect(f.fetcher.mock.calls.some(([url])=>String(url).endsWith("services/index.html"))).toBe(true);
  });
  it("handles legacy token entry links for a new metadata-enabled bundle",async()=>{
    const f=fixture();expect((await verifyFactoryPublicArtifacts({previewUrl:base,shareUrl:base,manifest:f.manifest},f.fetcher)).status).toBe(200);
  });
  it.each(["https://evil.example/p/example-business/","https://previews.example.test/p/other-business/","http://previews.example.test/p/example-business/","http://["])("does not follow an unexpected redirect %s",async location=>{
    const f=fixture();f.fetcher.mockResolvedValueOnce(new Response(null,{status:307,headers:{location}}));
    await expect(verifyFactoryPublicArtifacts({previewUrl:base,shareUrl:share,manifest:f.manifest},f.fetcher)).rejects.toThrow("public preview");expect(f.fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["og:image","twitter:image","og:url"])("rejects a checked artifact with stale or remote %s metadata without fetching that URL",async key=>{
    const f=fixture({page:"services/index.html",key,value:"https://other.example/private"});
    await expect(verifyFactoryPublicArtifacts({previewUrl:base,shareUrl:share,manifest:f.manifest},f.fetcher)).rejects.toThrow("public preview");
    expect(f.fetcher.mock.calls.every(([url])=>!String(url).includes("other.example"))).toBe(true);
  });
  it.each(["missing","modified","mime","redirect"])("rejects an anonymously unavailable identity asset: %s",async fault=>{
    const f=fixture(),original=f.fetcher.getMockImplementation()!;
    f.fetcher.mockImplementation(async(input,options)=>{
      if(String(input).endsWith("social-card.jpg"))return fault==="missing"?new Response(null,{status:404}):fault==="redirect"?new Response(null,{status:302,headers:{location:"https://other.example/card.jpg"}}):new Response(fault==="modified"?"incorrect image":Uint8Array.from(f.files[paths[3]]),{headers:{"content-type":fault==="mime"?"text/html":"image/jpeg","x-robots-tag":"noindex"}});
      return original(input,options);
    });
    await expect(verifyFactoryPublicArtifacts({previewUrl:base,shareUrl:share,manifest:f.manifest},f.fetcher)).rejects.toThrow("public preview");
  });
  it("bounds oversized responses and refuses unsafe manifest paths before fetching",async()=>{
    const f=fixture();f.fetcher.mockResolvedValueOnce(new Response("x".repeat(f.files["index.html"].length+1),{headers:{"content-type":"text/html","x-robots-tag":"noindex"}}));
    await expect(verifyFactoryPublicArtifacts({previewUrl:base,shareUrl:base,manifest:f.manifest},f.fetcher)).rejects.toThrow("public preview");
    f.fetcher.mockClear();f.manifest.files.push({...f.manifest.files[0],path:"//internal.example/index.html"});
    await expect(verifyFactoryPublicArtifacts({previewUrl:base,shareUrl:base,manifest:f.manifest},f.fetcher)).rejects.toThrow();expect(f.fetcher).not.toHaveBeenCalled();
  });
  it("reports fetch failures without leaking upstream detail",async()=>{
    const f=fixture();f.fetcher.mockRejectedValueOnce(Error("Upstream secret detail"));
    await expect(verifyFactoryPublicArtifacts({previewUrl:base,shareUrl:share,manifest:f.manifest},f.fetcher)).rejects.toThrow("Saved pages and images are retained");
  });
  it("reports truncated network streams without leaking upstream details",async()=>{
    const f=fixture(),body=new ReadableStream({start(controller){controller.error(new Error("Upstream detail"));}});
    f.fetcher.mockResolvedValueOnce(new Response(body,{headers:{"content-type":"text/html","x-robots-tag":"noindex"}}));
    await expect(verifyFactoryPublicArtifacts({previewUrl:base,shareUrl:base,manifest:f.manifest},f.fetcher)).rejects.toThrow("Saved pages and images are retained");
  });
});
describe("Lease-bound public check window",()=>{
  const now=Date.now(),manifest=fixture().manifest,window={leaseToken:"lease-a",manifestHash:factoryManifestFingerprint(manifest),checkedAt:new Date(now-1000).toISOString()};
  const valid={status:"running",stage:"verify",leaseToken:"lease-a",leaseUntil:new Date(now+60000),manifest,qaPassed:true,window};
  it("opens only for the exact privately verified manifest and lease",()=>{
    expect(factoryPublicWindowOpen(valid,now)).toBe(true);
    // PostgreSQL jsonb order does not invalidate the manifest fingerprint.
    expect(factoryManifestFingerprint({...manifest,files:[...manifest.files].reverse()})).toBe(window.manifestHash);
  });
  it.each([{status:"failed"},{status:"queued"},{stage:"qa"},{leaseToken:"new-lease"},{qaPassed:false},{leaseUntil:"invalid"},{leaseUntil:new Date(now-1)},{window:{...window,checkedAt:new Date(now-300001).toISOString()}},{window:{...window,checkedAt:new Date(now+1000).toISOString()}},{window:{...window,manifestHash:"b".repeat(64)}}])("closes on invalid stage, lease, QA or receipt: %j",change=>{
    expect(factoryPublicWindowOpen({...valid,...change},now)).toBe(false);
  });
});
