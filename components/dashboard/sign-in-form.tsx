"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, KeyRound, LoaderCircle, Mail } from "lucide-react";

type FormStatus = "idle" | "submitting" | "error";

export function SignInForm({ enabled, mailLogin = false }: { enabled: boolean; mailLogin?: boolean }) {
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("The email or password was not accepted. Check both and try again.");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || status === "submitting") return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    if (!email || !password) return;

    setStatus("submitting");
    try {
      const response = await fetch("/api/dashboard/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        const messages: Record<string, string> = {
          password_change_required: "First sign in to your email inbox and change your temporary password. Then use your new password here.",
          dashboard_not_approved: "Your email login worked, but dashboard access is not approved. Ask the owner to enable it in Mail → Manage team.",
          rate_limited: "Too many sign-in attempts. Please wait 15 minutes and try again.",
          unavailable: "We cannot reach the mail sign-in service right now. Please try again shortly.",
        };
        setErrorMessage(messages[result.code] ?? (response.status === 429 ? messages.rate_limited : response.status >= 500 ? messages.unavailable : "The email or password was not accepted. Check both and try again."));
        setStatus("error");
        return;
      }

      window.location.assign(mailLogin ? "/dashboard/analytics" : "/dashboard");
    } catch {
      setErrorMessage("We could not connect. Please check your connection and try again.");
      setStatus("error");
    }
  }

  return (
    <form className="signin-form" method="post" onSubmit={handleSubmit}>
      <label htmlFor="dashboard-email">Team email</label>
      <div className="signin-field">
        <Mail size={17} aria-hidden="true" />
        <input
          id="dashboard-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@tailoredagents.com"
          required
          disabled={!enabled || status === "submitting"}
        />
      </div>
      <label htmlFor="dashboard-password">Password</label>
      <div className="signin-field">
        <KeyRound size={17} aria-hidden="true" />
        <input
          id="dashboard-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder={mailLogin ? "Your email inbox password" : "Your dashboard password"}
          minLength={mailLogin ? 1 : 10}
          maxLength={128}
          required
          disabled={!enabled || status === "submitting"}
        />
      </div>
      <button type="submit" disabled={!interactive || !enabled || status === "submitting"}>
        {status === "submitting" ? <LoaderCircle className="signin-spinner" size={17} /> : null}
        {status === "submitting" ? "Signing in" : "Sign in"}
        {status !== "submitting" ? <ArrowRight size={16} aria-hidden="true" /> : null}
      </button>
      {status === "error" ? <p className="signin-error" role="alert">{errorMessage}</p> : null}
      {mailLogin ? <p className="signin-notice"><a href="https://mail.tailoredagents.com/login">Open your email inbox</a> to change your password. Ask the owner if you have forgotten it.</p> : null}
    </form>
  );
}
