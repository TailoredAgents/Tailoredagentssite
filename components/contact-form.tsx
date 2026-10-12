"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { interestOptions, type ContactErrors } from "@/lib/contact";

type Status = { type: "idle" | "submitting" | "success" | "error"; message?: string };

export function ContactForm() {
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
    const submissionId = `inquiry_${crypto.randomUUID().replaceAll("-", "")}`;
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, startedAt: startedAt.current, submissionId }) });
      const result = await response.json() as { message?: string; errors?: ContactErrors };
      if (!response.ok) {
        setErrors(result.errors || {});
        setStatus({ type: "error", message: result.message || "The inquiry could not be sent." });
        return;
      }
      form.reset();
      startedAt.current = Date.now();
      setStatus({ type: "success", message: result.message });
    } catch {
      setStatus({ type: "error", message: "A network error prevented delivery. Nothing was recorded; please try again." });
    }
  }

  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      <div className="form-grid">
        <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" autoComplete="name" required aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined}/>{errors.name && <p className="field-error" id="name-error">{errors.name}</p>}</div>
        <div className="field"><label htmlFor="organization">Business or organization</label><input id="organization" name="organization" autoComplete="organization" required aria-invalid={!!errors.organization} aria-describedby={errors.organization ? "organization-error" : undefined}/>{errors.organization && <p className="field-error" id="organization-error">{errors.organization}</p>}</div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined}/>{errors.email && <p className="field-error" id="email-error">{errors.email}</p>}</div>
        <div className="field"><label htmlFor="phone">Phone <span className="optional">(optional)</span></label><input id="phone" name="phone" type="tel" autoComplete="tel" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-error" : undefined}/>{errors.phone && <p className="field-error" id="phone-error">{errors.phone}</p>}</div>
        <div className="field field-full"><label htmlFor="interest">Area of interest</label><select id="interest" name="interest" defaultValue="" required aria-invalid={!!errors.interest} aria-describedby={errors.interest ? "interest-error" : undefined}><option value="" disabled>Select an area</option>{interestOptions.map((option) => <option key={option}>{option}</option>)}</select>{errors.interest && <p className="field-error" id="interest-error">{errors.interest}</p>}</div>
        <div className="field field-full"><label htmlFor="description">Brief project description</label><textarea id="description" name="description" required minLength={30} maxLength={3000} placeholder="What are you trying to improve, connect, or build?" aria-invalid={!!errors.description} aria-describedby={errors.description ? "description-error" : "description-help"}/><p className="text-muted" id="description-help" style={{fontSize:".67rem",margin:0}}>Please avoid including confidential, regulated, or sensitive personal information.</p>{errors.description && <p className="field-error" id="description-error">{errors.description}</p>}</div>
        <div className="hp-field" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off"/></div>
      </div>
      <div className="form-foot"><p>By submitting, you agree to our <Link href="/privacy" style={{textDecoration:"underline"}}>privacy notice</Link>. We use these details only to respond to your inquiry.</p><button className="button button-dark" type="submit" disabled={status.type === "submitting"}>{status.type === "submitting" ? <LoaderCircle size={15} className="spin"/> : <>Send inquiry<ArrowRight size={15}/></>}</button></div>
      {status.type !== "idle" && status.type !== "submitting" && <div className={`form-status ${status.type}`} role="status">{status.message}</div>}
    </form>
  );
}
