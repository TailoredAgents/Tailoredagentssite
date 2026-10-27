import {createHash,randomUUID} from "node:crypto";
import {beforeEach,describe,expect,it,vi} from "vitest";
import type {DashboardContext} from "@/lib/dashboard/data";
import {fixtureBlueprint,fixtureSitePlan} from "./site/fixtures";
const f=vi.hoisted(()=>({authorize:vi.fn(),query:vi.fn(),transaction:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("./data",()=>({authorizeFactory:f.authorize,factoryTransaction:f.transaction}));
import {downloadFactoryDraftDiagnostic} from "./draft-diagnostic";
const workspaceId=randomUUID(),versionId=randomUUID(),prefix=`factory/${workspaceId}/${randomUUID()}/${versionId}/`;
const context={workspace:{id:workspaceId},user:{id:"diagnostic-owner"},role:"owner"} as DashboardContext;
const bytes=Buffer.from("Synthetic saved asset: encoder is checked in diagnostic tests.");
const sha256=createHash("sha256").update(bytes).digest("hex");
function row(){return {version:6,status:"failed",storage_prefix:prefix,approved_plan:fixtureSitePlan,working_data:{blueprint:fixtureBlueprint(),heroKey:`${prefix}assets/hero.png`,inputUploads:[],imageAssets:{hero:{key:`${prefix}assets/hero.png`,sha256,inputHash:"a".repeat(64)}},generationResponse:{secret:"must-not-be-exported"},activity:{stage:"qa"}}};}
beforeEach(()=>{for(const mock of Object.values(f))mock.mockReset();f.authorize.mockResolvedValue("owner");f.transaction.mockImplementation((_id,work)=>work({query:f.query}));f.query.mockImplementation(async()=>({rows:[row()]}));});
describe("Private saved draft diagnostics",()=>{
  it("exports only the validated plan/blueprint and exact saved images after two access checks",async()=>{
    const storage={get:vi.fn(async()=>bytes)},result=await downloadFactoryDraftDiagnostic(context,versionId,storage);
    expect(result.filename).toBe("website-v6-private-diagnostic.zip");expect(result.bytes.subarray(0,4).toString("hex")).toBe("504b0304");
    const content=Buffer.from(result.bytes).toString();expect(content).toContain("factory-draft-diagnostic");expect(content).toContain("images/hero.png");expect(content).not.toContain(prefix);expect(content).not.toContain("must-not-be-exported");expect(content).not.toContain("inputHash");
    expect(storage.get).toHaveBeenCalledExactlyOnceWith(`${prefix}assets/hero.png`,8_000_000);
    expect(f.authorize).toHaveBeenCalledTimes(2);expect(f.authorize).toHaveBeenCalledWith({query:f.query},context,"manage");
    expect(f.query.mock.calls[0][0]).toContain("l.anonymized_at IS NULL");expect(f.query.mock.calls[0][1]).toEqual([versionId,workspaceId]);
  });
  it("denies members and foreign or deleted drafts before storage access",async()=>{
    const storage={get:vi.fn(async()=>bytes)};f.authorize.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(downloadFactoryDraftDiagnostic(context,versionId,storage)).rejects.toThrow("Forbidden");
    f.query.mockResolvedValueOnce({rows:[]});await expect(downloadFactoryDraftDiagnostic(context,versionId,storage)).rejects.toThrow("complete diagnostic");expect(storage.get).not.toHaveBeenCalled();
  });
  it("discards the archive when access is revoked or the draft changes during image reads",async()=>{
    f.authorize.mockResolvedValueOnce("owner").mockRejectedValueOnce(new Error("Revoked"));
    await expect(downloadFactoryDraftDiagnostic(context,versionId,{get:async()=>bytes})).rejects.toThrow("Revoked");
    f.authorize.mockResolvedValue("owner");let reads=0;f.query.mockImplementation(async()=>{const saved=row();if(++reads===2)saved.working_data.blueprint.tagline="Changed saved draft";return {rows:[saved]};});
    await expect(downloadFactoryDraftDiagnostic(context,versionId,{get:async()=>bytes})).rejects.toThrow("draft changed");
  });
  it("rejects incomplete or cross-build image checkpoints and corrupt bytes",async()=>{
    const saved=row();saved.working_data.imageAssets.hero.key=prefix.replace(versionId,randomUUID())+"assets/hero.png";f.query.mockResolvedValueOnce({rows:[saved]});
    await expect(downloadFactoryDraftDiagnostic(context,versionId,{get:async()=>bytes})).rejects.toThrow("complete diagnostic");
    await expect(downloadFactoryDraftDiagnostic(context,versionId,{get:async()=>Buffer.from("wrong image")})).rejects.toThrow("image could not be verified");
  });
});
