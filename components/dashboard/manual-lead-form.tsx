"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ChevronDown, LoaderCircle, Plus, X } from "lucide-react";
import { createLeadAction } from "@/lib/operations/actions";
import { initialOperationActionState } from "@/lib/operations/validation";

const emptyLead = {
  organization: "",
  name: "",
  phone: "",
  email: "",
  websiteUrl: "",
  interest: "",
  description: "",
};

type LeadField = keyof typeof emptyLead;

export function ManualLeadForm() {
  const [open, setOpen] = useState(false);
  const [submissionId, setSubmissionId] = useState("");
  const [values, setValues] = useState(emptyLead);
  const [state, formAction, pending] = useActionState(
    createLeadAction,
    initialOperationActionState,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const businessRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (open) businessRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (state.status !== "error") return;
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [state]);

  function closeForm() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function fieldProps(field: LeadField) {
    return {
      name: field,
      value: values[field],
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) =>
        setValues((current) => ({ ...current, [field]: event.target.value })),
      "aria-labelledby": `manual-lead-${field}-label`,
      "aria-invalid": Boolean(state.fieldErrors?.[field]?.length),
      "aria-describedby": state.fieldErrors?.[field]?.length
        ? `manual-lead-${field}-error`
        : field === "phone" || field === "email"
          ? "manual-lead-contact-help"
          : undefined,
    };
  }

  function fieldError(field: LeadField) {
    const error = state.fieldErrors?.[field]?.[0];
    return error ? (
      <small
        className="dashboard-manual-lead-error"
        id={`manual-lead-${field}-error`}
      >
        {error}
      </small>
    ) : null;
  }

  return (
    <section className="dashboard-manual-lead" aria-label="Manual lead entry">
      <div className="dashboard-manual-lead-toolbar">
        <button
          ref={triggerRef}
          type="button"
          className="dashboard-primary-button"
          aria-expanded={open}
          aria-controls="manual-lead-panel"
          disabled={pending}
          onClick={() => {
            if (open) closeForm();
            else {
              if (!submissionId) setSubmissionId(crypto.randomUUID());
              setOpen(true);
            }
          }}
        >
          <Plus size={17} aria-hidden="true" />
          Add lead
        </button>
        <p>Quickly add a prospect, referral, or call-in.</p>
      </div>

      {open ? (
        <div id="manual-lead-panel" className="dashboard-panel">
          <div className="dashboard-panel-heading dashboard-manual-lead-heading">
            <div>
              <span>Manual entry</span>
              <h2>New lead</h2>
            </div>
            <button
              type="button"
              className="dashboard-manual-lead-close"
              aria-label="Close new lead form"
              onClick={closeForm}
              disabled={pending}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <form
            ref={formRef}
            action={formAction}
            className="dashboard-operation-form"
            aria-label="Add lead"
            aria-busy={pending}
          >
            <input type="hidden" name="submissionId" value={submissionId} />
            <fieldset className="dashboard-operation-fields" disabled={pending}>
              <div className="dashboard-form-grid">
                <label className="dashboard-field">
                  <span id="manual-lead-organization-label">
                    Business name <small>(optional)</small>
                  </span>
                  <input
                    {...fieldProps("organization")}
                    ref={businessRef}
                    maxLength={140}
                    autoComplete="organization"
                    placeholder="Business or organization"
                  />
                  {fieldError("organization")}
                </label>
                <label className="dashboard-field">
                  <span id="manual-lead-name-label">
                    Contact name <small>(optional)</small>
                  </span>
                  <input
                    {...fieldProps("name")}
                    maxLength={100}
                    autoComplete="name"
                    placeholder="Who should we contact?"
                  />
                  {fieldError("name")}
                </label>
                <label className="dashboard-field">
                  <span id="manual-lead-phone-label">Phone</span>
                  <input
                    {...fieldProps("phone")}
                    type="tel"
                    maxLength={40}
                    autoComplete="tel"
                    required={!values.email.trim()}
                    placeholder="(555) 123-4567"
                  />
                  {fieldError("phone")}
                </label>
                <label className="dashboard-field">
                  <span id="manual-lead-email-label">Email</span>
                  <input
                    {...fieldProps("email")}
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    placeholder="name@business.com"
                  />
                  {fieldError("email")}
                </label>
              </div>
              <p
                id="manual-lead-contact-help"
                className="dashboard-manual-lead-help"
              >
                Add a phone number or email so you can follow up.
              </p>
              <details
                className="dashboard-manual-lead-details"
                open={
                  Boolean(
                    state.fieldErrors?.websiteUrl ||
                      state.fieldErrors?.interest ||
                      state.fieldErrors?.description,
                  ) || undefined
                }
              >
                <summary>
                  More details <span>(optional)</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </summary>
                <div className="dashboard-form-grid">
                  <label className="dashboard-field">
                    <span id="manual-lead-websiteUrl-label">Website</span>
                    <input
                      {...fieldProps("websiteUrl")}
                      maxLength={2000}
                      autoComplete="url"
                      inputMode="url"
                      placeholder="business.com"
                    />
                    {fieldError("websiteUrl")}
                  </label>
                  <label className="dashboard-field">
                    <span id="manual-lead-interest-label">
                      Service or interest
                    </span>
                    <input
                      {...fieldProps("interest")}
                      maxLength={160}
                      placeholder="Website redesign, AI agent, SEO…"
                    />
                    {fieldError("interest")}
                  </label>
                  <label className="dashboard-field dashboard-field-full">
                    <span id="manual-lead-description-label">Notes</span>
                    <textarea
                      {...fieldProps("description")}
                      maxLength={3000}
                      rows={3}
                      placeholder="How you found them, what they need, or anything useful for the next conversation"
                    />
                    {fieldError("description")}
                  </label>
                </div>
              </details>
            </fieldset>
            <div className="dashboard-form-footer dashboard-manual-lead-footer">
              <p
                className={`dashboard-form-message is-${state.status}`}
                role={state.status === "error" ? "alert" : "status"}
              >
                {state.message || "Starts as a new lead, assigned to you."}
              </p>
              <div className="dashboard-manual-lead-actions">
                <button
                  type="button"
                  className="dashboard-manual-lead-cancel"
                  onClick={closeForm}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button type="submit" disabled={pending}>
                  {pending ? (
                    <LoaderCircle
                      className="signin-spinner"
                      size={16}
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus size={16} aria-hidden="true" />
                  )}
                  {pending ? "Adding lead…" : "Save lead"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
