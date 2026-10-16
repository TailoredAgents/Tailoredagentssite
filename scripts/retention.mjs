import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.log("DATABASE_URL is not configured; skipping retention maintenance.");
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const notes = await client.query(`
    DELETE FROM lead_notes note
    USING leads lead
    WHERE note.lead_id = lead.id
      AND lead.retained_until <= now()
      AND lead.status <> 'won'
      AND lead.anonymized_at IS NULL
  `);
  const leads = await client.query(`
    UPDATE leads
    SET status = 'archived',
        name = 'Redacted',
        organization = 'Redacted inquiry',
        email = 'redacted+' || id::text || '@retained.invalid',
        phone = NULL,
        interest = NULL,
        website_url = NULL,
        description = NULL,
        submission_id = NULL,
        fingerprint = NULL,
        owner_user_id = NULL,
        next_action = NULL,
        next_action_at = NULL,
        outcome_summary = NULL,
        delivery_error_code = NULL,
        anonymized_at = now(),
        updated_at = now()
    WHERE retained_until <= now()
      AND status <> 'won'
      AND anonymized_at IS NULL
  `);
  const limits = await client.query("DELETE FROM request_rate_limits WHERE expires_at <= now()");
  const audit = await client.query("DELETE FROM audit_logs WHERE retained_until <= now()");
  await client.query("COMMIT");
  console.log(`Retention complete: ${leads.rowCount ?? 0} leads anonymized, ${notes.rowCount ?? 0} lead notes removed, ${limits.rowCount ?? 0} rate-limit records removed, ${audit.rowCount ?? 0} audit events expired.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
