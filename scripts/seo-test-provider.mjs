// Exact loopback-only fixture. No live AI, SEO provider or customer records.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
const url = new URL(process.env.SEO_TEST_DATABASE_URL || "");
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "55433" ||
  url.pathname !== "/ta_seo_browser_test" ||
  url.search ||
  url.hash
)
  throw new Error("Use exact disposable SEO browser database.");
const pool = new pg.Pool({ connectionString: url.toString(), max: 2 }),
  ws = "00000000-0000-4000-8000-000000000001",
  site = "00000000-0000-4000-8000-000000000002";
await pool.query(
  "CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())",
);
for (const f of (await readdir("db/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  if (
    (await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1", [f]))
      .rowCount
  )
    continue;
  await pool.query(await readFile("db/migrations/" + f, "utf8"));
  await pool.query("INSERT INTO schema_migrations(filename) VALUES($1)", [f]);
}
const password = await hashPassword("Seo-test-password-2026");
let tasks = new Map(),
  modelCalls = 0;
async function reset() {
  tasks = new Map();
  modelCalls = 0;
  await pool.query(
    'TRUNCATE seo_managers,"user",analytics_events,integration_connections CASCADE',
  );
  await pool.query(
    "INSERT INTO sites(id,workspace_id,name,url,environment,status) VALUES($1,$2,'Tailored Agents','https://www.tailoredagents.com','production','active') ON CONFLICT(id) DO UPDATE SET status='active'",
    [site, ws],
  );
  await pool.query(
    "INSERT INTO seo_managers(site_id,workspace_id,ai_reviewed_at) VALUES($1,$2,now())",
    [site, ws],
  );
  for (const role of ["owner", "viewer"]) {
    const id = `seo-${role}`;
    await pool.query(
      'INSERT INTO "user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
      [id, `Fixture ${role}`, `${role}@example.test`],
    );
    await pool.query(
      'INSERT INTO account(id,"accountId","providerId","userId",password) VALUES($1,$2,\'credential\',$2,$3)',
      [randomUUID(), id, password],
    );
    await pool.query(
      "INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')",
      [randomUUID(), ws, id, role],
    );
  }
}
await reset();
function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/health") return json(res, 200, { ok: true });
    if (req.headers.authorization !== "Bearer seo-synthetic-control")
      return json(res, 401, { ok: false });
    let text = "";
    for await (const chunk of req) {
      text += chunk;
      if (text.length > 1_000_000) throw new Error("Fixture input too large");
    }
    const body = text ? JSON.parse(text) : {};
    if (req.url === "/control") {
      if (body.action === "reset") await reset();
      if (body.action === "due")
        await pool.query(
          "UPDATE seo_runs SET next_attempt_at=now() WHERE status='queued'",
        );
      if (body.action === "stale")
        await pool.query(
          "UPDATE seo_changes SET baseline=jsonb_set(baseline,'{fingerprint}','\"outdated\"') WHERE status='ready'",
        );
      const runs = (
          await pool.query(
            "SELECT id,kind,status,stage,error_code FROM seo_runs ORDER BY created_at",
          )
        ).rows,
        changes = (
          await pool.query(
            "SELECT id,path,title,description,status FROM seo_changes ORDER BY created_at",
          )
        ).rows,
        costs = (
          await pool.query(
            "SELECT status,actual_micros,reserved_micros FROM seo_costs ORDER BY created_at",
          )
        ).rows;
      return json(res, 200, { runs, changes, costs, modelCalls });
    }
    if (req.url === "/openai") {
      modelCalls++;
      const input = JSON.parse(body.input[0].content),
        name = body.text.format.name;
      const source = input.sources?.find((s) => s.path === "/websites");
      const result =
        name === "plan"
          ? {
              summary:
                "Prioritize clear website-development intent and useful national/local evidence.",
              priorities: [
                {
                  title: "Clarify our website-development offer",
                  reason:
                    "The page describes custom business websites and customer journeys.",
                  path: "/websites",
                  confidence: "high",
                },
              ],
              changes: [
                {
                  path: "/websites",
                  title:
                    "Custom Business Website Development | Tailored Agents",
                  description:
                    "Tailored Agents designs and develops business websites around your services, customer experience, and practical growth goals.",
                  rationale:
                    "Describe the service and intended business audience clearly.",
                  evidence: [
                    { path: "/websites", quote: source.text.slice(0, 100) },
                  ],
                },
              ],
              briefs: [
                {
                  topic: "A practical business website planning guide",
                  audience: "Business owners comparing a new website project",
                  outline:
                    "Clarify the business goals, customer journey and project scope using our actual process.",
                  sourcePaths: ["/websites"],
                },
              ],
            }
          : {
              summary: "The proposal is supported by the supplied page.",
              decisions: input.proposal.changes.map((_, index) => ({
                index,
                approved: true,
                reason:
                  "The wording describes the service without adding unsupported claims.",
              })),
            };
      return json(res, 200, {
        id: `resp_fixture_${modelCalls}`,
        status: "completed",
        usage: { input_tokens: 3000, output_tokens: 1500 },
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify(result) }],
          },
        ],
      });
    }
    if (req.url === "/research") {
      if (body.path.endsWith("task_post")) {
        const items = JSON.parse(body.body);
        const replies = items.map((data) => {
          const id = randomUUID();
          tasks.set(id, data);
          return { id, status_code: 20100, cost: 0.003, result: null };
        });
        return json(res, 200, {
          status_code: 20000,
          cost: items.length * 0.003,
          tasks: replies,
        });
      }
      const id = body.path.split("/").at(-1),
        data = tasks.get(id);
      return json(res, 200, {
        status_code: 20000,
        cost: 0,
        tasks: [
          {
            id,
            status_code: data ? 20000 : 40401,
            cost: 0,
            result: data
              ? [
                  {
                    datetime: new Date().toISOString(),
                    items: [
                      {
                        type: "organic",
                        url: "https://www.tailoredagents.com/websites",
                        domain: "www.tailoredagents.com",
                        title: "Tailored Agents",
                        description: "Synthetic keyword observation",
                        rank_absolute: 7,
                      },
                    ],
                  },
                ]
              : null,
          },
        ],
      });
    }
    json(res, 404, { ok: false });
  } catch {
    json(res, 500, { error: "fixture_request_failed" });
  }
});
server.listen(3171, "127.0.0.1");
for (const event of ["SIGTERM", "SIGINT"])
  process.on(event, () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    }),
  );
