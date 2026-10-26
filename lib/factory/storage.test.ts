import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {factoryStorage,validFactoryObjectKey} from "./storage";

const origin="https://synthetic-previews.onrender.com",secret="synthetic-private-storage-secret-".repeat(2);
const workspace="00000000-0000-4000-8000-000000000001",project="00000000-0000-4000-8000-000000000002",version="00000000-0000-4000-8000-000000000003";
const prefix=`factory/${workspace}/${project}/${version}/`,key=prefix+"preview/index.html",upload=`factory/${workspace}/${project}/uploads/${version}.png`;
let fetcher:ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(()=>{
  vi.stubEnv("FACTORY_STORAGE_URL",origin);vi.stubEnv("FACTORY_STORAGE_SECRET",secret);
  fetcher=vi.fn<typeof fetch>(async()=>new Response(null,{status:204}));vi.stubGlobal("fetch",fetcher);
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

describe("Authenticated Render artifact storage",()=>{
  it("uploads exact bytes with private bearer authentication, no caching, no redirects and a timeout",async()=>{
    const bytes=new Uint8Array([0,1,2,255]);await factoryStorage().put(key,bytes,"text/html; charset=utf-8");
    const [url,options]=fetcher.mock.calls[0];expect(String(url)).toBe(`${origin}/internal/storage/object?key=${encodeURIComponent(key)}`);
    expect(options).toMatchObject({method:"PUT",headers:{authorization:`Bearer ${secret}`,"content-type":"text/html; charset=utf-8"},cache:"no-store",redirect:"error"});
    expect(options?.signal).toBeInstanceOf(AbortSignal);expect(options?.body).toEqual(bytes);expect(String(url)).not.toContain(secret);
  });
  it("requests bounded object reads and returns binary data",async()=>{
    fetcher.mockResolvedValueOnce(new Response(new Uint8Array([0,1,255]),{headers:{"content-length":"3"}}));
    expect(await factoryStorage().get(key,8)).toEqual(Buffer.from([0,1,255]));
    const [url,options]=fetcher.mock.calls[0];expect(String(url)).toBe(`${origin}/internal/storage/object?key=${encodeURIComponent(key)}&maxBytes=8`);expect(options?.method).toBe("GET");expect(options?.cache).toBe("no-store");expect(options?.redirect).toBe("error");expect(options?.headers).toEqual({authorization:`Bearer ${secret}`});
  });
  it("deletes only the exact build directory or uploaded image",async()=>{
    const storage=factoryStorage();await storage.deletePrefix(prefix);await storage.deletePrefix(upload);
    expect(String(fetcher.mock.calls[0][0])).toBe(`${origin}/internal/storage/prefix?prefix=${encodeURIComponent(prefix)}`);expect(fetcher.mock.calls[0][1]?.method).toBe("DELETE");
    expect(String(fetcher.mock.calls[1][0])).toBe(`${origin}/internal/storage/prefix?prefix=${encodeURIComponent(upload)}`);
  });
  it("rejects traversal, malformed content, oversized writes and invalid read limits before network access",async()=>{
    const storage=factoryStorage();
    for(const value of ["../../source.zip",prefix+"../source.zip",prefix+"a//b",prefix+"a\\b",prefix+"%2e%2e/file",prefix+"a".repeat(500)]){
      expect(()=>validFactoryObjectKey(value)).toThrow("Invalid website storage path");await expect(storage.get(value)).rejects.toThrow("Invalid website storage path");
    }
    for(const value of [0,-1,1.5,NaN,Infinity,64_000_001])await expect(storage.get(key,value)).rejects.toThrow("Invalid website artifact size limit");
    await expect(storage.put(key,new Uint8Array(64_000_001),"image/png")).rejects.toThrow("too large");
    await expect(storage.put(key,new Uint8Array(1),"text/html\r\nAuthorization: leaked")).rejects.toThrow("content type");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects broad or partial cleanup scopes before network access",async()=>{
    const storage=factoryStorage();
    for(const value of ["factory/",`factory/${workspace}/`,`factory/${workspace}/${project}/`,prefix+"preview/",prefix+"source.zip",`factory/${workspace}/${project}/uploads/`,upload+"/"])
      await expect(storage.deletePrefix(value)).rejects.toThrow(/Invalid website (cleanup scope|storage path)/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("enforces declared and streamed read limits and cancels oversized streams",async()=>{
    const cancelled=vi.fn();fetcher.mockResolvedValueOnce(new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1]));},cancel:cancelled}),{headers:{"content-length":"9"}}));
    await expect(factoryStorage().get(key,8)).rejects.toThrow("too large");expect(cancelled).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValueOnce(new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(9));},cancel:cancelled})));
    await expect(factoryStorage().get(key,8)).rejects.toThrow("too large");expect(cancelled).toHaveBeenCalledTimes(2);
  });
  it("rejects malformed or truncated responses without exposing their content",async()=>{
    for(const contentLength of ["malformed","-1","1.2","9007199254740993","3"]){
      fetcher.mockResolvedValueOnce(new Response(new Uint8Array([1]),{headers:{"content-length":contentLength}}));await expect(factoryStorage().get(key,8)).rejects.toThrow("unavailable");
    }
    fetcher.mockResolvedValueOnce(new Response(null));await expect(factoryStorage().get(key)).rejects.toThrow("unavailable");
  });
  it("does not accept redirects, unexpected successes or private error bodies",async()=>{
    for(const status of [201,206,301,307,403,500]){
      fetcher.mockResolvedValueOnce(new Response("private provider response must not escape",{status}));await expect(factoryStorage().get(key)).rejects.toThrow("Website storage could not complete the request.");
    }
    fetcher.mockResolvedValueOnce(new Response("private missing object path",{status:404}));await expect(factoryStorage().get(key)).rejects.toThrow("The website artifact is unavailable.");
    fetcher.mockRejectedValueOnce(new Error(`upstream error includes ${secret}`));await expect(factoryStorage().put(key,new Uint8Array([1]),"image/png")).rejects.toThrow("Website storage could not complete the request.");
    fetcher.mockResolvedValueOnce(new Response("unexpected mutation response"));await expect(factoryStorage().deletePrefix(prefix)).rejects.toThrow("Website storage could not complete the request.");
  });
  it("fails closed for missing Render authentication before any storage request",()=>{
    vi.stubEnv("FACTORY_STORAGE_SECRET",undefined);expect(()=>factoryStorage()).toThrow("not configured");expect(fetcher).not.toHaveBeenCalled();
  });
});
