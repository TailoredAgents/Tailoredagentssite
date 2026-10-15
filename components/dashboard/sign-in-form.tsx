"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import { dashboardAuthClient } from "@/lib/dashboard/auth-client";

type FormStatus = "idle" | "submitting" | "sent" | "error";

export function SignInForm({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState<FormStatus>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || status === "submitting") return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email) return;

    setStatus("submitting");
    const result = await dashboardAuthClient.signIn.magicLink({
      email,
      callbackURL: "/dashboard",
      newUserCallbackURL: "/dashboard",
      errorCallbackURL: "/sign-in?status=invalid-link",
    });

    setStatus(result.error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <div className="signin-confirmation" role="status">
        <span><CheckCircle2 size={20} /></span>
        <div>
          <h2>Check your inbox</h2>
          <p>If that address has access, a one-time sign-in link is on its way. It expires in 10 minutes.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="signin-form" onSubmit={handleSubmit}>
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
      <button type="submit" disabled={!enabled || status === "submitting"}>
        {status === "submitting" ? <LoaderCircle className="signin-spinner" size={17} /> : null}
        {status === "submitting" ? "Sending secure link" : "Continue with email"}
        {status !== "submitting" ? <ArrowRight size={16} aria-hidden="true" /> : null}
      </button>
      {status === "error" ? <p className="signin-error" role="alert">We could not send the link. Check the address and try again.</p> : null}
    </form>
  );
}
