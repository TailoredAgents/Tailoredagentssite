// Synthetic transport and fixture data only; refuses any non-local database.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";

const url = new URL(process.env.FACTORY_TEST_DATABASE_URL || "");
if (!["postgres:","postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.port !== "55433" || url.pathname !== "/ta_factory_browser_test" || url.search || url.hash) throw new Error("Use the exact disposable Factory browser database.");
const pool = new pg.Pool({connectionString:url.toString(),max:2});
const workspace = "00000000-0000-4000-8000-000000000001";
const leadId = "00000000-0000-4000-8000-000000004001";
await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())");
for (const filename of (await readdir("db/migrations")).filter(f=>f.endsWith(".sql")).sort()) {
  if (!(await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1",[filename])).rowCount) {
    await pool.query(await readFile(`db/migrations/${filename}`,"utf8"));
    await pool.query("INSERT INTO schema_migrations(filename) VALUES($1)",[filename]);
  }
}
const password = await hashPassword("Factory-test-password-2026");
let calls = 0;
let failure = false;
async function reset() {
  calls=0; failure=false;
  await pool.query('TRUNCATE factory_settings,leads,"user",request_rate_limits,"rateLimit" CASCADE');
  for (const role of ["owner","member","viewer"]) {
    const id=`factory-${role}`;
    await pool.query('INSERT INTO "user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',[id,`Fixture ${role}`,`${role}@example.test`]);
    await pool.query('INSERT INTO account(id,"accountId","providerId","userId",password) VALUES($1,$2,\'credential\',$2,$3)',[randomUUID(),id,password]);
    await pool.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')",[randomUUID(),workspace,id,role]);
  }
  await pool.query("INSERT INTO leads(id,workspace_id,submission_id,source,status,name,organization,email,phone,interest,description,delivery_status) VALUES($1,$2,'factory-fixture','manual','new','Sam Rivers','None',NULL,'+12125550100','new website','Interested in a first website. Business details have not been confirmed.','not_configured')",[leadId,workspace]);
}
await reset();
function json(res,status,value) { res.writeHead(status,{"content-type":"application/json"}); res.end(JSON.stringify(value)); }
const server=createServer(async(req,res)=>{
  try {
    if(req.url==="/health") return json(res,200,{ok:true});
    if(req.headers.authorization!=="Bearer factory-synthetic-control") return json(res,401,{ok:false});
    let text="";for await(const chunk of req){text+=chunk;if(text.length>1_000_000)throw new Error("Fixture body too large");}
    const body=text?JSON.parse(text):{};
    if(req.url==="/control") {
      if(body.action==="reset")await reset();
      if(body.action==="fail")failure=true;
      if(body.action==="recover")failure=false;
      if(body.action==="enabled") await pool.query("INSERT INTO factory_settings(workspace_id,research_enabled,auto_research,monthly_budget_micros,budget_approved_at) VALUES($1,true,true,25000000,now()) ON CONFLICT(workspace_id) DO UPDATE SET research_enabled=true,auto_research=true,budget_approved_at=now()",[workspace]);
      const projects=(await pool.query("SELECT id,status,current_plan_id FROM factory_projects ORDER BY created_at")).rows;
      const jobs=(await pool.query("SELECT id,status,stage,error FROM factory_jobs ORDER BY created_at")).rows;
      const plans=(await pool.query("SELECT id,version,content FROM factory_plans ORDER BY created_at")).rows;
      const builds=(await pool.query("SELECT plan_id,status FROM factory_build_requests ORDER BY approved_at")).rows;
      return json(res,200,{leadId,projects,jobs,plans,builds,calls});
    }
    if(req.url!=="/openai")return json(res,404,{ok:false});
    calls++;
    if(failure)return json(res,503,{error:{message:"Synthetic provider interruption"}});
    const commercial=JSON.stringify(body.input).includes("commercial roofing");
    const unchanged=JSON.stringify(body.input).includes("No change please");
    const research=Boolean(body.tools?.some(t=>t.type==="web_search"));
    const plan={
      summary:commercial?"A professional commercial roofing concept, based on your latest direction.":"A flexible first-website concept for Sam, with business details left open.",
      goal:commercial?"Help property managers request a commercial roofing estimate.":"Introduce the business clearly and make it easy to get in touch.",
      audience:commercial?"Commercial property managers":"Prospective customers; industry still unconfirmed",
      knownDetails:[{label:"Requested service",value:"A first website",basis:"submitted",sourceIds:[]}],
      uncertainties:["Company name and service area are not confirmed.","No existing website was supplied; this does not establish that none exists."],
      assumptions:["Use a working concept title until branding is provided."],
      pages:[{title:"Home",purpose:"Explain the offering and invite an inquiry",sections:["Clear introduction","Services","Contact"]},{title:"Services",purpose:commercial?"Explain commercial roofing services":"Leave service descriptions ready for confirmed details",sections:["Service overview","Request an estimate"]}],
      callsToAction:[commercial?"Request a roofing estimate":"Discuss your project"],
      design:{direction:commercial?"Confident industrial design with a clear business focus":"Warm, readable editorial design",palette:["Deep slate","Soft ivory","Blue accent"],typography:"Clear sans-serif headings and readable body text",imagery:"Illustrative concept imagery; no invented completed projects"},
      previewFeatures:["Responsive navigation","Demonstration inquiry form"],productionIntegrations:["Connect the real inquiry form","Confirm business content and domain"],
    };
    return json(res,200,{id:`resp_factory_fixture_${calls}`,status:"completed",usage:{input_tokens:1200,output_tokens:800},output:research?[
      {type:"web_search_call",action:{type:"search"}},
      {type:"message",content:[{type:"output_text",text:"The available information does not identify a specific business. A general concept remains appropriate. Public design reference available.",annotations:[{type:"url_citation",url:"https://example.com/website-reference",title:"Public design reference",start_index:0,end_index:20}]}]},
    ]:[{type:"message",content:[{type:"output_text",text:JSON.stringify({changed:!unchanged,reply:unchanged?"Understood. I have kept the current plan.":commercial?"I updated the plan to emphasize commercial roofing and estimate requests.":"Here is a starting plan. You can add details in the chat before approving it.",changeSummary:commercial?"Changed the audience and service direction to commercial roofing.":"Created the first concept without assuming a company identity.",plan})}]}]});
  }catch{json(res,500,{error:"fixture_failed"});}
});
server.listen(3181,"127.0.0.1");
async function stop(){server.close();await pool.end();process.exit(0);}
process.on("SIGTERM",stop);process.on("SIGINT",stop);
