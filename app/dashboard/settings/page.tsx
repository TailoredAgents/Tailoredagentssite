import { SmsAlertSettings } from "@/components/sms/alert-settings";
import { getSmsAlertSettings } from "@/lib/sms/alerts";
import { LeadAlertSettings } from "@/components/lead-alert-settings";
import { getLeadAlertSettings } from "@/lib/meta/lead-alerts";
import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CheckCircle2, Database, Inbox, KeyRound, Mail, Phone, ShieldCheck, UsersRound } from "lucide-react";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { resolveDashboardConfiguration } from "@/lib/dashboard/config";
import { getSearchConsoleConnection } from "@/lib/search-console/connection";
import { getInquiryNotificationConfiguration } from "@/lib/inquiry-notifications";
import { listMailboxes, MailProviderError } from "@/lib/inbox/mail-provider";
import { listSmsSettings } from "@/lib/sms/data";
import { SmsSettingsPanel } from "@/components/sms/settings-panel";
import { getVoiceWorkspace } from "@/lib/voice/data";
import { VoiceSettingsPanel } from "@/components/voice/settings-panel";
import { SettingsSection } from "@/components/dashboard/settings-section";
import { DashboardAppearance } from "@/components/dashboard/theme-provider";
import { getMetaStatus } from "@/lib/meta/service";
import { MetaSettingsPanel } from "@/components/meta-settings-panel";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const context = await requireDashboardContext();
  const mailLogin = resolveDashboardConfiguration().authMode === "mail";
  const [google, inbox, sms, voice, meta, leadAlerts, textAlerts] = await Promise.all([
    getSearchConsoleConnection(context).catch(() => null),
    listMailboxes(context).then(mailboxes => ({ connected: mailboxes.length > 0, detail: mailboxes.length ? `${mailboxes.length} approved address${mailboxes.length === 1 ? "" : "es"}. Mail → Manage team controls who can read and send. Dashboard roles also apply.` : "Ask the Mail owner to approve your account for the shared sales address." })).catch(error => ({ connected: false, detail: error instanceof MailProviderError ? error.message : "The email connection could not be checked. Open Inbox to try again." })),
    listSmsSettings(context),
    getVoiceWorkspace(context),
    getMetaStatus(context).catch(() => null),
    getLeadAlertSettings(context),
    getSmsAlertSettings(context),
  ]);
  const googleStatus = !google ? "Unable to check" : !google.configured ? "Setup needed" : google.connection?.status === "active" ? "Connected" : google.connection?.status === "error" ? "Needs attention" : "Not connected";
  const notifications = getInquiryNotificationConfiguration();
  const settings = [
    { icon: KeyRound, label: "Your sign-in", value: mailLogin ? "Shared with Mail" : "Website password", detail: mailLogin ? "Use your email inbox password here. Change it in Mail settings; password resets sign you out of both apps." : "This environment uses a separate website password.", healthy: true },
    { icon: UsersRound, label: "Team access", value: "Approval required", detail: mailLogin ? "The mail owner approves teammates in Mail → Manage team. Dashboard roles control what each person can do." : "Only approved internal team accounts can sign in.", healthy: true },
    { icon: Inbox, label: "Shared email inbox", value: inbox.connected ? "Connected" : "Setup or access needed", detail: inbox.detail, healthy: inbox.connected },
    { icon: Phone, label: "Business SMS", value: sms.connection.state === "ready" && sms.numbers.some(number => number.canSend) ? "Sending enabled" : "Setup or approval needed", detail: sms.connection.message, healthy: sms.connection.state === "ready" && sms.numbers.some(number => number.canSend) },
    { icon: Phone, label: "Voice and voicemail", value: voice.lines.some(line => line.canCall || line.canReceive) ? "Calling available" : "Setup or approval needed", detail: voice.message, healthy: voice.state === "ready" && voice.lines.some(line => line.canCall || line.canReceive) },
    { icon: BarChart3, label: "Google Search Console", value: googleStatus, detail: "See how people find your website in Google. Open Analytics to connect, review updates, or fix a connection.", healthy: googleStatus === "Connected" },
    { icon: Mail, label: "Inquiry notifications", value: notifications ? "Configured" : "Not configured", detail: notifications ? `New inquiry alerts go to ${notifications.to.join(" and ")}. Every inquiry is also saved in Leads.` : "Email alerts need setup. New inquiries are still saved in Leads.", healthy: Boolean(notifications) },
    { icon: BarChart3, label: "Website activity", value: "Enabled", detail: "Visits and inquiry activity are measured when the visitor's privacy settings allow it.", healthy: true },
    { icon: Database, label: "Workspace storage", value: "Available", detail: "Your clients, projects, inquiries, and saved reports are stored here.", healthy: true },
  ];
  return <>
    <header className="dashboard-topbar"><div><span>Your workspace</span><strong>Settings</strong></div><span className="dashboard-secure"><ShieldCheck size={16} />Private team workspace</span></header>
    <div className="dashboard-content">
      <section className="dashboard-page-heading dashboard-page-heading-compact"><div><span>Account and connections</span><h1>Settings</h1><p>Check your access, manage your password, and see which services are connected.</p></div></section>
      <nav className="workspace-section-links" aria-label="Settings shortcuts"><a href="#connections">Connections & access</a><a href="#sms">SMS settings</a><a href="#lead-alerts">Lead alerts</a><a href="#text-alerts">Text alerts</a><a href="#calling">Calling & voicemail</a><a href="https://mail.tailoredagents.com/settings" target="_blank" rel="noreferrer">Email and password settings<span className="sr-only"> (new tab)</span></a></nav>
      <section className="workspace-profile" aria-label="Your workspace"><i aria-hidden="true">TA</i><div><h2>{context.workspace.name}</h2><p>{context.user.email} · {context.role.charAt(0).toUpperCase() + context.role.slice(1)}</p></div><span className="dashboard-status status-active"><CheckCircle2 size={15} aria-hidden="true" />Active workspace</span></section>
      <DashboardAppearance />
      <div className="dashboard-section-heading" id="connections"><h2>Connections & access</h2><Link href="/dashboard/analytics">Google connection and reports</Link></div>
      <section className="workspace-connections" aria-label="Service connections">{settings.map(({ icon: Icon, label, value, detail, healthy }) => <article className="workspace-connection" key={label}><header><span><Icon size={19} aria-hidden="true" /></span><div><h3>{label}</h3><em className={healthy ? "" : "is-neutral"}>{value}</em></div></header><p>{detail}</p></article>)}</section>
      <SettingsSection id="messaging-settings" target="sms" title="Business SMS" description="Verify your number, manage teammate access and control sending."><SmsSettingsPanel settings={sms} /></SettingsSection>
      <SettingsSection id="voice-settings" target="calling" title="Calling & voicemail" description="Manage voice permissions, business hours, routing and voicemail."><VoiceSettingsPanel workspace={voice} /></SettingsSection>
      <SmsAlertSettings settings={textAlerts} />
      <LeadAlertSettings settings={leadAlerts} />
      <MetaSettingsPanel state={meta} admin={context.role === "owner" || context.role === "admin"} />
      <section className="dashboard-panel dashboard-boundary-card"><ShieldCheck size={22} /><div><h2>This workspace is private to your team</h2><p>Clients cannot sign in to this dashboard. If you need a password reset or someone has left the team, contact the mail owner.</p></div></section>
    </div>
  </>;
}
