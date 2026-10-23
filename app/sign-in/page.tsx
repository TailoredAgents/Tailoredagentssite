import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { SignInForm } from "@/components/dashboard/sign-in-form";
import { resolveDashboardConfiguration } from "@/lib/dashboard/config";
import { getOptionalDashboardContext } from "@/lib/dashboard/data";
import { redirect } from "next/navigation";
import "./sign-in.css";

export const metadata: Metadata = {
  title: "Team sign in",
  description: "Secure team access to the Tailored Agents dashboard.",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const configuration = resolveDashboardConfiguration();
  const status = (await searchParams).status;

  if (configuration.ready && await getOptionalDashboardContext()) redirect("/dashboard");

  return (
    <div className="signin-page">
      <div className="signin-atmosphere" aria-hidden="true" />
      <header className="signin-header">
        <Link href="/" className="signin-brand" aria-label="Tailored Agents home"><BrandLogo dark /></Link>
        <Link href="/" className="signin-back"><ArrowLeft size={15} />Back to website</Link>
      </header>

      <section className="signin-shell">
        <div className="signin-copy">
          <span className="signin-kicker"><LockKeyhole size={13} />Private workspace</span>
          <h1>One clear place to run the work behind the <em>growth.</em></h1>
          <p>The Tailored Agents dashboard brings client operations, website health, measurement, and future growth tools into a secure internal workspace.</p>
          <div className="signin-trust"><ShieldCheck size={17} /><span><strong>Team-only access</strong><small>Only approved team members can enter this private workspace.</small></span></div>
        </div>

        <div className="signin-card">
          <div className="signin-card-heading">
            <span>Team access</span>
            <h2>Sign in to the dashboard</h2>
            <p>{configuration.authMode === "mail" ? "Use the same email address and password you use for Tailored Agents Mail." : "Use an approved Tailored Agents email address and your dashboard password."}</p>
          </div>

          {!configuration.ready ? (
            <div className="signin-setup" role="status">
              <strong>Dashboard setup is in progress.</strong>
              <p>The public website is available, but private access will remain closed until its database and security configuration are connected.</p>
            </div>
          ) : (
            <SignInForm enabled mailLogin={configuration.authMode === "mail"} />
          )}

          {status === "unauthorized" ? <p className="signin-notice">A new sign-in is required, or this account does not currently have workspace access.</p> : null}
          <p className="signin-privacy">Access attempts are rate limited. Account availability is not disclosed.</p>
        </div>
      </section>
    </div>
  );
}
