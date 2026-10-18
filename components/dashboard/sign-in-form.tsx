"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, KeyRound, LoaderCircle, Mail } from "lucide-react";

type FormStatus = "idle" | "submitting" | "error";

export function SignInForm({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState<FormStatus>("idle");

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
        setStatus("error");
        return;
      }

      window.location.assign("/dashboard");
    } catch {
      setStatus("error");
    }
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
      <label htmlFor="dashboard-password">Password</label>
      <div className="signin-field">
        <KeyRound size={17} aria-hidden="true" />
        <input
          id="dashboard-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Your dashboard password"
          minLength={10}
          maxLength={128}
          required
          disabled={!enabled || status === "submitting"}
        />
      </div>
      <button type="submit" disabled={!enabled || status === "submitting"}>
        {status === "submitting" ? <LoaderCircle className="signin-spinner" size={17} /> : null}
        {status === "submitting" ? "Signing in" : "Sign in"}
        {status !== "submitting" ? <ArrowRight size={16} aria-hidden="true" /> : null}
      </button>
      {status === "error" ? <p className="signin-error" role="alert">The email or password was not accepted. Check both and try again.</p> : null}
    </form>
  );
}
