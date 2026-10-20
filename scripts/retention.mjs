import pg from "pg";
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.log(
    "DATABASE_URL is not configured; skipping retention maintenance.",
  );
  process.exit(0);
}
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
try {
  await pool.query("SELECT perform_reporting_retention()");
  console.log("Retention maintenance completed.");
} finally {
  await pool.end();
}
