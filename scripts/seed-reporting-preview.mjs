import pg from "pg";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { readFile, readdir } from "node:fs/promises";
const url = new URL(process.env.TEST_DATABASE_URL ?? "");
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  url.pathname !== "/ta_reporting_browser_test"
)
  throw new Error(
    "Preview fixtures require the separate local ta_reporting_browser_test database.",
  );
const adminUrl = new URL(url);
adminUrl.pathname = "/postgres";
const admin = new pg.Pool({ connectionString: adminUrl.toString(), max: 1 });
try {
  if (
    !(
      await admin.query(
        "SELECT 1 FROM pg_database WHERE datname='ta_reporting_browser_test'",
      )
    ).rowCount
  )
    await admin.query("CREATE DATABASE ta_reporting_browser_test");
} finally {
  await admin.end();
}
const pool = new pg.Pool({ connectionString: url.toString(), max: 1 });
const workspace = "00000000-0000-4000-8000-000000000001",
  site = "00000000-0000-4000-8000-000000000002",
  integration = "00000000-0000-4000-8000-000000000030";
try {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())",
  );
  for (const file of (await readdir("db/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    if (
      !(
        await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1", [
          file,
        ])
      ).rowCount
    ) {
      await pool.query(await readFile("db/migrations/" + file, "utf8"));
      await pool.query("INSERT INTO schema_migrations(filename) VALUES($1)", [
        file,
      ]);
    }
  }
  await pool.query(
    'TRUNCATE integration_connections,analytics_events,leads,request_rate_limits,"rateLimit","user" CASCADE',
  );
  await pool.query(
    `INSERT INTO sites(id,workspace_id,name,url,environment,status) VALUES($1,$2,'Tailored Agents','https://www.tailoredagents.com','production','active') ON CONFLICT(id) DO NOTHING`,
    [site, workspace],
  );
  const hash = await hashPassword("Reporting-test-password-2026");
  for (const role of ["owner", "viewer"]) {
    await pool.query(
      `INSERT INTO "user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)`,
      [
        "preview-" + role,
        role === "owner" ? "Jeffrey (test preview)" : "Viewer (test preview)",
        role + "@example.test",
      ],
    );
    await pool.query(
      `INSERT INTO account(id,"accountId","providerId","userId",password) VALUES($1,$2,'credential',$2,$3)`,
      [randomUUID(), "preview-" + role, hash],
    );
    await pool.query(
      `INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')`,
      [randomUUID(), workspace, "preview-" + role, role],
    );
  }
  await pool.query(
    `UPDATE schema_migrations SET applied_at=now()-interval '180 days'`,
  );
  await pool.query(
    `INSERT INTO integration_connections(id,workspace_id,site_id,provider,status,property_uri,property_permission,history_start,last_successful_sync_at,refresh_token_encrypted)
    VALUES($1,$2,$3,'google_search_console','active','sc-domain:tailoredagents.com','siteOwner',(now() AT TIME ZONE 'America/Los_Angeles')::date-92,now()-interval '20 minutes','fake-preview-credential-not-usable')`,
    [integration, workspace, site],
  );
  await pool.query(
    `INSERT INTO search_console_coverage(integration_id,workspace_id,site_id,metric_date,retained_until)
    SELECT $1,$2,$3,(now() AT TIME ZONE 'America/Los_Angeles')::date-n,now()+interval '18 months' FROM generate_series(3,92)n`,
    [integration, workspace, site],
  );
  await pool.query(
    `INSERT INTO search_console_metrics(id,workspace_id,site_id,integration_id,metric_date,dimension_type,dimension_value,clicks,impressions,ctr,position)
    SELECT gen_random_uuid(),$1,$2,$3,(now() AT TIME ZONE 'America/Los_Angeles')::date-n,'property','',greatest(0,30-n/4+(n%7)),greatest(30,500-n*3),.08,6.5+(n%4)/4.0 FROM generate_series(3,92)n`,
    [workspace, site, integration],
  );
  for (const [dimension, labels] of [
    [
      "query",
      [
        "website design woodstock",
        "business automation",
        "local seo services",
        "tailored agents",
        "small business websites",
        ...Array.from({ length: 14 }, (_, i) => "example search " + (i + 1)),
      ],
    ],
    [
      "page",
      [
        "https://www.tailoredagents.com/",
        "https://www.tailoredagents.com/services",
        "https://www.tailoredagents.com/free-review",
      ],
    ],
  ]) {
    for (const [index, label] of labels.entries())
      await pool.query(
        `INSERT INTO search_console_metrics(id,workspace_id,site_id,integration_id,metric_date,dimension_type,dimension_value,clicks,impressions,ctr,position)
      SELECT gen_random_uuid(),$1,$2,$3,(now() AT TIME ZONE 'America/Los_Angeles')::date-n,$4,$5,greatest(0,9-$6),60,.1,4+$6 FROM generate_series(3,32)n`,
        [workspace, site, integration, dimension, label, index],
      );
  }
  for (let day = 0; day < 65; day++)
    for (
      let visit = 0;
      visit < Math.max(3, 22 - Math.floor(day / 4));
      visit++
    ) {
      const session = randomUUID(),
        occurred = (
          await pool.query(
            `SELECT ((now() AT TIME ZONE 'America/Los_Angeles')::date-$1::int)::timestamp AT TIME ZONE 'America/Los_Angeles' AS day`,
            [day],
          )
        ).rows[0].day;
      await pool.query(
        `INSERT INTO analytics_events(id,workspace_id,site_id,session_id,event_name,path,landing_path,utm_source,occurred_at) VALUES($1,$2,$3,$4,'page_view',$5,'/',$6,$7::timestamptz+interval '12 hours')`,
        [
          randomUUID(),
          workspace,
          site,
          session,
          visit % 3 ? "/" : "/services",
          visit % 3 ? "google" : "Direct / none",
          occurred,
        ],
      );
      if (visit === 0 && day % 3 === 0) {
        const id = randomUUID();
        await pool.query(
          `INSERT INTO leads(id,workspace_id,name,organization,email,description,measurement_status,created_at) VALUES($1,$2,'Preview inquiry','Example business','fixture@example.test','Demonstration data only','recorded',$3::timestamptz+interval '12 hours')`,
          [id, workspace, occurred],
        );
        await pool.query(
          `INSERT INTO analytics_events(id,workspace_id,site_id,session_id,event_name,path,landing_path,verification,occurred_at) VALUES($1,$2,$3,$4,'form_success','/contact','/','server',$5::timestamptz+interval '12 hours')`,
          [id, workspace, site, session, occurred],
        );
      }
    }
  await pool.query(
    `UPDATE reporting_maintenance SET last_started_at=now(),last_succeeded_at=now()`,
  );
  await pool.query(
    `INSERT INTO integration_sync_runs(id,workspace_id,integration_id,provider,trigger,status,total_days,completed_days,finished_at) VALUES($1,$2,$3,'google_search_console','oauth','succeeded',90,90,now()-interval '20 minutes')`,
    [randomUUID(), workspace, integration],
  );
  // Synthetic operations records exercise every dashboard detail view. Local DB only.
  const client = "00000000-0000-4000-8000-000000000311";
  await pool.query(`INSERT INTO clients(id,workspace_id,name,notes) VALUES($1,$2,'Northstar Heating & Air','Sample client for dashboard usability checks.')`, [client, workspace]);
  await pool.query(`INSERT INTO contacts(id,workspace_id,client_id,name,email,phone,title,is_primary) VALUES('00000000-0000-4000-8000-000000000312',$1,$2,'Hannah Parker','hannah.parker@northstar-example.test','+1 555 010 4242','Office manager',true)`, [workspace, client]);
  await pool.query(`INSERT INTO sites(id,workspace_id,client_id,name,url,environment,status) VALUES('00000000-0000-4000-8000-000000000313',$1,$2,'Northstar service website','https://northstar-example.test/our-services/heating-and-air-conditioning','production','active')`, [workspace, client]);
  await pool.query(`INSERT INTO projects(id,workspace_id,client_id,site_id,owner_user_id,name,summary,status,due_at) VALUES('00000000-0000-4000-8000-000000000314',$1,$2,'00000000-0000-4000-8000-000000000313','preview-owner','Website launch and local search setup','Improve service pages, prepare the new site, and review launch details with the client.','active',now()+interval '3 days')`, [workspace, client]);
  await pool.query(`INSERT INTO project_milestones(id,project_id,title,status,due_at) VALUES('00000000-0000-4000-8000-000000000315','00000000-0000-4000-8000-000000000314','Review the service-page designs','in_progress',now()+interval '2 days')`);
  await pool.query(`INSERT INTO project_records(id,project_id,author_user_id,kind,title,body) VALUES('00000000-0000-4000-8000-000000000316','00000000-0000-4000-8000-000000000314','preview-owner','decision','Launch priorities','Start with heating and air conditioning pages. Include clear contact details and a simple inquiry form.')`);
  await pool.query(`INSERT INTO leads(id,workspace_id,name,organization,email,phone,description,interest,status,owner_user_id,next_action,next_action_at,delivery_status) VALUES('00000000-0000-4000-8000-000000000317',$1,'Morgan Taylor','Summit Home Services','morgan.taylor@summit-home-services-example.test','+1 555 010 6464','We need a clearer website that helps customers find our services and contact our office.','Website and local SEO','qualified','preview-owner','Review the website and arrange a discovery call',now()-interval '1 day','not_configured')`, [workspace]);
  await pool.query(`INSERT INTO lead_notes(id,workspace_id,lead_id,author_user_id,body) VALUES(gen_random_uuid(),$1,'00000000-0000-4000-8000-000000000317','preview-owner','The owner would like to discuss a fall launch. Confirm the service area on the next call.')`, [workspace]);
  await pool.query(`INSERT INTO audit_logs(id,workspace_id,actor_user_id,action,target_type,target_id) VALUES(gen_random_uuid(),$1,'preview-owner','project.created','project','00000000-0000-4000-8000-000000000314')`, [workspace]);
  console.log("Local preview seeded with demonstration data only.");
} finally {
  await pool.end();
}
