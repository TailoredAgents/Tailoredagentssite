import type { Metadata } from "next";
import { BarChart3, CheckCircle2, Database, KeyRound, Mail, ShieldCheck, UsersRound } from "lucide-react";
import { requireDashboardContext } from "@/lib/dashboard/data";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const context = await requireDashboardContext();
  const settings = [
    [Database, "PostgreSQL", "Connected", "Durable application and session storage"],
    [KeyRound, "Password authentication", "Active", "Hashed credentials with database-backed sessions"],
    [Mail, "Inquiry email delivery", process.env.RESEND_API_KEY ? "Active" : "Optional", "Resend notifications do not control dashboard access"],
    [BarChart3, "First-party analytics", "Active", "Session-scoped measurement without persistent tracking cookies"],
    [UsersRound, "Access policy", "Allowlist only", "No public registration or client access"],
  ] as const;

  return (
    <>
      <header className="dashboard-topbar"><div><span>System</span><strong>Settings</strong></div><span className="dashboard-secure"><ShieldCheck size={15} />Protected session</span></header>
      <div className="dashboard-content">
        <section className="dashboard-page-heading dashboard-page-heading-compact"><div><span>Workspace controls</span><h1>System settings</h1><p>Connection and security state without exposing secret values.</p></div></section>
        <section className="dashboard-settings-grid">
          <article className="dashboard-panel dashboard-workspace-card"><span>Internal workspace</span><div className="dashboard-workspace-identity"><i>TA</i><div><h2>{context.workspace.name}</h2><p>/{context.workspace.slug}</p></div></div><dl><div><dt>Your role</dt><dd>{context.role}</dd></div><div><dt>Workspace state</dt><dd><CheckCircle2 size={13} />Active</dd></div></dl></article>
          <article className="dashboard-panel dashboard-system-card"><div className="dashboard-panel-heading"><div><span>Security dependencies</span><h2>System configuration</h2></div></div><div className="dashboard-settings-list">{settings.map(([Icon, label, value, detail]) => <div key={label}><span><Icon size={16} /></span><div><strong>{label}</strong><small>{detail}</small></div><em>{value}</em></div>)}</div></article>
        </section>
        <section className="dashboard-panel dashboard-boundary-card"><ShieldCheck size={19} /><div><h2>Access remains internal</h2><p>Client invitations, external provider credentials, and agent controls remain outside the current release. First-party measurement does not grant access to any private workspace or third-party account.</p></div></section>
      </div>
    </>
  );
}
