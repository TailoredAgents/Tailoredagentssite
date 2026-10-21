import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normalizePhone } from "./import";

const databaseUrl = process.env.TEST_SALES_SCHEMA_DATABASE_URL;
const workspace = "00000000-0000-4000-8000-000000000001";
const otherWorkspace = randomUUID();
const legacyClient = randomUUID();
const otherClient = randomUUID();
const legacyContact = randomUUID();
const legacyLead = randomUUID();
const opportunity = randomUUID();
let pool: pg.Pool;

describe.skipIf(!databaseUrl)("agency sales populated database upgrade", () => {
  beforeAll(async () => {
    // This suite is destructive only inside its explicitly dedicated local DB.
    const url = new URL(databaseUrl!);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.pathname !== "/ta_sales_schema_test" ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        "Schema integration tests require the dedicated local ta_sales_schema_test database.",
      );
    }
    pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
    if (
      (await pool.query("SELECT current_database() AS database")).rows[0]
        .database !== "ta_sales_schema_test"
    ) {
      throw new Error(
        "Refusing to modify a database other than ta_sales_schema_test.",
      );
    }
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    const directory = resolve(process.cwd(), "db", "migrations");
    const migrations = (await readdir(directory))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const filename of migrations.filter(
      (file) => file < "0008_agency_sales.sql",
    )) {
      await pool.query(await readFile(resolve(directory, filename), "utf8"));
    }
    await pool.query(
      "INSERT INTO workspaces(id,slug,name,kind) VALUES($1,'sales-schema-other','Other test workspace','internal')",
      [otherWorkspace],
    );
    await pool.query(
      "INSERT INTO clients(id,workspace_id,name) VALUES($1,$2,'Same Client'),($3,$4,'Same Client')",
      [legacyClient, workspace, otherClient, otherWorkspace],
    );
    await pool.query(
      "INSERT INTO contacts(id,workspace_id,client_id,name,email) VALUES($1,$2,$3,'Legacy Person','legacy@example.test')",
      [legacyContact, workspace, legacyClient],
    );
    await pool.query(
      "INSERT INTO leads(id,workspace_id,name,organization,email) VALUES($1,$2,'Legacy Inquiry','Same Client','legacy@example.test')",
      [legacyLead, workspace],
    );
    await pool.query("BEGIN");
    try {
      await pool.query(
        await readFile(resolve(directory, "0008_agency_sales.sql"), "utf8"),
      );
      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    await pool?.end();
  });

  it("preserves existing identities and attaches contacts without manufacturing historical opportunities", async () => {
    const businesses = await pool.query(
      "SELECT id,client_id,workspace_id FROM crm_businesses ORDER BY workspace_id",
    );
    expect(businesses.rowCount).toBe(2);
    expect(businesses.rows).toContainEqual({
      id: legacyClient,
      client_id: legacyClient,
      workspace_id: workspace,
    });
    expect(businesses.rows).toContainEqual({
      id: otherClient,
      client_id: otherClient,
      workspace_id: otherWorkspace,
    });
    expect(
      (
        await pool.query("SELECT business_id FROM clients WHERE id=$1", [
          legacyClient,
        ])
      ).rows[0].business_id,
    ).toBe(legacyClient);
    expect(
      (
        await pool.query(
          "SELECT client_id,business_id FROM contacts WHERE id=$1",
          [legacyContact],
        )
      ).rows[0],
    ).toEqual({ client_id: legacyClient, business_id: legacyClient });
    expect(
      (
        await pool.query("SELECT business_id FROM leads WHERE id=$1", [
          legacyLead,
        ])
      ).rows[0].business_id,
    ).toBeNull();
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM crm_opportunities"))
        .rows[0].count,
    ).toBe(0);
  });

  it("canonicalizes legacy phone extensions with the same rules as imports", async () => {
    const values: (string | null)[] = [
      null, "", "   ", "(212) 555-0123", "1-212-555-0123", "  (212) 555-0123 ext. 42  ",
      "2125550123EXT42", "2125550123 x42", "2125550123#42", "2125550123x42 ",
      "+44 20 7946 0123 ext 9", "+ 44 (20) 7946.0123", "\t212 555 0123\n",
      "\u00a0212\u2009555\u202f0123\ufeff", "2125550123\u3000ext.\u00a042", "212\u00855550123",
      "020 7946 0123", "+012345678", "+1234567", "+1234567890123456", "212ABC0123",
      "2125550123 extension 42", "212+5550123", "tel:2125550123", "+", "2125550123 ext. ",
    ];
    const result = await pool.query<{ value: string | null; normalized: string | null }>(
      "SELECT value, crm_normalized_phone(value) AS normalized FROM unnest($1::text[]) AS input(value)", [values],
    );
    expect(result.rows).toHaveLength(values.length);
    for (const row of result.rows) expect(row.normalized, `SQL/CSV mismatch for ${JSON.stringify(row.value)}`).toBe(row.value === null ? null : normalizePhone(row.value));
    expect((await pool.query("SELECT provolatile,proisstrict,proparallel FROM pg_proc WHERE oid='crm_normalized_phone(text)'::regprocedure")).rows[0]).toEqual({ provolatile: "i", proisstrict: true, proparallel: "s" });
  });

  it("supports prospect contacts while requiring a business or client", async () => {
    await expect(
      pool.query(
        "INSERT INTO contacts(id,workspace_id,business_id,name,email) VALUES($1,$2,$3,'Prospect Person','prospect@example.test')",
        [randomUUID(), workspace, legacyClient],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
    await expect(
      pool.query(
        "INSERT INTO contacts(id,workspace_id,name) VALUES($1,$2,'Orphan')",
        [randomUUID(), workspace],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      pool.query(
        "INSERT INTO contacts(id,workspace_id,business_id,name) VALUES($1,$2,$3,'Cross tenant')",
        [randomUUID(), workspace, otherClient],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      pool.query(
        "INSERT INTO contacts(id,workspace_id,business_id,name,email) VALUES($1,$2,$3,'Duplicate','LEGACY@example.test')",
        [randomUUID(), workspace, legacyClient],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("requires primary contacts and opportunities to belong to the same business and workspace", async () => {
    await pool.query(
      "INSERT INTO crm_opportunities(id,workspace_id,business_id,primary_contact_id,title) VALUES($1,$2,$3,$4,'First website')",
      [opportunity, workspace, legacyClient, legacyContact],
    );
    await expect(
      pool.query(
        "INSERT INTO crm_opportunities(id,workspace_id,business_id,title) VALUES($1,$2,$3,'Cross tenant')",
        [randomUUID(), workspace, otherClient],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    const unrelatedBusiness = randomUUID();
    await pool.query(
      "INSERT INTO crm_businesses(id,workspace_id,name) VALUES($1,$2,'Different Business')",
      [unrelatedBusiness, workspace],
    );
    await expect(
      pool.query(
        "INSERT INTO crm_opportunities(id,workspace_id,business_id,primary_contact_id,title) VALUES($1,$2,$3,$4,'Wrong person')",
        [randomUUID(), workspace, unrelatedBusiness, legacyContact],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("isolates list membership, activities, tasks and mockups across tenants", async () => {
    const list = randomUUID();
    await pool.query(
      "INSERT INTO crm_lists(id,workspace_id,name,file_hash) VALUES($1,$2,'Synthetic list',$3)",
      [list, workspace, "a".repeat(64)],
    );
    await pool.query(
      "INSERT INTO crm_list_members(list_id,workspace_id,business_id,opportunity_id,source_row) VALUES($1,$2,$3,$4,2)",
      [list, workspace, legacyClient, opportunity],
    );
    await expect(
      pool.query(
        "INSERT INTO crm_list_members(list_id,workspace_id,business_id,opportunity_id,source_row) VALUES($1,$2,$3,$4,3)",
        [list, otherWorkspace, otherClient, opportunity],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      pool.query(
        "INSERT INTO crm_activities(id,workspace_id,business_id,opportunity_id,kind,body) VALUES($1,$2,$3,$4,'note','Cross tenant')",
        [randomUUID(), otherWorkspace, otherClient, opportunity],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      pool.query(
        "INSERT INTO crm_tasks(id,workspace_id,opportunity_id,title,due_at) VALUES($1,$2,$3,'Cross tenant',now())",
        [randomUUID(), otherWorkspace, opportunity],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      pool.query(
        "INSERT INTO crm_mockups(id,workspace_id,opportunity_id,brief) VALUES($1,$2,$3,'Cross tenant')",
        [randomUUID(), otherWorkspace, opportunity],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("prevents repeated file and outcome identities, while allowing unrelated shared domains", async () => {
    await expect(
      pool.query(
        "INSERT INTO crm_lists(id,workspace_id,name,file_hash) VALUES($1,$2,'Repeated file',$3)",
        [randomUUID(), workspace, "a".repeat(64)],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await pool.query(
      "INSERT INTO crm_activities(id,workspace_id,business_id,opportunity_id,kind,source,body,external_key) VALUES($1,$2,$3,$4,'outcome','batchdialer','Synthetic result','test-outcome-key')",
      [randomUUID(), workspace, legacyClient, opportunity],
    );
    await expect(
      pool.query(
        "INSERT INTO crm_activities(id,workspace_id,business_id,opportunity_id,kind,source,body,external_key) VALUES($1,$2,$3,$4,'outcome','batchdialer','Repeated result','test-outcome-key')",
        [randomUUID(), workspace, legacyClient, opportunity],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      pool.query(
        "INSERT INTO crm_businesses(id,workspace_id,name,normalized_domain) VALUES($1,$2,'Shared Domain A','example.test'),($3,$2,'Shared Domain B','example.test')",
        [randomUUID(), workspace, randomUUID()],
      ),
    ).resolves.toMatchObject({ rowCount: 2 });
  });

  it("enforces scheduled task consistency and stores channel suppression per workspace", async () => {
    await expect(
      pool.query(
        "INSERT INTO crm_tasks(id,workspace_id,opportunity_id,title,due_at,end_at) VALUES($1,$2,$3,'Backwards appointment',now(),now()-interval '1 hour')",
        [randomUUID(), workspace, opportunity],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      pool.query(
        "INSERT INTO crm_tasks(id,workspace_id,opportunity_id,title,due_at,status) VALUES($1,$2,$3,'Missing completion',now(),'completed')",
        [randomUUID(), workspace, opportunity],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await pool.query(
      "INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status,evidence) VALUES($1,'call','+12125550123','blocked','Synthetic DNC import'),($2,'call','+12125550123','unknown',NULL)",
      [workspace, otherWorkspace],
    );
    expect(
      (
        await pool.query(
          "SELECT status FROM crm_channel_preferences WHERE workspace_id=$1",
          [workspace],
        )
      ).rows[0].status,
    ).toBe("blocked");
    expect(
      (
        await pool.query(
          "SELECT status FROM crm_channel_preferences WHERE workspace_id=$1",
          [otherWorkspace],
        )
      ).rows[0].status,
    ).toBe("unknown");
    await expect(
      pool.query(
        "INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status) VALUES($1,'sms','bad-number','blocked')",
        [workspace],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("expires only inactive unconverted prospects, scrubs their connected content, and preserves opt-outs", async () => {
    const expired = randomUUID(),
      expiredOpportunity = randomUUID(),
      expiredContact = randomUUID();
    const oldWon = randomUUID(),
      oldWonOpportunity = randomUUID();
    const recentlyWorked = randomUUID(),
      activeOpportunity = randomUUID();
    const futureRetention = randomUUID(),
      recentBusiness = randomUUID(),
      projectProtected = randomUUID(),
      project = randomUUID();
    const expiredList = randomUUID();
    await pool.query(
      `INSERT INTO crm_businesses(id,workspace_id,name,normalized_phone,normalized_email,website_url,normalized_domain,industry,state,score,research_url,research_notes,retained_until,updated_at)
      VALUES($1,$2,'Expired Identifiable Name','+12125550999','expired@example.test','https://expired.example.test','expired.example.test','Expired Industry','NY',90,'https://evidence.example.test','Private research',now()-interval '1 day',now()-interval '3 years')`,
      [expired, workspace],
    );
    for (const [id, name, recent, retained] of [
      [oldWon, "Old won", false, false],
      [recentlyWorked, "Recently worked", false, false],
      [futureRetention, "Future retention", false, true],
      [recentBusiness, "Recently edited", true, false],
      [projectProtected, "Project linked", false, false],
    ] as const) {
      await pool.query(
        `INSERT INTO crm_businesses(id,workspace_id,name,retained_until,updated_at) VALUES($1,$2,$3,CASE WHEN $4 THEN now()+interval '1 year' ELSE now()-interval '1 day' END,CASE WHEN $5 THEN now() ELSE now()-interval '3 years' END)`,
        [id, workspace, name, retained, recent],
      );
    }
    await pool.query(
      "UPDATE crm_businesses SET retained_until=now()-interval '1 day',updated_at=now()-interval '3 years' WHERE id=$1",
      [legacyClient],
    );
    await pool.query(
      "INSERT INTO contacts(id,workspace_id,business_id,name,email,phone,title) VALUES($1,$2,$3,'Expired Person','expired@example.test','2125550999','Owner')",
      [expiredContact, workspace, expired],
    );
    await pool.query(
      "INSERT INTO projects(id,workspace_id,client_id,name) VALUES($1,$2,$3,'Existing protected project')",
      [project, workspace, legacyClient],
    );
    await pool.query(
      `INSERT INTO crm_opportunities(id,workspace_id,business_id,title,stage,project_id,updated_at)
      VALUES($1,$2,$3,'Expired private opportunity','interested',NULL,now()-interval '3 years'),
      ($4,$2,$5,'Protected won title','won',NULL,now()-interval '3 years'),
      ($6,$2,$7,'Actively worked title','interested',NULL,now()-interval '3 years'),
      ($8,$2,$9,'Protected project title','proposal',$10,now()-interval '3 years')`,
      [
        expiredOpportunity,
        workspace,
        expired,
        oldWonOpportunity,
        oldWon,
        activeOpportunity,
        recentlyWorked,
        randomUUID(),
        projectProtected,
        project,
      ],
    );
    await pool.query(
      `INSERT INTO crm_activities(id,workspace_id,business_id,opportunity_id,kind,body,outcome,occurred_at,created_at)
      VALUES($1,$2,$3,$4,'call','Expired private conversation','Private outcome',now()-interval '3 years',now()-interval '3 years'),
      ($5,$2,$6,$7,'note','Recent real work',NULL,now(),now())`,
      [
        randomUUID(),
        workspace,
        expired,
        expiredOpportunity,
        randomUUID(),
        recentlyWorked,
        activeOpportunity,
      ],
    );
    await pool.query(
      `INSERT INTO crm_tasks(id,workspace_id,opportunity_id,title,due_at,location,notes,updated_at)
      VALUES($1,$2,$3,'Expired appointment title',now()-interval '3 years','Private meeting location','Private task notes',now()-interval '3 years')`,
      [randomUUID(), workspace, expiredOpportunity],
    );
    await pool.query(
      `INSERT INTO crm_mockups(id,workspace_id,opportunity_id,brief,preview_url,repository_url,project_path,qa_notes,updated_at)
      VALUES($1,$2,$3,'Expired creative brief','https://preview.example.test','https://repo.example.test','Private project path','Private QA notes',now()-interval '3 years')`,
      [randomUUID(), workspace, expiredOpportunity],
    );
    await pool.query(
      "INSERT INTO crm_lists(id,workspace_id,name,file_hash) VALUES($1,$2,'Retention test source',$3)",
      [expiredList, workspace, "b".repeat(64)],
    );
    await pool.query(
      'INSERT INTO crm_list_members(list_id,workspace_id,business_id,opportunity_id,source_row,research_data) VALUES($1,$2,$3,$4,2,\'{"notes":"Private imported contact details"}\')',
      [expiredList, workspace, expired, expiredOpportunity],
    );
    await pool.query(
      `INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status,evidence)
      VALUES($1,'call','+12125550999','blocked','Private original opt-out discussion'),($1,'email','expired@example.test','allowed','Private old claimed approval')`,
      [workspace],
    );
    await pool.query(
      "UPDATE leads SET retained_until=now()-interval '1 day' WHERE id=$1",
      [legacyLead],
    );

    await pool.query("SELECT perform_reporting_retention()");
    const business = (
      await pool.query("SELECT * FROM crm_businesses WHERE id=$1", [expired])
    ).rows[0];
    expect(business.name).toBe("Expired prospect");
    expect(business.anonymized_at).toBeInstanceOf(Date);
    for (const column of [
      "website_url",
      "normalized_domain",
      "normalized_phone",
      "normalized_email",
      "industry",
      "state",
      "score",
      "research_url",
      "research_notes",
    ])
      expect(business[column]).toBeNull();
    expect(
      (
        await pool.query(
          "SELECT name,email,phone,title FROM contacts WHERE id=$1",
          [expiredContact],
        )
      ).rows[0],
    ).toEqual({
      name: "Expired prospect contact",
      email: null,
      phone: null,
      title: null,
    });
    expect(
      (
        await pool.query(
          "SELECT title,stage FROM crm_opportunities WHERE id=$1",
          [expiredOpportunity],
        )
      ).rows[0],
    ).toEqual({ title: "Expired prospect opportunity", stage: "archived" });
    expect(
      (
        await pool.query(
          "SELECT body,outcome FROM crm_activities WHERE business_id=$1",
          [expired],
        )
      ).rows[0],
    ).toEqual({ body: "[Expired prospect content removed]", outcome: null });
    expect(
      (
        await pool.query(
          "SELECT title,status,location,notes FROM crm_tasks WHERE opportunity_id=$1",
          [expiredOpportunity],
        )
      ).rows[0],
    ).toEqual({
      title: "Expired follow-up",
      status: "cancelled",
      location: null,
      notes: null,
    });
    expect(
      (
        await pool.query(
          "SELECT brief,preview_url,repository_url,project_path,qa_notes FROM crm_mockups WHERE opportunity_id=$1",
          [expiredOpportunity],
        )
      ).rows[0],
    ).toEqual({
      brief: "[Expired prospect content removed]",
      preview_url: null,
      repository_url: null,
      project_path: null,
      qa_notes: null,
    });
    expect(
      (
        await pool.query(
          "SELECT research_data FROM crm_list_members WHERE list_id=$1",
          [expiredList],
        )
      ).rows[0].research_data,
    ).toEqual({});
    expect(
      (
        await pool.query(
          "SELECT status,evidence FROM crm_channel_preferences WHERE normalized_address='+12125550999'",
        )
      ).rows[0],
    ).toEqual({
      status: "blocked",
      evidence: "Opt-out retained after expired prospect content was removed.",
    });
    expect(
      (
        await pool.query(
          "SELECT 1 FROM crm_channel_preferences WHERE normalized_address='expired@example.test'",
        )
      ).rowCount,
    ).toBe(0);
    expect(
      (
        await pool.query("SELECT anonymized_at FROM leads WHERE id=$1", [
          legacyLead,
        ])
      ).rows[0].anonymized_at,
    ).toBeInstanceOf(Date);
    const protectedRecords = await pool.query(
      "SELECT id,anonymized_at FROM crm_businesses WHERE id=ANY($1::uuid[])",
      [
        [
          legacyClient,
          oldWon,
          recentlyWorked,
          futureRetention,
          recentBusiness,
          projectProtected,
        ],
      ],
    );
    expect(protectedRecords.rows).toHaveLength(6);
    expect(
      protectedRecords.rows.every((row) => row.anonymized_at === null),
    ).toBe(true);
    const firstRun = business.anonymized_at;
    await pool.query("SELECT perform_reporting_retention()");
    expect(
      (
        await pool.query(
          "SELECT anonymized_at FROM crm_businesses WHERE id=$1",
          [expired],
        )
      ).rows[0].anonymized_at,
    ).toEqual(firstRun);
  });

  it("defers prospect cleanup while that workspace has an active sales mutation", async () => {
    const business = randomUUID();
    await pool.query(
      "INSERT INTO crm_businesses(id,workspace_id,name,retained_until,updated_at) VALUES($1,$2,'Mutation protected prospect',now()-interval '1 day',now()-interval '3 years')",
      [business, workspace],
    );
    const editing = new pg.Client({ connectionString: databaseUrl });
    await editing.connect();
    try {
      await editing.query("BEGIN");
      await editing.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [`agency-sales:${workspace}`],
      );
      await pool.query("SELECT perform_reporting_retention()");
      expect(
        (
          await pool.query(
            "SELECT anonymized_at FROM crm_businesses WHERE id=$1",
            [business],
          )
        ).rows[0].anonymized_at,
      ).toBeNull();
    } finally {
      await editing.query("ROLLBACK");
      await editing.end();
    }
    await pool.query("SELECT perform_reporting_retention()");
    expect(
      (
        await pool.query(
          "SELECT anonymized_at FROM crm_businesses WHERE id=$1",
          [business],
        )
      ).rows[0].anonymized_at,
    ).toBeInstanceOf(Date);
  });

  it("bounds each prospect retention batch to500 records", async () => {
    await pool.query(
      `INSERT INTO crm_businesses(id,workspace_id,name,retained_until,updated_at)
      SELECT gen_random_uuid(),$1,'Bounded synthetic expired prospect',now()-interval '1 day',now()-interval '3 years' FROM generate_series(1,501)`,
      [workspace],
    );
    await pool.query("SELECT perform_reporting_retention()");
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM crm_businesses WHERE name='Bounded synthetic expired prospect' AND anonymized_at IS NULL",
        )
      ).rows[0].count,
    ).toBe(1);
    await pool.query("SELECT perform_reporting_retention()");
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM crm_businesses WHERE name='Bounded synthetic expired prospect' AND anonymized_at IS NULL",
        )
      ).rows[0].count,
    ).toBe(0);
  });
});
