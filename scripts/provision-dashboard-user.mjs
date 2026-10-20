import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";

const args = process.argv.slice(2);
const value = (key) => args[args.indexOf(key) + 1];
const email = args.includes("--email")
  ? value("--email").trim().toLowerCase()
  : "";
const name = args.includes("--name") ? value("--name").trim() : "";
const role = args.includes("--role") ? value("--role") : "admin";
const allowed = (process.env.DASHBOARD_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((item) => item.trim().toLowerCase());
if (!email || !allowed.includes(email) || !process.env.DATABASE_URL)
  throw new Error(
    "Set DATABASE_URL and DASHBOARD_ALLOWED_EMAILS privately; use --email with an approved address.",
  );
if (!["admin", "member", "viewer"].includes(role))
  throw new Error(
    "Choose admin, member, or viewer. This command cannot replace the owner.",
  );
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});
async function readPassword() {
  if (args.includes("--password-stdin")) {
    let input = "";
    for await (const chunk of process.stdin) {
      input += chunk;
      if (input.length > 512) throw new Error("Password input is too long.");
    }
    return input.replace(/\r?\n$/, "");
  }
  if (!process.stdin.isTTY)
    throw new Error(
      "Use an interactive terminal or explicitly pass --password-stdin with secure input.",
    );
  process.stdout.write("New dashboard password (hidden): ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let result = "";
    function finish(error) {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(result);
    }
    function onData(chunk) {
      for (const char of chunk) {
        if (char === "\u0003") {
          finish(new Error("Cancelled."));
          return;
        }
        if (char === "\r" || char === "\n") {
          finish();
          return;
        }
        if (char === "\u007f") {
          result = result.slice(0, -1);
        } else if (char >= " " && result.length < 128) {
          result += char;
        }
      }
    }
    process.stdin.on("data", onData);
  });
}
try {
  const found = await pool.query(
    `SELECT u.id, m.role, m.status FROM "user" u LEFT JOIN workspace_memberships m
    ON m.user_id=u.id AND m.workspace_id='00000000-0000-4000-8000-000000000001' WHERE lower(u.email)=$1`,
    [email],
  );
  if (args.includes("--check")) {
    console.log(
      found.rows[0]
        ? `Approved account exists. Membership: ${found.rows[0].status ?? "missing"}; role: ${found.rows[0].role ?? "none"}.`
        : "Approved address has no website dashboard account yet.",
    );
  } else {
    if (found.rowCount)
      throw new Error(
        "Account already exists. Its password and membership were left unchanged.",
      );
    if (!name || name.length > 100)
      throw new Error("Use --name with the team member’s name.");
    const password = await readPassword();
    if (password.length < 12 || password.length > 128)
      throw new Error("Use a password between 12 and 128 characters.");
    const hash = await hashPassword(password);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(5617015127)");
      const owner = await client.query(
        `SELECT 1 FROM workspace_memberships WHERE workspace_id='00000000-0000-4000-8000-000000000001' AND role='owner' AND status='active'`,
      );
      if (!owner.rowCount)
        throw new Error(
          "Set up the first owner through the existing private bootstrap before adding teammates.",
        );
      const id = randomUUID();
      await client.query(
        `INSERT INTO "user" (id,name,email,"emailVerified") VALUES ($1,$2,$3,false)`,
        [id, name, email],
      );
      await client.query(
        `INSERT INTO account (id,"accountId","providerId","userId",password) VALUES ($1,$2,'credential',$2,$3)`,
        [randomUUID(), id, hash],
      );
      await client.query(
        `INSERT INTO workspace_memberships (id,workspace_id,user_id,role,status) VALUES ($1,'00000000-0000-4000-8000-000000000001',$2,$3,'active')`,
        [randomUUID(), id, role],
      );
      await client.query(
        `INSERT INTO audit_logs(id,workspace_id,action,target_type,target_id,metadata) VALUES ($1,'00000000-0000-4000-8000-000000000001','membership.operator_provisioned','user',$2,$3::jsonb)`,
        [
          randomUUID(),
          id,
          JSON.stringify({ role, method: "owner-controlled command" }),
        ],
      );
      await client.query("COMMIT");
      console.log(
        "Approved dashboard account created. No passwords or session tokens were printed.",
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} catch (error) {
  console.error(
    error instanceof Error && !("code" in error)
      ? error.message
      : "Provisioning failed. No database details are logged.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
