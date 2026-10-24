import { seoConfiguration } from "./config";
import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabasePool } from "@/lib/dashboard/db";
import { reserveCost, attemptCost, settleCost, uncertainCost } from "./budget";
import { providerJson } from "./http";
import type { SeoManager, SeoRun } from "./types";
import { z } from "zod";
const reply = z.object({
  status_code: z.number(),
  cost: z.number().nonnegative(),
  tasks: z
    .array(
      z.object({
        id: z.string().nullable(),
        status_code: z.number(),
        cost: z.number().nonnegative(),
        result: z.array(z.unknown()).nullable().optional(),
      }),
    )
    .nullable(),
});
function authorization() {
  const login = process.env.DATAFORSEO_LOGIN?.trim(),
    password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("research_not_configured");
  return {
    authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
    "content-type": "application/json",
  };
}
export async function researchStep(run: SeoRun, manager: SeoManager) {
  if (!seoConfiguration().research) throw new Error("research_not_configured");
  const pool = getDatabasePool();
  for (const keyword of manager.keywords.slice(0, 50))
    for (const location of ["United States", ...manager.local_markets])
      for (const device of ["desktop", "mobile"]) {
        await pool.query(
          "INSERT INTO seo_research(id,workspace_id,site_id,run_id,keyword,location,device) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(run_id,keyword,location,device) DO NOTHING",
          [
            randomUUID(),
            run.workspace_id,
            run.site_id,
            run.id,
            keyword,
            location,
            device,
          ],
        );
      }
  const queued = (
    await pool.query(
      "SELECT * FROM seo_research WHERE run_id=$1 AND status='queued' ORDER BY id LIMIT 100",
      [run.id],
    )
  ).rows;
  if (queued.length) {
    const key = `${run.id}:research:${queued.map((r) => r.id).join(":")}`;
    const receipt = await reserveCost({
      workspace: run.workspace_id,
      site: run.site_id,
      run: run.id,
      key,
      provider: "dataforseo",
      operation: "google_organic_standard",
      micros: queued.length * 3000,
    });
    try {
      await attemptCost(receipt);
      const raw = reply.parse(
        await providerJson(
          "https://api.dataforseo.com/v3/serp/google/organic/task_post",
          {
            method: "POST",
            headers: authorization(),
            body: JSON.stringify(
              queued.map((r) => ({
                keyword: r.keyword,
                location_name: r.location,
                language_code: "en",
                device: r.device,
                depth: 50,
                priority: 1,
                tag: r.id,
              })),
            ),
          },
        ),
      );
      await settleCost(receipt, Math.ceil(raw.cost * 1_000_000), null, {
        tasks: raw.tasks?.length || 0,
        unit: "USD",
        depth: 50,
      });
      if (raw.status_code !== 20000 || raw.tasks?.length !== queued.length)
        throw new Error("research_result_unconfirmed");
      for (let i = 0; i < queued.length; i++) {
        const task = raw.tasks[i];
        await pool.query(
          "UPDATE seo_research SET status=$2,provider_task_id=$3,checked_at=now() WHERE id=$1 AND status='queued'",
          [
            queued[i].id,
            [20000, 20100].includes(task.status_code) && task.id
              ? "pending"
              : "failed",
            task.id,
          ],
        );
      }
    } catch (error) {
      await uncertainCost(receipt);
      await pool.query(
        "UPDATE seo_research SET status='uncertain' WHERE id=ANY($1::uuid[]) AND status='queued'",
        [queued.map((r) => r.id)],
      );
      throw error;
    }
    return { more: true };
  }
  const pending = (
    await pool.query(
      "SELECT * FROM seo_research WHERE run_id=$1 AND status='pending' ORDER BY checked_at NULLS FIRST,id LIMIT 20",
      [run.id],
    )
  ).rows;
  const retrievals = await Promise.allSettled(
    pending.map(async (row) => {
      if (!/^[0-9a-z-]{8,100}$/i.test(row.provider_task_id))
        throw new Error("invalid_research_task");
      const result = reply.parse(
        await providerJson(
          `https://api.dataforseo.com/v3/serp/google/organic/task_get/advanced/${row.provider_task_id}`,
          { method: "GET", headers: authorization() },
        ),
      );
      const task = result.tasks?.[0];
      if (task?.status_code === 20000) {
        const page = z
          .object({
            items: z
              .array(
                z.object({
                  type: z.string(),
                  url: z.string().optional(),
                  title: z.string().optional(),
                  description: z.string().optional(),
                  rank_absolute: z.number().optional(),
                  rank_group: z.number().optional(),
                  domain: z.string().optional(),
                }),
              )
              .nullable()
              .optional(),
            datetime: z.string().optional(),
          })
          .passthrough()
          .parse(task.result?.[0]);
        const items = (page.items || [])
          .filter((i) => i.type === "organic")
          .slice(0, 50)
          .map((i) => ({
            url: (i.url || "").slice(0, 2000),
            title: (i.title || "").slice(0, 300),
            description: (i.description || "").slice(0, 800),
            position: i.rank_group ?? i.rank_absolute ?? null,
            domain: (i.domain || "").slice(0, 300),
          }));
        await pool.query(
          "UPDATE seo_research SET status='ready',result=$2,checked_at=now() WHERE id=$1",
          [
            row.id,
            JSON.stringify({
              items,
              observedAt: page.datetime || new Date().toISOString(),
              note: "Location/device-specific retrieval, not personalized results.",
            }),
          ],
        );
      } else
        await pool.query(
          "UPDATE seo_research SET status=$2,checked_at=now() WHERE id=$1",
          [
            row.id,
            task && [20100, 40601, 40602].includes(task.status_code)
              ? "pending"
              : "failed",
          ],
        );
    }),
  );
  // GET retrievals are free and repeatable. Inspect every result, preserving
  // successful rows while transient failures stay pending until the 24h bound.
  for (let index = 0; index < retrievals.length; index++)
    if (retrievals[index].status === "rejected") {
      await pool.query(
        "UPDATE seo_research SET checked_at=now() WHERE id=$1 AND status='pending'",
        [pending[index].id],
      );
    }
  const remaining = await pool.query(
    "SELECT 1 FROM seo_research WHERE run_id=$1 AND status IN ('queued','pending') LIMIT 1",
    [run.id],
  );
  return { more: Boolean(remaining.rowCount) };
}
