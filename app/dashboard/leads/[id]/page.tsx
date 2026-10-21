import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CircleDollarSign,
  Mail,
  MessageSquareText,
  Phone,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { notFound } from "next/navigation";
import { OperationForm } from "@/components/dashboard/operation-form";
import { requireDashboardContext } from "@/lib/dashboard/data";
import {
  addLeadNoteAction,
  convertLeadAction,
  updateLeadAction,
} from "@/lib/operations/actions";
import { getLead, getWorkspaceMembers } from "@/lib/operations/data";
import {
  formatOperationalDate,
  inputDate,
  statusLabel,
} from "@/lib/operations/format";
import { leadStatuses } from "@/lib/operations/validation";

export const metadata: Metadata = { title: "Lead workspace" };

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireDashboardContext();
  const { id } = await params;
  const [lead, members] = await Promise.all([
    getLead(context, id),
    getWorkspaceMembers(context),
  ]);
  if (!lead) notFound();
  const mutable = context.role !== "viewer";
  const manual = lead.source === "manual";

  return (
    <>
      <header className="dashboard-topbar">
        <div>
          <span>Leads</span>
          <strong>{lead.organization}</strong>
        </div>
        <span className="dashboard-secure">
          <ShieldCheck size={15} />
          Protected session
        </span>
      </header>
      <div className="dashboard-content">
        <Link className="dashboard-back-link" href="/dashboard/leads">
          <ArrowLeft size={14} />
          Back to leads
        </Link>
        <section className="dashboard-page-heading dashboard-page-heading-compact dashboard-record-heading">
          <div>
            <span>
              {manual
                ? "Manually added lead"
                : lead.inquiryType === "website-review"
                  ? "Website review"
                  : "Project inquiry"}
            </span>
            <h1>{lead.organization}</h1>
            <p>
              {manual
                ? `Added manually on ${formatOperationalDate(lead.createdAt)}.`
                : `${lead.name} submitted this inquiry on ${formatOperationalDate(lead.createdAt)}.`}
            </p>
          </div>
          <em className={`dashboard-status status-${lead.status}`}>
            {statusLabel(lead.status)}
          </em>
        </section>

        <div className="dashboard-record-grid">
          <div className="dashboard-record-main">
            <section className="dashboard-panel dashboard-detail-card">
              <div className="dashboard-panel-heading">
                <div>
                  <span>{manual ? "Lead details" : "Inquiry"}</span>
                  <h2>Original context</h2>
                </div>
                {manual ? (
                  <small>Added manually</small>
                ) : (
                  <small className={`delivery-${lead.deliveryStatus}`}>
                    {lead.deliveryStatus === "not_configured"
                      ? "Email alerts were not enabled when received"
                      : `Email alert: ${statusLabel(lead.deliveryStatus)}`}
                  </small>
                )}
              </div>
              <dl className="dashboard-detail-list">
                <div>
                  <dt>
                    <UserRound size={14} />
                    Contact
                  </dt>
                  <dd>{lead.name || "Business contact"}</dd>
                </div>
                <div>
                  <dt>
                    <Mail size={14} />
                    Email
                  </dt>
                  <dd>
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`}>{lead.email}</a>
                    ) : (
                      "Not provided"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>
                    <Phone size={14} />
                    Phone
                  </dt>
                  <dd>
                    {lead.phone ? (
                      <a href={`tel:${lead.phone}`}>{lead.phone}</a>
                    ) : (
                      "Not provided"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>
                    <CalendarClock size={14} />
                    Retention
                  </dt>
                  <dd>
                    Until{" "}
                    {formatOperationalDate(lead.retainedUntil, {
                      dateOnly: true,
                    })}
                  </dd>
                </div>
              </dl>
              {lead.websiteUrl ? (
                <p className="dashboard-detail-link">
                  <strong>Website</strong>
                  <a href={lead.websiteUrl} target="_blank" rel="noreferrer">
                    {lead.websiteUrl}
                  </a>
                </p>
              ) : null}
              <div className="dashboard-long-copy">
                <strong>
                  {lead.inquiryType === "website-review"
                    ? "Primary concern"
                    : lead.interest || "Project description"}
                </strong>
                <p>
                  {lead.description || "No additional context was provided."}
                </p>
              </div>
            </section>

            <section className="dashboard-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <span>History</span>
                  <h2>Internal notes</h2>
                </div>
              </div>
              <OperationForm
                disabled={!mutable}
                action={addLeadNoteAction}
                submitLabel="Add note"
                resetOnSuccess
              >
                <fieldset disabled={!mutable} className="dashboard-form-grid">
                  <input type="hidden" name="leadId" value={lead.id} />
                  <label className="dashboard-field dashboard-field-full">
                    <span>New note</span>
                    <textarea
                      name="body"
                      required
                      minLength={2}
                      maxLength={4000}
                      placeholder="Call outcome, qualification context, or follow-up details"
                    />
                  </label>
                </fieldset>
              </OperationForm>
              <div className="dashboard-notes-list">
                {lead.notes.length ? (
                  lead.notes.map((note) => (
                    <article key={note.id}>
                      <span>
                        <MessageSquareText size={15} />
                      </span>
                      <div>
                        <p>{note.body}</p>
                        <small>
                          {note.authorName} ·{" "}
                          {formatOperationalDate(note.createdAt)}
                        </small>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="dashboard-empty">
                    <MessageSquareText size={20} />
                    <strong>No internal notes yet</strong>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="dashboard-record-aside">
            <section className="dashboard-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <span>Pipeline</span>
                  <h2>Lead management</h2>
                </div>
              </div>
              <OperationForm
                disabled={!mutable}
                action={updateLeadAction}
                submitLabel="Save lead"
              >
                <fieldset disabled={!mutable} className="dashboard-form-grid">
                  <input type="hidden" name="leadId" value={lead.id} />
                  <label className="dashboard-field">
                    <span>Status</span>
                    <select name="status" defaultValue={lead.status}>
                      {leadStatuses.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="dashboard-field">
                    <span>Owner</span>
                    <select
                      name="ownerUserId"
                      defaultValue={lead.ownerUserId || ""}
                    >
                      <option value="">Unassigned</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name || member.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="dashboard-field dashboard-field-full">
                    <span>Next action</span>
                    <input
                      name="nextAction"
                      defaultValue={lead.nextAction || ""}
                      maxLength={300}
                      placeholder="Schedule discovery call"
                    />
                  </label>
                  <label className="dashboard-field dashboard-field-full">
                    <span>Next action date</span>
                    <input
                      type="date"
                      name="nextActionAt"
                      defaultValue={inputDate(lead.nextActionAt)}
                    />
                  </label>
                  <label className="dashboard-field dashboard-field-full">
                    <span>Outcome summary</span>
                    <textarea
                      name="outcomeSummary"
                      defaultValue={lead.outcomeSummary || ""}
                      maxLength={1000}
                      placeholder="Record why the lead was won, lost, or deferred"
                    />
                  </label>
                </fieldset>
              </OperationForm>
            </section>

            {lead.clientId ? (
              <section className="dashboard-panel dashboard-conversion-complete">
                <UsersRound size={19} />
                <div>
                  <span>Converted</span>
                  <h2>Client record created</h2>
                  <Link href={`/dashboard/clients/${lead.clientId}`}>
                    Open client
                  </Link>
                </div>
              </section>
            ) : (
              <section className="dashboard-panel">
                <div className="dashboard-panel-heading">
                  <div>
                    <span>Conversion</span>
                    <h2>Create the operating records</h2>
                  </div>
                </div>
                <OperationForm
                  disabled={!mutable}
                  action={convertLeadAction}
                  submitLabel="Convert lead"
                  pendingLabel="Converting"
                >
                  <fieldset disabled={!mutable} className="dashboard-form-grid">
                    <input type="hidden" name="leadId" value={lead.id} />
                    <label className="dashboard-field dashboard-field-full">
                      <span>Client name</span>
                      <input
                        name="clientName"
                        defaultValue={lead.organization}
                        required
                        minLength={2}
                        maxLength={160}
                      />
                    </label>
                    <label className="dashboard-field dashboard-field-full">
                      <span>Initial project</span>
                      <input
                        name="projectName"
                        defaultValue={`${lead.organization} — Initial engagement`}
                        required
                        minLength={2}
                        maxLength={180}
                      />
                    </label>
                    <label className="dashboard-field dashboard-field-full">
                      <span>Project summary</span>
                      <textarea
                        name="projectSummary"
                        defaultValue={lead.description || ""}
                        maxLength={2000}
                      />
                    </label>
                    {lead.websiteUrl ? (
                      <label className="dashboard-check">
                        <input
                          type="checkbox"
                          name="createSite"
                          defaultChecked
                        />
                        <span>
                          Create a managed site record for {lead.websiteUrl}
                        </span>
                      </label>
                    ) : null}
                  </fieldset>
                </OperationForm>
                <p className="dashboard-form-note">
                  <CircleDollarSign size={14} />
                  Creates the client, primary contact, initial project, and
                  optional site in one transaction.
                </p>
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
