import "server-only";
import { getDatabasePool } from "@/lib/dashboard/db";
import { recordPendingInquiryMeasurements } from "@/lib/analytics/verified-inquiries";

export async function runReportingMaintenance() {
  await recordPendingInquiryMeasurements();
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const lock = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_xact_lock(5617015128) AS acquired",
    );
    if (lock.rows[0].acquired) {
      const due =
        await client.query(`UPDATE reporting_maintenance SET last_started_at = now()
        WHERE name = 'retention' AND (last_succeeded_at IS NULL OR
          business_day(last_succeeded_at) < business_day()) RETURNING name`);
      if (due.rowCount) {
        await client.query("SELECT perform_reporting_retention()");
        await client.query(
          "UPDATE reporting_maintenance SET last_succeeded_at = now() WHERE name = 'retention'",
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
