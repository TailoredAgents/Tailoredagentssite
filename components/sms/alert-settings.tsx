import { OperationForm } from "@/components/dashboard/operation-form";
import { saveSmsAlertsAction } from "@/lib/sms/alert-actions";
import type { getSmsAlertSettings } from "@/lib/sms/alerts";
export function SmsAlertSettings({settings}:{settings:Awaited<ReturnType<typeof getSmsAlertSettings>>}) {
  if(!settings) return null;
  const labels:Record<string,string>={queued:"Queued",sending:"Sending",accepted:"Accepted by Twilio",delivered:"Delivered",failed:"Failed",unknown:"Delivery unconfirmed",cancelled:"Cancelled"};
  return <section id="text-alerts" className="dashboard-panel dashboard-detail-card" aria-label="Customer text alerts">
    <div className="dashboard-panel-heading"><div><span>Customer replies</span><h2>Customer text alerts</h2></div><span className="dashboard-status">{settings.enabled?"Enabled":"Off"}</span></div>
    <p className="lead-alert-intro">Get an SMS on one teammate's personal phone when a customer texts the business. Open the included link to reply from your CRM.</p>
    {!settings.sendingEnabled && <p className="lead-alert-intro" role="status">Business SMS sending is paused or needs setup.</p>}
    <OperationForm action={saveSmsAlertsAction} submitLabel="Save customer text alerts">
      <label className="dashboard-check"><input name="enabled" type="checkbox" defaultChecked={settings.enabled}/> Send customer-text alerts</label>
      <div className="dashboard-form-grid">
        <label className="dashboard-field"><span>Notify teammate</span><select name="userId" defaultValue={settings.userId} required><option value="">Choose a teammate</option>{settings.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label className="dashboard-field"><span>Alert mobile number</span><input name="phone" type="tel" defaultValue={settings.phone} required maxLength={40} placeholder="(555) 555-0123"/></label>
      </div>
      <p className="lead-alert-help">One alert per conversation every two minutes limits repeat texts. Messages from this number and the new-lead alert recipients do not trigger alerts. Reply in the CRM, not to the alert. New-lead alerts have separate recipients below.</p>
    </OperationForm>
    {settings.recent.length>0 && <><h3>Recent text alerts</h3><ul>{settings.recent.map(r=><li key={r.id}>{labels[r.status]||r.status}{r.error_code?` (${r.error_code})`:""}</li>)}</ul><p>Unconfirmed sends are not automatically resent.</p></>}
  </section>;
}
