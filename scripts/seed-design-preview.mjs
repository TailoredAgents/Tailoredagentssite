// Demonstration records for visual review; never permitted against a live DB.
import pg from "pg";
const url = new URL(process.env.TEST_DATABASE_URL || "");
if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "55433" || url.pathname !== "/ta_reporting_browser_test" || url.search || url.hash) throw new Error("Use the exact disposable local design preview database.");
await import("./seed-reporting-preview.mjs");
const pool = new pg.Pool({ connectionString: url.toString(), max: 1 });
const ws = "00000000-0000-4000-8000-000000000001";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
try {
  await pool.query("INSERT INTO crm_lists(id,workspace_id,name,file_hash,created_by) VALUES($1,$2,'Atlanta service businesses',$3,'preview-owner')", [id(500), ws, "d".repeat(64)]);
  for (const [index, name, stage, contact, industry] of [
    [0,"Cedar & Co. Landscaping","mockup","Jordan Miller","Landscaping"],
    [1,"Summit Home Services","discovery","Morgan Taylor","Home services"],
    [2,"Oakwood Dental Studio","proposal","Alex Bennett","Healthcare"],
    [3,"Brightside Aesthetics","interested","Riley James","Beauty & wellness"],
    [4,"Evergreen Roofing","contacted","Casey Brooks","Roofing"],
    [5,"Peachtree Auto Care","prospect","Jamie Reed","Automotive"],
  ]) {
    const business = id(510+index), person = id(520+index), opportunity = id(530+index);
    await pool.query("INSERT INTO crm_businesses(id,workspace_id,name,industry,state,normalized_phone,normalized_email,website_status,score,research_notes) VALUES($1,$2,$3,$4,'GA',$5,$6,'needs_redesign',$7,'Synthetic design preview. Local records only.')", [business, ws, name, industry, `+167855501${String(index).padStart(2,"0")}`, `hello${index}@example.test`, 91-index*4]);
    await pool.query("INSERT INTO contacts(id,workspace_id,business_id,name,email,phone,is_primary) VALUES($1,$2,$3,$4,$5,$6,true)", [person,ws,business,contact,`hello${index}@example.test`,`+167855501${String(index).padStart(2,"0")}`]);
    await pool.query("INSERT INTO crm_opportunities(id,workspace_id,business_id,primary_contact_id,owner_user_id,title,stage,value_cents) VALUES($1,$2,$3,$4,'preview-owner',$5,$6,$7)", [opportunity,ws,business,person,`${name} website & AI receptionist`,stage,80000+index*45000]);
    await pool.query("INSERT INTO crm_list_members(list_id,workspace_id,business_id,opportunity_id,source_row) VALUES($1,$2,$3,$4,$5)", [id(500),ws,business,opportunity,index+2]);
  }
  await pool.query("INSERT INTO crm_tasks(id,workspace_id,opportunity_id,owner_user_id,kind,title,due_at) VALUES($1,$2,$3,'preview-owner','appointment','Website discovery with Morgan',now()+interval '2 hours'),($4,$2,$5,'preview-owner','follow_up','Walk through the Cedar website preview',now()-interval '1 hour')", [id(550),ws,id(531),id(551),id(530)]);
  await pool.query("INSERT INTO crm_mockups(id,workspace_id,opportunity_id,owner_user_id,status,brief,preview_url) VALUES($1,$2,$3,'preview-owner','ready','A clean, local landscaping website with project photography and a clear quote request.','https://example.test/cedar-preview'),($4,$2,$5,'preview-owner','building','A welcoming service website with clear pricing and an AI appointment assistant.',NULL)", [id(560),ws,id(530),id(561),id(533)]);
  console.log("Design preview: synthetic sales, appointments and mockups seeded.");
} finally { await pool.end(); }
