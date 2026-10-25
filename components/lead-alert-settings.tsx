import { OperationForm } from "@/components/dashboard/operation-form";
import { saveLeadAlertsAction } from "@/lib/meta/lead-alert-actions";
import type { getLeadAlertSettings } from "@/lib/meta/lead-alerts";

export function LeadAlertSettings({ settings }: { settings: Awaited<ReturnType<typeof getLeadAlertSettings>> }) {
  if (!settings) return null;
  const rows = [...settings.recipients];
  while (rows.length < Math.max(3, settings.recipients.length + 1) && rows.length < 10) rows.push({ name: "", phone: "" });
  const status: Record<string, string> = { queued: "Queued", sending: "Sending", accepted: "Accepted by Twilio", delivered: "Delivered", failed: "Failed", unknown: "Delivery unconfirmed — not resent", cancelled: "Cancelled" };
  return <section className="dashboard-panel dashboard-detail-card" id="lead-alerts" aria-label="Lead SMS alerts">
    <div className="dashboard-panel-heading"><div><span>Stay in the loop</span><h2>Lead SMS alerts</h2></div><span className="dashboard-status">{settings.enabled ? "Enabled" : "Off"}</span></div>
    <p className="lead-alert-intro">Text your team when a new Facebook or Instagram Instant Form lead arrives. Each alert includes the lead's name and a link to their CRM record.</p>
    {!settings.sendingEnabled && <p role="status">Business SMS sending is paused or needs setup. Alerts will wait for up to 24 hours.</p>}
    <OperationForm action={saveLeadAlertsAction} submitLabel="Save lead alerts">
      <label className="dashboard-check"><input type="checkbox" name="enabled" defaultChecked={settings.enabled} /> Send new-lead alerts to these teammates</label>
      {rows.map((r, i) => <div className="dashboard-form-grid lead-alert-recipient" key={`${i}:${r.phone}`}>
        <label className="dashboard-field"><span>Name</span><input name="recipientName" aria-label={`Recipient ${i + 1} name`} defaultValue={r.name} placeholder="Teammate name" maxLength={60} /></label>
        <label className="dashboard-field"><span>Mobile number</span><input name="recipientPhone" aria-label={`Recipient ${i + 1} mobile number`} type="tel" defaultValue={r.phone} placeholder="(555) 555-0123" maxLength={50} /></label>
      </div>)}
      <p className="lead-alert-help">Use personal mobile numbers, not the business sending number. Leave a mobile number blank to remove that recipient. Standard SMS charges apply.</p>
    </OperationForm>
    {settings.recent.length > 0 && <><h3>Recent alerts</h3><ul>{settings.recent.map(r => <li key={r.id}>{r.recipient_name} — {status[r.status] ?? r.status}{r.error_code ? ` (${r.error_code})` : ""}</li>)}</ul><p>Unconfirmed sends aren't automatically resent. Check Twilio's message log if an alert needs attention.</p></>}
  </section>;
}
