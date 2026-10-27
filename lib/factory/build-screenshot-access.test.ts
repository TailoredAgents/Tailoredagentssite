import {randomUUID} from "node:crypto";
import {beforeEach,describe,expect,it,vi} from "vitest";
import type {DashboardContext} from "@/lib/dashboard/data";
const f=vi.hoisted(()=>({authorize:vi.fn(),query:vi.fn(),transaction:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("./data",()=>({authorizeFactory:f.authorize,factoryTransaction:f.transaction}));
vi.mock("@/lib/dashboard/db",()=>({getDatabasePool:()=>({})}));
vi.mock("./build-config",()=>({factoryBuildConfiguration:()=>({configured:true})}));
import {getFactoryScreenshotDownload} from "./build-data";
import {factoryFailureScreenshotKey} from "./build-failure-evidence";
const workspaceId=randomUUID(),versionId=randomUUID(),prefix=`factory/${workspaceId}/${randomUUID()}/${versionId}/`;
const context={workspace:{id:workspaceId},user:{id:"test-member"},role:"member"} as DashboardContext;
const page="contact/index.html",storageKey=factoryFailureScreenshotKey(prefix,page,"mobile");
beforeEach(()=>{
  for(const mock of Object.values(f))mock.mockReset();f.authorize.mockResolvedValue("member");f.transaction.mockImplementation((_id,work)=>work({query:f.query}));
  f.query.mockResolvedValue({rows:[{version:5,status:"failed",storage_prefix:prefix,failed_qa:{checkedAt:"2026-10-27T12:00:00Z",issues:[],screenshots:{},pageScreenshots:[{page,viewport:"mobile",storageKey}]}}]});
});
describe("Failed website screenshot authorization",()=>{
  it("requires workspace membership and scopes lookup to an active lead in that workspace",async()=>{
    expect((await getFactoryScreenshotDownload(context,versionId,"mobile",page)).storageKey).toBe(storageKey);
    expect(f.authorize).toHaveBeenCalledWith({query:f.query},context);expect(f.transaction).toHaveBeenCalledWith(workspaceId,expect.any(Function));
    expect(f.query).toHaveBeenCalledWith(expect.stringContaining("v.workspace_id=$2"),[versionId,workspaceId]);
    expect(f.query.mock.calls[0][0]).toContain("l.anonymized_at IS NULL");expect(f.query.mock.calls[0][0]).toContain("v.status IN ('ready','failed')");
    f.authorize.mockRejectedValueOnce(new Error("No workspace membership"));await expect(getFactoryScreenshotDownload(context,versionId,"mobile",page)).rejects.toThrow("No workspace membership");expect(f.query).toHaveBeenCalledTimes(1);
  });
  it("rejects missing/foreign builds and a path outside the selected page and version",async()=>{
    f.query.mockResolvedValueOnce({rows:[]});await expect(getFactoryScreenshotDownload(context,versionId,"mobile",page)).rejects.toThrow("not available");
    await expect(getFactoryScreenshotDownload(context,versionId,"mobile","services/index.html")).rejects.toThrow("not available");
    f.query.mockResolvedValueOnce({rows:[{version:5,status:"failed",storage_prefix:prefix,failed_qa:{checkedAt:"2026-10-27T12:00:00Z",issues:[],screenshots:{},pageScreenshots:[{page,viewport:"mobile",storageKey:storageKey.replace(versionId,randomUUID())}]}}]});
    await expect(getFactoryScreenshotDownload(context,versionId,"mobile",page)).rejects.toThrow("not available");
  });
  it("never interprets page as an object key and retains legacy Home reads",async()=>{
    await expect(getFactoryScreenshotDownload(context,versionId,"desktop","../index.html")).rejects.toThrow("available preview screenshot");expect(f.query).not.toHaveBeenCalled();
    f.query.mockResolvedValueOnce({rows:[{version:1,status:"failed",storage_prefix:prefix,failed_qa:{checkedAt:"2026-10-27T12:00:00Z",issues:[],screenshots:{desktop:`${prefix}failed/screenshots/desktop.png`}}}]});
    expect((await getFactoryScreenshotDownload(context,versionId,"desktop")).storageKey).toBe(`${prefix}failed/screenshots/desktop.png`);
  });
  it("restricts successful-page evidence to the renderer's exact key convention",async()=>{
    const row={version:2,status:"ready",storage_prefix:prefix,qa_report:{screenshots:{desktop:`${prefix}screenshots/desktop.png`},pageScreenshots:[{page,viewport:"mobile",storageKey:`${prefix}pages/screenshots/contact-mobile.png`}]}};
    f.query.mockResolvedValueOnce({rows:[row]});expect((await getFactoryScreenshotDownload(context,versionId,"mobile",page)).storageKey).toBe(`${prefix}pages/screenshots/contact-mobile.png`);
    row.qa_report.pageScreenshots[0].storageKey=`${prefix}assets/private.png`;f.query.mockResolvedValueOnce({rows:[row]});await expect(getFactoryScreenshotDownload(context,versionId,"mobile",page)).rejects.toThrow("not available");
  });
});
