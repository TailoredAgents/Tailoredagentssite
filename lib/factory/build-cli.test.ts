import {spawnSync} from "node:child_process";
import {describe,expect,it} from "vitest";

describe("Standalone website builder entry point",()=>{
  it("starts outside Next.js and exits with a sanitized configuration error when no database is configured",()=>{
    const result=spawnSync(process.execPath,["--conditions=react-server","--import","tsx","scripts/run-factory-build-worker.ts","--drain"],{
      cwd:process.cwd(),encoding:"utf8",timeout:20000,
      env:{...process.env,DATABASE_URL:"",FACTORY_OPENAI_API_KEY:"",OPENAI_API_KEY:"",FACTORY_R2_ACCOUNT_ID:"",FACTORY_R2_ACCESS_KEY_ID:"",FACTORY_R2_SECRET_ACCESS_KEY:""},
    });
    expect(result.error).toBeUndefined();expect(result.status).toBe(1);
    expect(result.stderr).toContain("Website builder could not initialize its database connection.");
    expect(result.stderr).not.toMatch(/Transform failed|createContext|Cannot find module|ERR_REQUIRE/);
  },25000);
});
