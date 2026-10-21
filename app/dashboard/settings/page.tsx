import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CheckCircle2, Database, Inbox, KeyRound, Mail, Phone, ShieldCheck, UsersRound } from "lucide-react";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { resolveDashboardConfiguration } from "@/lib/dashboard/config";
import { getSearchConsoleConnection } from "@/lib/search-console/connection";
import { getInquiryNotificationConfiguration } from "@/lib/inquiry-notifications";
import { listMailboxes, MailProviderError } from "@/lib/inbox/mail-provider";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const context = await requireDashboardContext();
  const mailLogin = resolveDashboardConfiguration().authMode === "mail";
  const [google, inbox] = await Promise.all([
    getSearchConsoleConnection(context).catch(() => null),
    listMailboxes(context).then(mailboxes => ({ connected: mailboxes.length > 0, detail: mailboxes.length ? `${mailboxes.length} approved address${mailboxes.length === 1 ? "" : "es"}. Mail → Manage team controls who can read and send. Dashboard roles also apply.` : "Ask the Mail owner to approve your account for the shared sales address." })).catch(error => ({ connected: false, detail: error instanceof MailProviderError ? error.message : "The email connection could not be checked. Open Inbox to try again." })),
  ]);
  const googleStatus = !google ? "Unable to check" : !google.configured ? "Setup needed" : google.connection?.status === "active" ? "Connected" : google.connection?.status === "error" ? "Needs attention" : "Not connected";
  const notifications = getInquiryNotificationConfiguration();
  const settings = [
    { icon: KeyRound, label: "Your sign-in", value: mailLogin ? "Shared with Mail" : "Website password", detail: mailLogin ? "Use your email inbox password here. Change it in Mail settings; password resets sign you out of both apps." : "This environment uses a separate website password.", healthy: true },
    { icon: UsersRound, label: "Team access", value: "Approval required", detail: mailLogin ? "The mail owner approves teammates in Mail → Manage team. Dashboard roles control what each person can do." : "Only approved internal team accounts can sign in.", healthy: true },
    { icon: Inbox, label: "Shared email inbox", value: inbox.connected ? "Connected" : "Setup or access needed", detail: inbox.detail, healthy: inbox.connected },
    { icon: Phone, label: "SMS and calling", value: "Not yet enabled", detail: "Twilio SMS, calling, voicemail, recordings and transcripts are the next communications increments.", healthy: false },
    { icon: BarChart3, label: "Google Search Console", value: googleStatus, detail: "See how people find your website in Google. Open Analytics to connect, review updates, or fix a connection.", healthy: googleStatus === "Connected" },
    { icon: Mail, label: "Inquiry notifications", value: notifications ? "Configured" : "Not configured", detail: notifications ? `New inquiry alerts go to ${notifications.to.join(" and ")}. Every inquiry is also saved in Leads.` : "Email alerts need setup. New inquiries are still saved in Leads.", healthy: Boolean(notifications) },
    { icon: BarChart3, label: "Website activity", value: "Enabled", detail: "Visits and inquiry activity are measured when the visitor's privacy settings allow it.", healthy: true },
    { icon: Database, label: "Workspace storage", value: "Available", detail: "Your clients, projects, inquiries, and saved reports are stored here.", healthy: true },
  ];
  return <>
    <header className="dashboard-topbar"><div><span>Your workspace</span><strong>Settings</strong></div><span className="dashboard-secure"><ShieldCheck size={16} />Private team workspace</span></header>
    <div className="dashboard-content">
      <section className="dashboard-page-heading dashboard-page-heading-compact"><div><span>Account and connections</span><h1>Settings</h1><p>Check your access, manage your password, and see which services are connected.</p></div></section>
      <nav className="dashboard-quick-actions" aria-label="Settings shortcuts"><Link href="/dashboard/inbox" className="dashboard-secondary-button">Shared email inbox</Link><a className="dashboard-secondary-button" href="https://mail.tailoredagents.com/settings" target="_blank" rel="noreferrer">Email and password settings<span className="sr-only"> (new tab)</span></a><Link href="/dashboard/analytics" className="dashboard-secondary-button">Google connection and reports</Link></nav>
      <section className="dashboard-settings-grid">
        <article className="dashboard-panel dashboard-workspace-card"><span>Your workspace</span><div className="dashboard-workspace-identity"><i>TA</i><div><h2>{context.workspace.name}</h2><p>{context.user.email}</p></div></div><dl><div><dt>Your role</dt><dd>{context.role}</dd></div><div><dt>Workspace</dt><dd><CheckCircle2 size={16} />Active</dd></div></dl><p>{context.role === "viewer" ? "You can view records and reports. Ask an owner or administrator if you need editing access." : context.role === "member" ? "You can update leads, clients, and projects, and view reports. Owners and administrators manage the Google connection." : "You can manage workspace records and the Google reporting connection. The mail owner manages team sign-in access."}</p></article>
        <article className="dashboard-panel dashboard-system-card"><div className="dashboard-panel-heading"><div><span>Service status</span><h2>Connections and access</h2></div></div><div className="dashboard-settings-list">{settings.map(({ icon: Icon, label, value, detail, healthy }) => <div key={label}><span><Icon size={20} /></span><div><strong>{label}</strong><small>{detail}</small></div><em className={healthy ? "" : "is-neutral"}>{value}</em></div>)}</div></article>
      </section>
      <section className="dashboard-panel dashboard-boundary-card"><ShieldCheck size={22} /><div><h2>This workspace is private to your team</h2><p>Clients cannot sign in to this dashboard. If you need a password reset or someone has left the team, contact the mail owner.</p></div></section>
    </div>
  </>;
}
