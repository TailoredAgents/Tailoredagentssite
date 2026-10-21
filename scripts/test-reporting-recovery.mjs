import { readFile, readdir, mkdtemp, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import pg from "pg";
const input = new URL(process.env.TEST_DATABASE_URL ?? "");
if (
  !["localhost", "127.0.0.1"].includes(input.hostname) ||
  !/^\/ta_.*test/.test(input.pathname)
)
  throw new Error("Use an isolated local ta_*test database.");
const adminUrl = new URL(input);
adminUrl.pathname = "/postgres";
const admin = new pg.Pool({ connectionString: adminUrl.toString(), max: 1 });
const names = ["ta_reporting_test_upgrade", "ta_reporting_test_restore"];
const directory = await mkdtemp(join(tmpdir(), "ta-reporting-restore-"));
await chmod(directory, 0o700);
const workspace = "00000000-0000-4000-8000-000000000001",
  site = "00000000-0000-4000-8000-000000000002",
  connection = "00000000-0000-4000-8000-000000000003";
try {
  for (const name of names) {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${name}`);
  }
  const upgradeUrl = new URL(input);
  upgradeUrl.pathname = "/" + names[0];
  const pool = new pg.Pool({ connectionString: upgradeUrl.toString(), max: 1 });
  try {
    for (const file of (await readdir("db/migrations"))
      .filter((file) => file.endsWith(".sql") && file < "0005")
      .sort())
      await pool.query(await readFile("db/migrations/" + file, "utf8"));
    await pool.query(
      `INSERT INTO integration_connections(id,workspace_id,site_id,provider,status,property_uri,refresh_token_encrypted) VALUES($1,$2,$3,'google_search_console','active','sc-domain:tailoredagents.com','opaque-test-ciphertext')`,
      [connection, workspace, site],
    );
    await pool.query(
      `INSERT INTO search_console_metrics(id,workspace_id,site_id,integration_id,metric_date,dimension_type,dimension_value,clicks,impressions,ctr,position) VALUES('00000000-0000-4000-8000-000000000004',$1,$2,$3,'2026-09-01','query','original search term',3,10,.3,2)`,
      [workspace, site, connection],
    );
    await pool.query(
      `INSERT INTO integration_sync_runs(id,workspace_id,integration_id,provider,trigger,status) VALUES('00000000-0000-4000-8000-000000000005',$1,$2,'google_search_console','manual','running')`,
      [workspace, connection],
    );
    for (const file of (await readdir("db/migrations"))
      .filter((file) => file.endsWith(".sql") && file >= "0005")
      .sort())
      await pool.query(await readFile("db/migrations/" + file, "utf8"));
    assert.equal(
      (await pool.query("SELECT url FROM sites WHERE id=$1", [site])).rows[0].url,
      "https://www.tailoredagents.com",
    );
    assert.equal(
      (await pool.query("SELECT clicks FROM search_console_metrics")).rows[0]
        .clicks,
      3,
    );
    assert.equal(
      (await pool.query("SELECT status FROM integration_sync_runs")).rows[0]
        .status,
      "failed",
    );
    assert.equal(
      (
        await pool.query(
          "SELECT refresh_token_encrypted FROM integration_connections",
        )
      ).rows[0].refresh_token_encrypted,
      "opaque-test-ciphertext",
    );
  } finally {
    await pool.end();
  }
  const env = {
    ...process.env,
    PGHOST: input.hostname,
    PGPORT: input.port || "5432",
    PGUSER: decodeURIComponent(input.username),
    PGPASSWORD: decodeURIComponent(input.password),
  };
  const dump = join(directory, "backup.dump");
  execFileSync(
    process.env.PG_DUMP_BINARY || "pg_dump",
    ["-Fc", "-d", names[0], "-f", dump],
    { env, stdio: "pipe" },
  );
  execFileSync(
    process.env.PG_RESTORE_BINARY || "pg_restore",
    ["--exit-on-error", "--no-owner", "-d", names[1], dump],
    { env, stdio: "pipe" },
  );
  const restoreUrl = new URL(input);
  restoreUrl.pathname = "/" + names[1];
  const restored = new pg.Pool({
    connectionString: restoreUrl.toString(),
    max: 1,
  });
  try {
    assert.equal(
      (await restored.query("SELECT url FROM sites WHERE id=$1", [site])).rows[0].url,
      "https://www.tailoredagents.com",
    );
    assert.equal(
      (await restored.query("SELECT clicks FROM search_console_metrics"))
        .rows[0].clicks,
      3,
    );
    assert.equal(
      (
        await restored.query(
          "SELECT refresh_token_encrypted FROM integration_connections",
        )
      ).rows[0].refresh_token_encrypted,
      "opaque-test-ciphertext",
    );
    assert.equal(
      (
        await restored.query(
          "SELECT connection_version::int AS version FROM integration_connections",
        )
      ).rows[0].version,
      1,
    );
    assert.equal(
      (await restored.query("SELECT error_code FROM integration_sync_runs"))
        .rows[0].error_code,
      "upgrade_interrupted",
    );
    console.log(
      "PASS: existing reports and credential metadata survive migration and a PostgreSQL dump/restore.",
    );
  } finally {
    await restored.end();
  }
} finally {
  for (const name of names)
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.end();
  await rm(directory, { recursive: true, force: true });
}
