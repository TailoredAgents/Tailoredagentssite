"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { ContactErrors } from "@/lib/contact";
import { trackAnalyticsEvent } from "@/lib/analytics/client";

type Status = { type: "idle" | "submitting" | "success" | "error"; message?: string };

export function WebsiteReviewForm() {
  const startedAt = useRef(0);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [errors, setErrors] = useState<ContactErrors>({});

  useEffect(() => { startedAt.current = Date.now(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus({ type: "submitting" });
    setErrors({});
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const submissionId = `review_${crypto.randomUUID().replaceAll("-", "")}`;

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, startedAt: startedAt.current, submissionId }),
      });
      const result = await response.json() as { message?: string; errors?: ContactErrors };
      if (!response.ok) {
        setErrors(result.errors || {});
        setStatus({ type: "error", message: result.message || "The review request could not be sent." });
        return;
      }
      form.reset();
      startedAt.current = Date.now();
      setStatus({ type: "success", message: result.message });
      if (response.status === 201) {
        trackAnalyticsEvent("form_success", { formType: "website-review" });
      }
    } catch {
      setStatus({ type: "error", message: "A network error interrupted the request. Please check your connection before trying again." });
    }
  }

  return (
    <form className="contact-form review-request-form" data-analytics-form="website-review" onSubmit={submit} noValidate>
      <input type="hidden" name="inquiryType" value="website-review" />
      <div className="form-heading"><span>Request your review</span><h2>Tell us where to look.</h2><p>Share your current website and the best way to reach you. The goal field is optional.</p></div>
      <div className="form-grid">
        <div className="field"><label htmlFor="review-name">Contact name</label><input id="review-name" name="name" autoComplete="name" required aria-invalid={!!errors.name} aria-describedby={errors.name ? "review-name-error" : undefined}/>{errors.name && <p className="field-error" id="review-name-error">{errors.name}</p>}</div>
        <div className="field"><label htmlFor="review-organization">Business name</label><input id="review-organization" name="organization" autoComplete="organization" required aria-invalid={!!errors.organization} aria-describedby={errors.organization ? "review-organization-error" : undefined}/>{errors.organization && <p className="field-error" id="review-organization-error">{errors.organization}</p>}</div>
        <div className="field"><label htmlFor="review-email">Email address</label><input id="review-email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} aria-describedby={errors.email ? "review-email-error" : undefined}/>{errors.email && <p className="field-error" id="review-email-error">{errors.email}</p>}</div>
        <div className="field"><label htmlFor="review-phone">Phone number <span className="optional">(optional)</span></label><input id="review-phone" name="phone" type="tel" autoComplete="tel" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "review-phone-error" : undefined}/>{errors.phone && <p className="field-error" id="review-phone-error">{errors.phone}</p>}</div>
        <div className="field field-full"><label htmlFor="websiteUrl">Current website URL</label><input id="websiteUrl" name="websiteUrl" type="url" inputMode="url" placeholder="https://yourbusiness.com" required aria-invalid={!!errors.websiteUrl} aria-describedby={errors.websiteUrl ? "website-url-error" : "website-url-help"}/><p className="text-muted" id="website-url-help">A public website is required so we know what to review.</p>{errors.websiteUrl && <p className="field-error" id="website-url-error">{errors.websiteUrl}</p>}</div>
        <div className="field field-full"><label htmlFor="review-description">Primary concern or goal <span className="optional">(optional)</span></label><textarea id="review-description" name="description" maxLength={1000} placeholder="For example: the site feels dated, mobile inquiries are difficult, or local visibility is unclear." aria-invalid={!!errors.description} aria-describedby={errors.description ? "review-description-error" : "review-description-help"}/><p className="text-muted" id="review-description-help">Please do not include confidential, regulated, or sensitive personal information.</p>{errors.description && <p className="field-error" id="review-description-error">{errors.description}</p>}</div>
        <div className="hp-field" aria-hidden="true"><label htmlFor="review-website-hp">Leave this field blank</label><input id="review-website-hp" name="website" tabIndex={-1} autoComplete="off"/></div>
      </div>
      <div className="form-foot"><p>By submitting, you agree to our <Link href="/privacy">privacy notice</Link>. We use these details only to review your request and respond.</p><button className="button button-dark" type="submit" disabled={status.type === "submitting"}>{status.type === "submitting" ? <LoaderCircle size={15} className="spin"/> : <>Request my review<ArrowRight size={15}/></>}</button></div>
      {status.type !== "idle" && status.type !== "submitting" && <div className={`form-status ${status.type}`} role="status">{status.message}</div>}
    </form>
  );
}
