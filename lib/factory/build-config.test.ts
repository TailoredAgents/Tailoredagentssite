import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {factoryBuildConfiguration,factoryStorageConfiguration} from "./build-config";

const keys=["FACTORY_STORAGE_URL","FACTORY_STORAGE_SECRET","FACTORY_R2_ACCOUNT_ID","FACTORY_R2_ACCESS_KEY_ID","FACTORY_R2_SECRET_ACCESS_KEY","FACTORY_R2_BUCKET","FACTORY_PREVIEW_ORIGIN","FACTORY_PREVIEW_SECRET","FACTORY_OPENAI_API_KEY","OPENAI_API_KEY"];
const secret="synthetic-storage-key-".repeat(3),origin="https://tailored-agents-site-previews.onrender.com";
function r2(){vi.stubEnv("FACTORY_R2_ACCOUNT_ID","a".repeat(32));vi.stubEnv("FACTORY_R2_ACCESS_KEY_ID","synthetic-access-key");vi.stubEnv("FACTORY_R2_SECRET_ACCESS_KEY","synthetic-secret-key");vi.stubEnv("FACTORY_R2_BUCKET","synthetic-preview-bucket");}
function render(){vi.stubEnv("FACTORY_STORAGE_URL",origin);vi.stubEnv("FACTORY_STORAGE_SECRET",secret);}
beforeEach(()=>{for(const key of keys)vi.stubEnv(key,undefined);});
afterEach(()=>vi.unstubAllEnvs());

describe("Website storage and builder readiness",()=>{
  it("selects Render explicitly without requiring any Cloudflare credentials",()=>{
    render();vi.stubEnv("FACTORY_R2_BUCKET","old-unused-bucket");
    expect(factoryStorageConfiguration()).toEqual({backend:"render",origin,secret});
    vi.stubEnv("FACTORY_OPENAI_API_KEY","synthetic-openai-key");vi.stubEnv("FACTORY_PREVIEW_ORIGIN",origin);vi.stubEnv("FACTORY_PREVIEW_SECRET","synthetic-preview-secret-".repeat(3));
    expect(factoryBuildConfiguration()).toEqual({configured:true,reason:null});
  });
  it("preserves the R2 adapter only when a Render URL is not configured",()=>{
    r2();expect(factoryStorageConfiguration()).toMatchObject({backend:"r2",bucket:"synthetic-preview-bucket"});
    render();expect(factoryStorageConfiguration()?.backend).toBe("render");
    vi.stubEnv("FACTORY_STORAGE_SECRET",undefined);expect(factoryStorageConfiguration()).toBeNull();
    vi.stubEnv("FACTORY_STORAGE_URL","");expect(factoryStorageConfiguration()).toBeNull();
  });
  it.each([
    "http://preview.onrender.com","https://user:password@preview.onrender.com","https://preview.onrender.com/path","https://preview.onrender.com/a/..",
    "https://preview.onrender.com?query=1","https://preview.onrender.com/#hash","https://preview.onrender.com/\\path","https://localhost","https://127.0.0.1",
    "https://[::1]","https://localhost.localdomain","https://service.localhost","https://service.local","https://service.internal","https://2130706433","https://preview.onrender.com."
  ])("fails closed for invalid or local storage origin %s",value=>{
    r2();render();vi.stubEnv("FACTORY_STORAGE_URL",value);expect(factoryStorageConfiguration()).toBeNull();
  });
  it("rejects short or header-incompatible storage keys",()=>{
    render();for(const value of ["too-short",secret+"\r\nmalformed",secret+"\tmalformed",secret+"\x7f",secret+"\u2603","a".repeat(4097)]){vi.stubEnv("FACTORY_STORAGE_SECRET",value);expect(factoryStorageConfiguration()).toBeNull();}
  });
  it("reports AI, storage, isolated preview origin and preview secret separately",()=>{
    expect(factoryBuildConfiguration().reason).toContain("OpenAI");vi.stubEnv("OPENAI_API_KEY","synthetic-openai-key");
    expect(factoryBuildConfiguration().reason).toContain("storage");render();
    expect(factoryBuildConfiguration().reason).toContain("separate preview domain");
    for(const value of ["https://www.tailoredagents.com","https://mail.tailoredagents.com","https://localhost","https://preview.onrender.com/private"]){vi.stubEnv("FACTORY_PREVIEW_ORIGIN",value);expect(factoryBuildConfiguration().reason).toContain("separate preview domain");}
    vi.stubEnv("FACTORY_PREVIEW_ORIGIN",origin);expect(factoryBuildConfiguration().reason).toContain("preview service");
    vi.stubEnv("FACTORY_PREVIEW_SECRET",secret);expect(factoryBuildConfiguration().configured).toBe(true);
    vi.stubEnv("FACTORY_PREVIEW_SECRET",secret+"\u2603");expect(factoryBuildConfiguration().reason).toContain("preview service");
  });
});
