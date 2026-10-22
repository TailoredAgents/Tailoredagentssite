import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Globe2,
  LockKeyhole,
  Pause,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { requireDashboardContext } from "@/lib/dashboard/data";
import { getSeoDashboard } from "@/lib/seo/service";
import { dollars, managedPaths } from "@/lib/seo/config";
import {
  saveSeoSettingsAction,
  pauseSeoAction,
  queueSeoAction,
  reconcileSeoAction,
} from "@/lib/seo/actions";
import { OperationForm } from "@/components/dashboard/operation-form";
import { LocalTime } from "@/components/sales/date-time-field";
import {
  SalesPanel,
  SalesMetric,
  SalesStatus,
  SalesEmpty,
} from "@/components/sales/workspace";
import type { Proposal } from "@/lib/seo/provider";
import "@/app/dashboard/sales/sales.css";
import "./seo.css";
export const metadata: Metadata = { title: "SEO manager" };
export default async function SeoPage() {
  const data = await getSeoDashboard(await requireDashboardContext()),
    m = data.manager;
  const plan = data.runs.find(
    (r) => r.kind === "strategy" && r.status === "succeeded",
  )?.result as Partial<Proposal> | undefined;
  const ready = data.changes.filter((c) => c.status === "ready"),
    issues = data.pages.reduce(
      (n, p) => n + (p.snapshot.issues?.length || 0),
      0,
    ),
    limit = Number(m.monthly_limit_micros);
  return (
    <>
      <header className="dashboard-topbar">
        <div>
          <span>Tailored Agents / Growth</span>
          <strong>SEO manager</strong>
        </div>
        <span className="dashboard-secure">
          <LockKeyhole size={14} aria-hidden="true" />
          Private workspace
        </span>
      </header>
      <div className="seo-heading">
        <div>
          <span className="sales-eyebrow">Your ongoing search strategy</span>
          <h1>SEO manager</h1>
          <p>
            A continuous improvement loop for Tailored Agents: observe, plan,
            review, publish and measure. National reach, with focused Georgia
            service areas.
          </p>
        </div>
        <div>
          <SalesStatus value={m.enabled ? "active" : "paused"}>
            {m.enabled ? "Running on schedule" : "Paused"}
          </SalesStatus>
          {m.enabled && data.canManage ? (
            <form action={pauseSeoAction}>
              <button type="submit" className="sales-button">
                <Pause size={15} aria-hidden="true" />
                Pause manager
              </button>
            </form>
          ) : null}
          <Link className="sales-button" href="/dashboard/seo">
            <RefreshCw size={15} aria-hidden="true" />
            Refresh
          </Link>
        </div>
      </div>
      <nav className="seo-tabs" aria-label="SEO manager sections">
        <a href="#overview">Overview</a>
        <a href="#review">Work to review</a>
        <a href="#strategy">Strategy</a>
        <a href="#health">Site health</a>
        <a href="#controls">Settings</a>
        <a href="#history">Run history</a>
      </nav>
      <div className="seo-body">
        <div className="sales-metrics" id="overview">
          <SalesMetric
            label="This month's usage"
            value={dollars(data.spent)}
            detail={`Includes unresolved reservations · ${dollars(limit)} limit · UTC billing month`}
            tone="blue"
          />
          <SalesMetric
            label="Ready for review"
            value={ready.length}
            detail="Evidence checked; awaiting your factual review"
          />
          <SalesMetric
            label="Pages observed"
            value={`${data.pages.length} / ${managedPaths.length}`}
            detail={`${issues} technical observations in the latest snapshots`}
          />
          <SalesMetric
            label="Google clicks"
            value={
              data.metrics.latestGoogleDate ? (data.metrics.clicks ?? "—") : "—"
            }
            detail={
              data.metrics.latestGoogleDate
                ? `Latest finalized date ${data.metrics.latestGoogleDate}`
                : "Connect Google in Analytics to add search evidence"
            }
            tone="teal"
          />
        </div>
        <div className="seo-status-row">
          <span>
            <Sparkles size={16} aria-hidden="true" />
            AI {data.configuration.ai ? "configured" : "needs an API key"}
          </span>
          <span>
            <Search size={16} aria-hidden="true" />
            Search data{" "}
            {data.configuration.research ? "configured" : "not connected yet"}
          </span>
          <span>
            <Activity size={16} aria-hidden="true" />
            Worker{" "}
            {m.last_worker_at ? (
              <LocalTime value={m.last_worker_at.toISOString()} />
            ) : (
              "awaiting first check"
            )}
          </span>
          <span>
            <BarChart3 size={16} aria-hidden="true" />
            {data.metrics.complete
              ? "Google window covered"
              : `${data.metrics.coverageDays} of ${data.metrics.expectedDays} Google dates covered`}
          </span>
        </div>
        {!m.last_worker_at || !data.configuration.research ? (
          <SalesPanel
            title="Finish the connections"
            eyebrow="One-time activation"
          >
            <div className="seo-box">
              <p>
                {!m.last_worker_at
                  ? "The separate SEO worker needs its first scheduled check. Its deployment instructions are in the repository's SEO_MANAGER_SETUP.md runbook."
                  : "The worker is checking for work. Scanning and strategy can run with the existing Google connection."}
              </p>
              {!data.configuration.research ? (
                <p>
                  DataForSEO adds national/local keyword observations and
                  competitor evidence. Create the account, add its API login and
                  password to the web service and SEO worker, then redeploy.
                  Credentials stay in Render.
                </p>
              ) : null}
              <p className="seo-muted">
                This release publishes reviewed page titles and descriptions.
                Content briefs remain in the strategy for the next delivery
                step.
              </p>
            </div>
          </SalesPanel>
        ) : null}
        {data.canManage ? (
          <SalesPanel
            title="Keep the work moving"
            eyebrow="Runs continue in the background"
          >
            <div className="seo-box seo-action-grid">
              {[
                {
                  kind: "monitor",
                  title: "Scan the website",
                  description:
                    "Check registered public pages for metadata, headings, crawl directives and canonical issues.",
                  label: "Queue website scan",
                },
                {
                  kind: "strategy",
                  title: "Plan the next improvements",
                  description:
                    "Use current snapshots, actual Google evidence and previous work to prepare useful changes.",
                  label: "Queue strategy",
                },
                {
                  kind: "research",
                  title: "Check search opportunities",
                  description:
                    "Collect keyword observations by market and device through your connected data account.",
                  label: "Queue keyword research",
                },
              ].map((item) => (
                <OperationForm
                  key={item.kind}
                  action={queueSeoAction}
                  submitLabel={item.label}
                >
                  <input type="hidden" name="kind" value={item.kind} />
                  <h3>{item.title}</h3>
                  <p className="seo-muted">{item.description}</p>
                </OperationForm>
              ))}
            </div>
          </SalesPanel>
        ) : null}
        <SalesPanel
          id="review"
          title="Work to review"
          eyebrow="Exact wording, sources and a reversible publication"
        >
          {ready.length ? (
            ready.map((c) => (
              <article className="seo-work-card" key={c.id}>
                <div>
                  <SalesStatus value={c.status}>Ready for review</SalesStatus>
                  <h3>{c.title}</h3>
                  <p>
                    {c.path} · {c.rationale}
                  </p>
                </div>
                <Link
                  className="sales-button"
                  href={`/dashboard/seo/changes/${c.id}`}
                >
                  Review change
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </article>
            ))
          ) : (
            <SalesEmpty title="No changes waiting for review">
              A strategy run can propose a few evidence-backed improvements. A
              healthy page can also be left as it is.
            </SalesEmpty>
          )}
        </SalesPanel>
        <div className="seo-split">
          <SalesPanel
            id="strategy"
            title="Current strategy"
            eyebrow="Keep the next step tied to evidence"
          >
            <div className="seo-box">
              {plan?.summary ? (
                <>
                  <p>{plan.summary}</p>
                  {plan.priorities?.map((p, i) => (
                    <article className="seo-plan-item" key={i}>
                      <h3>{p.title}</h3>
                      <p>{p.reason}</p>
                      <small className="seo-muted">
                        {p.path} · {p.confidence} confidence
                      </small>
                    </article>
                  ))}
                </>
              ) : (
                <p className="seo-muted">
                  The first strategy will appear after the website scan and AI
                  planning run complete. It will show the evidence used,
                  uncertainty and the highest-value next work.
                </p>
              )}
            </div>
          </SalesPanel>
          <SalesPanel
            title="Content opportunities"
            eyebrow="Original, useful material to develop"
          >
            <div className="seo-box">
              {plan?.briefs?.length ? (
                plan.briefs.map((b, i) => (
                  <article className="seo-plan-item" key={i}>
                    <h3>{b.topic}</h3>
                    <p className="seo-muted">For {b.audience}</p>
                    <p>{b.outline}</p>
                    <small className="seo-muted">
                      Sources: {b.sourcePaths.join(", ")} · Brief only
                    </small>
                  </article>
                ))
              ) : (
                <p className="seo-muted">
                  Content briefs will connect customer questions to our actual
                  services and demonstrated work.
                </p>
              )}
            </div>
          </SalesPanel>
        </div>
        <SalesPanel
          id="health"
          title="Website evidence"
          eyebrow="Observed pages, rather than an invented SEO score"
        >
          {data.pages.length ? (
            <div
              className="seo-table-wrap"
              role="region"
              aria-label="Website evidence table"
              tabIndex={0}
            >
              <table className="seo-table">
                <thead>
                  <tr>
                    <th scope="col">Page</th>
                    <th scope="col">Observations</th>
                    <th scope="col">Scanned</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pages.map((p) => (
                    <tr key={p.path}>
                      <td>
                        <Link
                          href={`https://www.tailoredagents.com${p.path}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {p.path}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </Link>
                      </td>
                      <td>
                        {p.snapshot.issues.length
                          ? p.snapshot.issues.join(" · ")
                          : "No checks flagged"}
                      </td>
                      <td>
                        <LocalTime value={p.crawled_at.toISOString()} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <SalesEmpty title="The first scan builds the baseline">
              Only the registered public marketing pages are scanned. The
              private CRM and messages stay outside this evidence.
            </SalesEmpty>
          )}
        </SalesPanel>
        <SalesPanel
          title="Keyword observations"
          eyebrow="Location and device are part of every observation"
        >
          {data.research.length ? (
            <div
              className="seo-table-wrap"
              role="region"
              aria-label="Keyword observations table"
              tabIndex={0}
            >
              <table className="seo-table">
                <thead>
                  <tr>
                    <th scope="col">Search term</th>
                    <th scope="col">Market / device</th>
                    <th scope="col">Our observed position</th>
                    <th scope="col">Checked</th>
                  </tr>
                </thead>
                <tbody>
                  {data.research.map((r, i) => {
                    const own = r.result?.items?.find(
                      (item: { url?: string }) => {
                        try {
                          return (
                            new URL(item.url || "").hostname ===
                              "www.tailoredagents.com" ||
                            new URL(item.url || "").hostname ===
                              "tailoredagents.com"
                          );
                        } catch {
                          return false;
                        }
                      },
                    );
                    return (
                      <tr key={i}>
                        <td>{r.keyword}</td>
                        <td>
                          {r.location}
                          <br />
                          <span className="seo-muted">{r.device}</span>
                        </td>
                        <td>
                          {r.status === "ready"
                            ? (own?.position ?? "Outside returned results")
                            : r.status}
                        </td>
                        <td>
                          {r.checked_at ? (
                            <LocalTime value={r.checked_at.toISOString()} />
                          ) : (
                            "Awaiting collection"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="seo-box">
              <p className="seo-muted">
                Connect DataForSEO to collect national and local search
                observations. Missing observations are not reported as zero
                rankings.
              </p>
            </div>
          )}
        </SalesPanel>
        <SalesPanel
          id="controls"
          title="Strategy & operating controls"
          eyebrow="Standing instructions for the manager"
        >
          <OperationForm
            action={saveSeoSettingsAction}
            submitLabel="Save SEO settings"
            disabled={!data.canManage}
          >
            <div className="dashboard-form-grid">
              <label className="dashboard-field">
                <span>Monthly AI & data limit ($)</span>
                <input
                  name="budget"
                  type="number"
                  min={1}
                  max={90}
                  step="0.01"
                  required
                  defaultValue={limit / 1_000_000}
                />
                <small>
                  The current usage estimate is $30–$40/month. The ledger
                  reserves costs before paid requests.
                </small>
              </label>
              <label className="dashboard-field">
                <span>Local service areas</span>
                <textarea
                  name="localMarkets"
                  rows={6}
                  maxLength={2000}
                  defaultValue={m.local_markets.join("\n")}
                />
                <small>
                  One provider location per line. Service areas do not imply
                  local offices.
                </small>
              </label>
              <label className="dashboard-field">
                <span>Priority search terms</span>
                <textarea
                  name="keywords"
                  rows={6}
                  maxLength={7000}
                  required
                  defaultValue={m.keywords.join("\n")}
                />
                <small>
                  Up to 50 keywords, one per line. The United States is included
                  alongside local markets.
                </small>
              </label>
              <label className="dashboard-field">
                <span>Business priorities and guidance</span>
                <textarea
                  name="instructions"
                  rows={6}
                  maxLength={6000}
                  defaultValue={m.instructions}
                  placeholder="Which services, customers and original expertise should guide the next plan?"
                />
              </label>
            </div>
            <details>
              <summary>Review the business knowledge</summary>
              <p className="seo-muted">{data.profile.audience}</p>
              {data.profile.services.map((s) => (
                <div className="seo-plan-item" key={s.name}>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                </div>
              ))}
              <p className="seo-muted">
                These are the published offers the manager must preserve:
              </p>
              {Object.values(data.profile.publicPricing).map((offer) => (
                <div className="seo-plan-item" key={offer.label}>
                  <h3>{offer.label}</h3>
                  <p>
                    {offer.qualifier} {offer.price}. {offer.note}
                  </p>
                  <Link href={offer.href} target="_blank" rel="noreferrer">
                    Review published offer
                    <span className="sr-only">
                      {" "}
                      for {offer.label} (opens in a new tab)
                    </span>
                  </Link>
                </div>
              ))}
            </details>
            <label className="seo-checkbox">
              <input
                type="checkbox"
                name="profileReviewed"
                defaultChecked={Boolean(m.profile_reviewed_at)}
              />
              <span>
                I have reviewed the business knowledge, service areas and
                priorities.
              </span>
            </label>
            <label className="seo-checkbox">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={m.enabled}
              />
              <span>
                Run daily monitoring, weekly strategy and connected keyword
                research within this monthly limit.
              </span>
            </label>
          </OperationForm>
        </SalesPanel>
        <SalesPanel
          id="history"
          title="Run history"
          eyebrow="What happened, including interruptions"
        >
          {data.runs.length ? (
            data.runs.map((r) => (
              <article className="seo-work-card" key={r.id}>
                <div>
                  <SalesStatus value={r.status}>{r.status}</SalesStatus>
                  <h3>
                    {r.kind.charAt(0).toUpperCase() + r.kind.slice(1)} ·{" "}
                    {r.stage}
                  </h3>
                  <p>
                    {typeof r.result.summary === "string"
                      ? r.result.summary
                      : r.error_code
                        ? r.error_code.replaceAll("_", " ")
                        : "Waiting for the next worker stage."}
                  </p>
                  <p>
                    <LocalTime value={r.created_at.toISOString()} />
                  </p>
                </div>
              </article>
            ))
          ) : (
            <SalesEmpty title="Ready for the first check">
              Queue a free website scan or enable the recurring manager after
              reviewing the settings.
            </SalesEmpty>
          )}
        </SalesPanel>
        <SalesPanel
          title="Publication & measurement history"
          eyebrow="Changes retain their review and outcome"
        >
          {data.changes.filter((c) => c.status !== "ready").length ? (
            data.changes
              .filter((c) => c.status !== "ready")
              .map((c) => (
                <article className="seo-work-card" key={c.id}>
                  <div>
                    <SalesStatus value={c.status}>
                      {c.status.replaceAll("_", " ")}
                    </SalesStatus>
                    <h3>{c.title}</h3>
                    <p>
                      {c.path}
                      {c.evaluation_due_at ? (
                        <>
                          {" "}
                          · Observation review{" "}
                          <LocalTime
                            value={c.evaluation_due_at.toISOString()}
                          />
                        </>
                      ) : null}
                    </p>
                  </div>
                  <Link
                    className="sales-button"
                    href={`/dashboard/seo/changes/${c.id}`}
                  >
                    Open history
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </article>
              ))
          ) : (
            <SalesEmpty title="Each published change gets an observation window">
              Live verification checks the actual metadata. Later performance is
              recorded with coverage and uncertainty.
            </SalesEmpty>
          )}
        </SalesPanel>
        <SalesPanel
          title="Usage receipts"
          eyebrow="Paid requests are reserved before they start"
        >
          <div className="seo-box">
            <p>
              {dollars(data.spent)} accounted against {dollars(limit)} this UTC
              month. Unconfirmed requests retain their reservation until
              reconciled.
            </p>
            <progress
              className="seo-budget-bar"
              aria-label="Monthly SEO budget used"
              max={limit}
              value={Math.min(data.spent, limit)}
            />
          </div>
          {data.costs.length ? (
            <div
              className="seo-table-wrap"
              role="region"
              aria-label="Usage receipts table"
              tabIndex={0}
            >
              <table className="seo-table">
                <thead>
                  <tr>
                    <th scope="col">Request</th>
                    <th scope="col">State</th>
                    <th scope="col">Accounted</th>
                  </tr>
                </thead>
                <tbody>
                  {data.costs.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.provider} · {c.operation}
                      </td>
                      <td>{c.status}</td>
                      <td>{dollars(c.actual_micros ?? c.reserved_micros)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {data.canManage
            ? data.costs
                .filter((c) => c.status === "uncertain")
                .map((c) => (
                  <details className="seo-box" key={c.id}>
                    <summary>
                      Reconcile an unconfirmed {c.provider} charge
                    </summary>
                    <OperationForm
                      action={reconcileSeoAction}
                      submitLabel="Reconcile provider charge"
                    >
                      <input type="hidden" name="id" value={c.id} />
                      <p>
                        Check the provider's usage history first. Record the
                        confirmed amount and receipt reference. This does not
                        retry the request.
                      </p>
                      <label className="dashboard-field">
                        <span>Actual charge ($)</span>
                        <input
                          type="number"
                          name="actual"
                          min="0"
                          max="1000"
                          step="0.000001"
                          required
                        />
                      </label>
                      <label className="dashboard-field">
                        <span>Provider receipt reference</span>
                        <input
                          name="reference"
                          minLength={3}
                          maxLength={200}
                          required
                        />
                      </label>
                    </OperationForm>
                  </details>
                ))
            : null}
        </SalesPanel>
        <div className="seo-status-row">
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>
            Published copy gets a factual review. Permitted monitoring and
            planning continue automatically.
          </span>
          <Link href="/dashboard/analytics" className="sales-button">
            <Globe2 size={15} aria-hidden="true" />
            Open website reports
          </Link>
        </div>
      </div>
    </>
  );
}
