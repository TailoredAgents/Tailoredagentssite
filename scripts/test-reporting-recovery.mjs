import {
  readFile,
  writeFile,
  readdir,
  mkdtemp,
  chmod,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import pg from "pg";
const input = new URL(process.env.TEST_DATABASE_URL ?? "");
if (
  !["postgres:", "postgresql:"].includes(input.protocol) ||
  input.search ||
  input.hash ||
  !["localhost", "127.0.0.1"].includes(input.hostname) ||
  !/^\/ta_.*test/.test(input.pathname)
)
  throw new Error("Use an isolated local ta_*test database.");
const container = process.env.RECOVERY_TEST_CONTAINER;
if (container && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,120}$/.test(container))
  throw new Error("Use an explicit local test container name.");
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
    await pool.query(
      `INSERT INTO clients(id,workspace_id,name) VALUES('00000000-0000-4000-8000-000000000081',$1,'Recovery fixture client')`,
      [workspace],
    );
    await pool.query(
      `INSERT INTO contacts(id,workspace_id,client_id,name,email) VALUES('00000000-0000-4000-8000-000000000082',$1,'00000000-0000-4000-8000-000000000081','Recovery fixture contact','recovery@example.test')`,
      [workspace],
    );
    for (const file of (await readdir("db/migrations"))
      .filter((file) => file.endsWith(".sql") && file >= "0005")
      .sort())
      await pool.query(await readFile("db/migrations/" + file, "utf8"));
    // Synthetic SMS collaboration and uncertain-send state must survive restore.
    await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified") VALUES('recovery-sms-user','Recovery fixture','sms-recovery@example.test',true)`);
    await pool.query(`INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES('00000000-0000-4000-8000-000000000900',$1,'recovery-sms-user','owner','active')`, [workspace]);
    await pool.query(`INSERT INTO sms_numbers(id,workspace_id,account_sid,provider_sid,phone,connected_by_user_id) VALUES('00000000-0000-4000-8000-000000000901',$1,$2,$3,'+16785550100','recovery-sms-user')`, [workspace, 'AC'+'1'.repeat(32), 'PN'+'2'.repeat(32)]);
    await pool.query(`INSERT INTO sms_number_grants(workspace_id,number_id,user_id,can_send) VALUES($1,'00000000-0000-4000-8000-000000000901','recovery-sms-user',true)`, [workspace]);
    await pool.query(`INSERT INTO sms_conversations(id,workspace_id,number_id,remote_phone,business_id) VALUES('00000000-0000-4000-8000-000000000902',$1,'00000000-0000-4000-8000-000000000901','+16785550101','00000000-0000-4000-8000-000000000081')`, [workspace]);
    await pool.query(`INSERT INTO sms_messages(id,workspace_id,conversation_id,direction,body,status,actor_user_id) VALUES('00000000-0000-4000-8000-000000000903',$1,'00000000-0000-4000-8000-000000000902','outbound','Synthetic uncertain message','unknown','recovery-sms-user')`, [workspace]);
    await pool.query(`INSERT INTO sms_outbound_intents(request_id,workspace_id,number_id,message_id,actor_user_id,request_hash,state) VALUES('00000000-0000-4000-8000-000000000904',$1,'00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000903','recovery-sms-user',$2,'unknown')`, [workspace,'b'.repeat(64)]);
    await pool.query(`INSERT INTO sms_drafts(id,workspace_id,number_id,author_user_id,thread_key,recipient,body) VALUES('00000000-0000-4000-8000-000000000905',$1,'00000000-0000-4000-8000-000000000901','recovery-sms-user','','+16785550101','Synthetic private draft')`, [workspace]);
    assert.equal(
      (await pool.query("SELECT url FROM sites WHERE id=$1", [site])).rows[0]
        .url,
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
  if (container) {
    // Docker supplies the matching PostgreSQL client on Windows without copying
    // credentials into arguments. Only the already guarded disposable DBs run here.
    const dockerEnv = {
      ...env,
      PGUSER: decodeURIComponent(input.username),
      PGPASSWORD: decodeURIComponent(input.password),
    };
    const prefix = [
      "exec",
      "--env",
      "PGUSER",
      "--env",
      "PGPASSWORD",
      container,
    ];
    const bytes = execFileSync(
      "docker",
      [
        ...prefix,
        "pg_dump",
        "--host",
        "127.0.0.1",
        "--port",
        "5432",
        "-Fc",
        "-d",
        names[0],
      ],
      { env: dockerEnv, stdio: "pipe", maxBuffer: 64 * 1024 * 1024 },
    );
    await writeFile(dump, bytes, { mode: 0o600 });
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        "--env",
        "PGUSER",
        "--env",
        "PGPASSWORD",
        container,
        "pg_restore",
        "--host",
        "127.0.0.1",
        "--port",
        "5432",
        "--exit-on-error",
        "--no-owner",
        "-d",
        names[1],
      ],
      {
        env: dockerEnv,
        input: bytes,
        stdio: "pipe",
        maxBuffer: 64 * 1024 * 1024,
      },
    );
  } else {
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
  }
  const restoreUrl = new URL(input);
  restoreUrl.pathname = "/" + names[1];
  const restored = new pg.Pool({
    connectionString: restoreUrl.toString(),
    max: 1,
  });
  try {
    assert.equal(
      (await restored.query("SELECT url FROM sites WHERE id=$1", [site]))
        .rows[0].url,
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
    const linked = (
      await restored.query(
        `SELECT c.business_id,b.client_id,person.business_id AS contact_business FROM clients c JOIN crm_businesses b ON b.id=c.business_id JOIN contacts person ON person.client_id=c.id WHERE c.id='00000000-0000-4000-8000-000000000081'`,
      )
    ).rows[0];
    assert.equal(linked.business_id, "00000000-0000-4000-8000-000000000081");
    assert.equal(linked.client_id, "00000000-0000-4000-8000-000000000081");
    assert.equal(linked.contact_business, linked.business_id);
    const sms = (await restored.query(`SELECT i.state,i.request_hash,m.body,g.can_send,d.body AS draft FROM sms_outbound_intents i JOIN sms_messages m ON m.id=i.message_id AND m.workspace_id=i.workspace_id JOIN sms_number_grants g ON g.number_id=i.number_id AND g.workspace_id=i.workspace_id AND g.user_id=i.actor_user_id JOIN sms_drafts d ON d.number_id=i.number_id AND d.author_user_id=i.actor_user_id WHERE i.request_id='00000000-0000-4000-8000-000000000904'`)).rows[0];
    assert.equal(sms.state, 'unknown');
    assert.equal(sms.request_hash, 'b'.repeat(64));
    assert.equal(sms.body, 'Synthetic uncertain message');
    assert.equal(sms.can_send, true);
    assert.equal(sms.draft, 'Synthetic private draft');
    await restored.query("SELECT perform_reporting_retention()");
    console.log(
      "PASS: reports, credential metadata, client/contact links, SMS grants/drafts and uncertain-send receipts survive migration and PostgreSQL dump/restore; retention remains callable.",
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
