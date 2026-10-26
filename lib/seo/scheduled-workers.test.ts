import {it,expect,vi} from "vitest";
import {runScheduledWorkers} from "../../scripts/scheduled-workers.mjs";
const env={SEARCH_CONSOLE_SYNC_URL:"https://www.tailoredagents.com/api/cron/search-console",SEARCH_CONSOLE_SYNC_SECRET:"r".repeat(32),SEO_WORKER_URL:"https://www.tailoredagents.com/api/cron/seo",SEO_WORKER_SECRET:"s".repeat(32)};
it("attempts SEO even when reporting fails and retains redirect refusal",async()=>{
  const fetcher=vi.fn(async (url: URL, _options: RequestInit)=>new Response(JSON.stringify({ok:true,more:false}),{status:url.pathname.endsWith('/seo')?200:302}));
  expect(await runScheduledWorkers(env,{fetcher,log:()=>{}})).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(c=>c[1].redirect==='manual')).toBe(true);
});
it("attempts reporting when SEO is misconfigured without disclosing credentials",async()=>{
  const fetcher=vi.fn(async()=>Response.json({ok:true})),log=vi.fn();
  expect(await runScheduledWorkers({...env,SEO_WORKER_SECRET:''},{fetcher,log})).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(log.mock.calls)).not.toContain(env.SEARCH_CONSOLE_SYNC_SECRET);
});
it("honours saved-stage delay and ends within the overall allowance",async()=>{
  let elapsed=0;const delays:number[]=[];
  const fetcher=vi.fn(async()=>{elapsed+=90000;return Response.json({ok:true,more:true,retryAfterMs:2000});});
  await runScheduledWorkers({...env,SEARCH_CONSOLE_SYNC_URL:'bad'},{fetcher,now:()=>elapsed,sleep:async ms=>{elapsed+=ms;delays.push(ms);},log:()=>{}});
  expect(fetcher).toHaveBeenCalledTimes(2);expect(delays).toEqual([2050,2050]);expect(elapsed).toBeLessThanOrEqual(210000);
});
it("can disable SEO without interrupting existing reporting",async()=>{
  const fetcher=vi.fn(async()=>Response.json({ok:true,metaLeads:{checked:1},voice:{checked:1},callRecordings:{checked:1}})),log=vi.fn();
  expect(await runScheduledWorkers({...env,SEO_WORKER_URL:''},{fetcher,log})).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);expect(log.mock.calls).toHaveLength(4);
});
it("does not let a retry delay run beyond the overall deadline",async()=>{
  let elapsed=0;const sleep=vi.fn(async()=>{});
  const fetcher=vi.fn(async()=>{elapsed=209000;return Response.json({ok:true,more:true,retryAfterMs:2000});});
  await runScheduledWorkers({...env,SEARCH_CONSOLE_SYNC_URL:'bad'},{fetcher,now:()=>elapsed,sleep,log:()=>{}});
  expect(sleep).not.toHaveBeenCalled();expect(fetcher).toHaveBeenCalledTimes(1);
});

it("isolates website planning failures from reporting and SEO", async () => {
  const fetcher = vi.fn(async (url: URL) => new Response(JSON.stringify({ok: true}), {status: url.pathname.endsWith("/factory") ? 503 : 200}));
  const log = vi.fn();
  expect(await runScheduledWorkers({...env, FACTORY_WORKER_URL:"https://www.tailoredagents.com/api/cron/factory"}, {fetcher,log})).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(log.mock.calls)).not.toContain(env.SEARCH_CONSOLE_SYNC_SECRET);
});

it("uses the shared cron secret for planning and refuses other destinations", async () => {
  const fetcher = vi.fn(async (_url: URL, _options: RequestInit) => Response.json({ok:true}));
  const log = vi.fn();
  expect(await runScheduledWorkers({...env, FACTORY_WORKER_URL:"https://www.tailoredagents.com/api/cron/factory"}, {fetcher,log})).toBe(true);
  const request = fetcher.mock.calls.find(([url]) => url.pathname === "/api/cron/factory");
  expect(request?.[1].headers).toEqual({Authorization:`Bearer ${env.SEARCH_CONSOLE_SYNC_SECRET}`});
  fetcher.mockClear();
  expect(await runScheduledWorkers({...env, FACTORY_WORKER_URL:"https://example.test/api/cron/factory"}, {fetcher,log})).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
