import { PhoneNumbers } from "@/components/conversations/phone-numbers";
import { getConversationRecipient } from "@/lib/conversations/recipients";
import { leadDisplayName, leadCompanyName, leadBusinessName } from "@/lib/operations/format";
import { RecordFacts } from "@/components/dashboard/record-facts";
import { DeleteLeadButton } from "@/components/dashboard/delete-lead-button";
import { StartFactoryButton } from "@/components/factory/start-button";
import { getFactoryLeadProject } from "@/lib/factory/data";
import "@/app/dashboard/factory.css";
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
  Sparkles,
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
  const [lead, members, websitePlan] = await Promise.all([
    getLead(context, id),
    getWorkspaceMembers(context),
    getFactoryLeadProject(context, id),
  ]);
  if (!lead) notFound();
  const phoneRecipient = id ? await getConversationRecipient(context, "lead", id) : null;
  const mutable = context.role !== "viewer";
  const manual = lead.source === "manual";
  const meta = lead.source === "facebook";

  return (
    <>
      <header className="dashboard-topbar">
        <div>
          <span>Leads</span>
          <strong>{leadDisplayName(lead)}</strong>
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
              {meta ? "Facebook / Instagram lead" : manual
                ? "Manually added lead"
                : lead.inquiryType === "website-review"
                  ? "Website review"
                  : "Project inquiry"}
            </span>
            <h1>{leadDisplayName(lead)}</h1>
            {leadCompanyName(lead) && <p>{leadCompanyName(lead)}</p>}
            <p>
              {meta ? `Received in the CRM on ${formatOperationalDate(lead.createdAt)}.` : manual
                ? `Added manually on ${formatOperationalDate(lead.createdAt)}.`
                : `${lead.name} submitted this inquiry on ${formatOperationalDate(lead.createdAt)}.`}
            </p>
          </div>
          <em className={`dashboard-status status-${lead.status}`}>
            {statusLabel(lead.status)}
          </em>
        </section>

        <div className="dashboard-record-contact-action" style={{ display: "flex", flexWrap: "wrap", gap: ".65rem" }}><Link className="dashboard-primary-button" href={`/dashboard/inbox?lead=${lead.id}`}><MessageSquareText size={16} aria-hidden="true" />Contact lead</Link>{websitePlan ? <Link className="dashboard-secondary-button" href={`/dashboard/sales/factory/${websitePlan.id}`}><Sparkles size={16} aria-hidden="true" />Open website project</Link> : mutable ? <StartFactoryButton leadId={lead.id} /> : null}{websitePlan?.latestBuild?.previewUrl ? <a className="dashboard-secondary-button" href={websitePlan.latestBuild.previewUrl} target="_blank" rel="noreferrer">View website</a> : null}</div>
        <RecordFacts facts={[{label:"Lead owner",value:lead.ownerName || "Unassigned"},{label:"Service interest",value:lead.interest || "General inquiry"},{label:"Follow-up",value:lead.nextActionAt ? formatOperationalDate(lead.nextActionAt,{dateOnly:true}) : "Not scheduled"}]} />
        <div className="dashboard-record-grid">
          <div className="dashboard-record-main">{phoneRecipient ? <section className="dashboard-panel dashboard-detail-card"><PhoneNumbers recipient={phoneRecipient} readOnly={!mutable}/></section> : null}
            <section className="dashboard-panel dashboard-detail-card">
              <div className="dashboard-panel-heading">
                <div>
                  <span>{manual ? "Lead details" : "Inquiry"}</span>
                  <h2>Original context</h2>
                </div>
                {meta ? <small>Instant Form</small> : manual ? (
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
              {lead.metaContext && <dl className="dashboard-detail-list">
                <div><dt>Platform</dt><dd>{lead.metaContext.platform || "Facebook / Instagram"}</dd></div>
                <div><dt>Campaign</dt><dd>{lead.metaContext.campaignName || lead.metaContext.campaignId || "Not supplied by Meta"}</dd></div>
                <div><dt>Ad</dt><dd>{lead.metaContext.adName || lead.metaContext.adId || "Organic or unavailable"}</dd></div>
                <div><dt>Form ID</dt><dd>{lead.metaContext.formId}</dd></div>
                <div><dt>Submitted</dt><dd>{lead.metaContext.submittedAt ? formatOperationalDate(lead.metaContext.submittedAt) : "Unknown"}</dd></div>
              </dl>}
              {lead.acquisition && <dl className="dashboard-detail-list">
                <div><dt>Traffic source</dt><dd>{lead.acquisition.utmSource || "Direct / unknown"}{lead.acquisition.utmMedium ? ` / ${lead.acquisition.utmMedium}` : ""}</dd></div>
                <div><dt>Campaign</dt><dd>{lead.acquisition.utmCampaign || "Not tagged"}</dd></div>
                <div><dt>Ad / content</dt><dd>{lead.acquisition.utmContent || "Not tagged"}</dd></div>
                <div><dt>Landing page</dt><dd>{lead.acquisition.landingPath || "/"}</dd></div>
              </dl>}
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
                        defaultValue={leadBusinessName(lead)}
                        required
                        minLength={2}
                        maxLength={160}
                      />
                    </label>
                    <label className="dashboard-field dashboard-field-full">
                      <span>Initial project</span>
                      <input
                        name="projectName"
                        defaultValue={`${leadBusinessName(lead)} — Initial engagement`}
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
            {mutable ? <DeleteLeadButton leadId={lead.id} name={leadDisplayName(lead)} /> : null}
          </aside>
        </div>
      </div>
    </>
  );
}
