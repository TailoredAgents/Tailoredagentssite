import {beforeEach,describe,it,expect,vi} from "vitest";
const lookup=vi.hoisted(()=>vi.fn());
vi.mock("server-only",()=>({}));
vi.mock("./build-data",()=>({getFactoryPreviewResolution:lookup,factoryPreviewUrl:(slug:string)=>`https://previews.example.test/p/${slug}/`}));
import {GET} from "../../app/preview/[slug]/route";
const request=(slug:string)=>GET(new Request(`https://www.tailoredagents.com/preview/${slug}`),{params:Promise.resolve({slug})});
beforeEach(()=>lookup.mockReset());
describe("Branded preview entry links",()=>{
  it("redirects ready aliases to the isolated host without caching",async()=>{
    lookup.mockResolvedValue({ready:true});const response=await request("cosmos-heating-air");
    expect(response.status).toBe(307);expect(response.headers.get("location")).toBe("https://previews.example.test/p/cosmos-heating-air/");expect(response.headers.get("cache-control")).toBe("no-store");expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
  it("does not redirect missing, revoked, expired, unfinished or invalid links",async()=>{
    for(const result of [null,{ready:false}]){lookup.mockResolvedValueOnce(result);expect((await request("cosmos-heating-air")).status).toBe(404);}
    lookup.mockClear();expect((await request("..%2fprivate")).status).toBe(404);expect(lookup).not.toHaveBeenCalled();
    lookup.mockRejectedValueOnce(new Error("Database unavailable"));expect((await request("cosmos-heating-air")).status).toBe(503);
  });
});
