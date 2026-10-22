import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getSeoChange, getSeoDashboard } from "@/lib/seo/service";
import { SeoInputError } from "@/lib/seo/types";
import {
  publishSeoAction,
  rollbackSeoAction,
  rejectSeoAction,
} from "@/lib/seo/actions";
import { OperationForm } from "@/components/dashboard/operation-form";
import { SalesPanel, SalesStatus } from "@/components/sales/workspace";
import { LocalTime } from "@/components/sales/date-time-field";
import "@/app/dashboard/sales/sales.css";
import "../../seo.css";
export const metadata: Metadata = { title: "Review SEO change" };
export default async function SeoChangePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireDashboardContext(),
    { id } = await params;
  let change;
  try {
    change = await getSeoChange(context, id);
  } catch (error) {
    if (error instanceof SeoInputError) notFound();
    throw error;
  }
  const data = await getSeoDashboard(context),
    ready = change.status === "ready" && data.canManage;
  const outcome = change.outcome as {
      observed?: Record<string, unknown>;
    } | null,
    baseline = change.baseline_metrics as Record<string, unknown> | null;
  const measured = (
    source: Record<string, unknown> | undefined | null,
    key: string,
  ) => (typeof source?.[key] === "number" ? String(source[key]) : "—");
  return (
    <>
      <header className="dashboard-topbar">
        <div>
          <span>Tailored Agents / SEO manager</span>
          <strong>Review & publication</strong>
        </div>
        <Link href="/dashboard/seo">Back to SEO manager</Link>
      </header>
      <div className="seo-heading">
        <div>
          <span className="sales-eyebrow">
            An exact, reversible improvement
          </span>
          <h1>Review search metadata</h1>
          <p>
            {change.path} ·{" "}
            <SalesStatus value={change.status}>
              {change.status.replaceAll("_", " ")}
            </SalesStatus>
          </p>
        </div>
        <Link className="sales-button" href="/dashboard/seo#review">
          SEO manager
        </Link>
      </div>
      <div className="seo-body">
        <SalesPanel title="Why this change" eyebrow="Source-linked proposal">
          <div className="seo-box">
            <p>{change.rationale}</p>
            {change.review ? (
              <p>
                <strong>Independent review:</strong> {change.review.reason}
              </p>
            ) : null}
            {change.evidence.map((e, i) => (
              <blockquote className="seo-evidence" key={i}>
                <p>{e.quote}</p>
                <Link
                  href={`https://www.tailoredagents.com${e.path}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source: {e.path}
                  <span className="sr-only"> (opens in a new tab)</span>
                </Link>
              </blockquote>
            ))}
          </div>
        </SalesPanel>
        <div className="seo-split">
          <SalesPanel
            title="Observed version"
            eyebrow="The page when this proposal was prepared"
          >
            <div className="seo-box">
              <div className="seo-copy-preview">
                <small>tailoredagents.com{change.path}</small>
                <h3>{change.baseline.title}</h3>
                <p>{change.baseline.description}</p>
              </div>
            </div>
          </SalesPanel>
          <SalesPanel
            title="Proposed version"
            eyebrow="A preview, not a guaranteed Google snippet"
          >
            <div className="seo-box">
              <div className="seo-copy-preview">
                <small>tailoredagents.com{change.path}</small>
                <h3>{change.title}</h3>
                <p>{change.description}</p>
              </div>
            </div>
          </SalesPanel>
        </div>
        {ready ? (
          <SalesPanel
            title="Review the final wording"
            eyebrow="Publication updates this page's title and description"
          >
            <OperationForm
              action={publishSeoAction}
              submitLabel="Publish reviewed change"
            >
              <input type="hidden" name="id" value={change.id} />
              <input type="hidden" name="version" value={change.version} />
              <div className="dashboard-form-grid">
                <label className="dashboard-field dashboard-field-full">
                  <span>Page title *</span>
                  <input
                    name="title"
                    minLength={10}
                    maxLength={90}
                    required
                    defaultValue={change.title}
                  />
                </label>
                <label className="dashboard-field dashboard-field-full">
                  <span>Search description *</span>
                  <textarea
                    name="description"
                    minLength={30}
                    maxLength={250}
                    required
                    defaultValue={change.description}
                  />
                </label>
              </div>
              <label className="seo-checkbox">
                <input type="checkbox" name="factChecked" required />
                <span>
                  I checked the final wording against the page and our actual
                  business facts.
                </span>
              </label>
              <p className="seo-muted">
                The page is checked again before publication. A changed baseline
                requires a fresh proposal. Live verification and a 28-day
                observation window follow publication.
              </p>
            </OperationForm>
            <OperationForm
              action={rejectSeoAction}
              submitLabel="Reject proposal"
            >
              <input type="hidden" name="id" value={change.id} />
              <p className="seo-muted">
                Keep the existing version and retain this decision in the
                manager's history.
              </p>
            </OperationForm>
          </SalesPanel>
        ) : null}
        {["published", "verified", "failed"].includes(change.status) &&
        data.canManage ? (
          <SalesPanel
            title="Restore the previous version"
            eyebrow="The active version is checked before rollback"
          >
            <OperationForm
              action={rollbackSeoAction}
              submitLabel="Restore previous metadata"
            >
              <input type="hidden" name="id" value={change.id} />
              <p>
                The previous publication is preserved. A newer active
                publication cannot be overwritten by rolling back this older
                one.
              </p>
            </OperationForm>
          </SalesPanel>
        ) : null}
        <SalesPanel
          title="Verification & outcome"
          eyebrow="What has actually happened"
        >
          <div className="seo-box">
            <div className="seo-detail-row">
              <strong>Published</strong>
              <span>
                {change.published_at ? (
                  <LocalTime value={change.published_at.toISOString()} />
                ) : (
                  "Awaiting reviewed publication"
                )}
              </span>
            </div>
            <div className="seo-detail-row">
              <strong>Live verified</strong>
              <span>
                {change.verified_at ? (
                  <LocalTime value={change.verified_at.toISOString()} />
                ) : (
                  "No successful verification recorded"
                )}
              </span>
            </div>
            <div className="seo-detail-row">
              <strong>Observation review</strong>
              <span>
                {change.evaluation_due_at ? (
                  <LocalTime value={change.evaluation_due_at.toISOString()} />
                ) : (
                  "Scheduled after publication"
                )}
              </span>
            </div>
            {outcome?.observed ? (
              <>
                <p className="seo-muted">
                  Post-change evidence is recorded. Before/after observations do
                  not establish that this change caused a ranking or inquiry
                  difference. Google dates covered:{" "}
                  {measured(outcome.observed, "coverageDays")} /{" "}
                  {measured(outcome.observed, "expectedDays")}.
                </p>
                <div
                  className="seo-table-wrap"
                  role="region"
                  aria-label="Outcome comparison table"
                  tabIndex={0}
                >
                  <table className="seo-table">
                    <thead>
                      <tr>
                        <th scope="col">Page evidence</th>
                        <th scope="col">Before</th>
                        <th scope="col">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["clicks", "Google clicks"],
                        ["impressions", "Google impressions"],
                        ["measured_visits", "Measured visits"],
                        ["measured_inquiries", "Measured inquiries"],
                      ].map(([key, label]) => (
                        <tr key={key}>
                          <td>{label}</td>
                          <td>{measured(baseline, key)}</td>
                          <td>{measured(outcome.observed, key)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="seo-muted">
                Search results need time and enough covered dates to evaluate.
                No improvement is claimed before observations exist.
              </p>
            )}
          </div>
        </SalesPanel>
      </div>
    </>
  );
}
