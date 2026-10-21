"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  Download,
  Globe2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import type {
  ReportingOverview,
  ReportTable,
  TableRow,
} from "@/lib/reporting/data";
import type { ReportingStatus } from "@/lib/reporting/status";
import type { DateRange, ReportSelection } from "@/lib/reporting/dates";

const number = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 1 });
function dates(range: DateRange) {
  return `${range.start} – ${range.end}`;
}
function selectionQuery(selection: ReportSelection) {
  return new URLSearchParams(
    Object.entries(selection).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ).toString();
}
function LocalTime({ value }: { value: string | null }) {
  const [formatted, setFormatted] = useState(
    value
      ? `${value.replace("T", " ").slice(0, 16)} UTC`
      : "No activity recorded",
  );
  useEffect(() => {
    if (value)
      setFormatted(
        new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value)) +
          " (" +
          Intl.DateTimeFormat().resolvedOptions().timeZone +
          ")",
      );
  }, [value]);
  return <time dateTime={value ?? undefined}>{formatted}</time>;
}
function Comparison({
  value,
  previous,
}: {
  value: number;
  previous: number | null;
}) {
  if (previous === null) return <small>Not enough earlier data</small>;
  if (previous === 0)
    return (
      <small>
        {value === 0 ? "No change" : `Up ${number(value)}`} from the preceding
        period
      </small>
    );
  const change = ((value - previous) / previous) * 100;
  return (
    <small>
      {change > 0 ? "↑" : change < 0 ? "↓" : "—"} {number(Math.abs(change))}%
      from the preceding period
    </small>
  );
}
function Trend({
  title,
  range,
  data,
  first,
  second,
}: {
  title: string;
  range: DateRange;
  data: { day: string; a: number | null; b: number | null }[];
  first: string;
  second: string;
}) {
  const max = Math.max(1, ...data.flatMap((row) => [row.a ?? 0, row.b ?? 0]));
  const x = (i: number) => 70 + (i * 500) / Math.max(1, data.length - 1),
    y = (value: number) => 178 - (value / max) * 140;
  const path = (key: "a" | "b") => {
    let connected = false;
    return data
      .map((row, i) => {
        if (row[key] === null) {
          connected = false;
          return "";
        }
        const p = `${connected ? "L" : "M"}${x(i)},${y(row[key]!)}`;
        connected = true;
        return p;
      })
      .join(" ");
  };
  const empty = data.every((row) => row.a === null && row.b === null);
  return (
    <section className="report-panel report-trend">
      <header>
        <div>
          <h2>{title}</h2>
          <p>{dates(range)} · Pacific Time</p>
        </div>
        <BarChart3 size={21} aria-hidden="true" />
      </header>
      <div className="report-legend">
        <span>
          <i />
          {first}
        </span>
        <span>
          <i />
          {second}
        </span>
      </div>
      {empty ? (
        <div className="report-empty">
          There is no completed data for these dates yet.
        </div>
      ) : (
        <svg
          className="report-chart"
          viewBox="0 0 600 215"
          role="img"
          aria-label={`${title}. Use the data table below for exact numbers. Missing days are gaps.`}
        >
          {[0, 0.5, 1].map((level) => (
            <g key={level}>
              <line
                x1="70"
                x2="570"
                y1={y(max * level)}
                y2={y(max * level)}
                stroke="#e2e8f0"
                strokeDasharray={level ? "4 4" : undefined}
              />
              <text x="62" y={y(max * level) + 5} textAnchor="end">
                {number(Math.round(max * level))}
              </text>
            </g>
          ))}
          <path d={path("a")} fill="none" stroke="#2459cf" strokeWidth="3" />
          <path
            d={path("b")}
            fill="none"
            stroke="#0a807a"
            strokeWidth="2.5"
            strokeDasharray="6 3"
          />
          {data.length === 1 &&
            data.map((row, i) => (
              <g key={row.day}>
                {row.a !== null && (
                  <circle cx={x(i)} cy={y(row.a)} r="4" fill="#2459cf" />
                )}
                {row.b !== null && (
                  <circle cx={x(i)} cy={y(row.b)} r="4" fill="#0a807a" />
                )}
              </g>
            ))}
          <text x="70" y="207">
            {range.start.slice(5)}
          </text>
          <text x="570" y="207" textAnchor="end">
            {range.end.slice(5)}
          </text>
        </svg>
      )}
      <details className="report-chart-data">
        <summary>View chart data</summary>
        <div
          className="report-table-scroll"
          tabIndex={0}
          role="region"
          aria-label={`${title} data`}
        >
          <table>
            <caption>
              {title}, {dates(range)}. A dash means the day is incomplete or
              unimported.
            </caption>
            <thead>
              <tr>
                <th>Date</th>
                <th>{first}</th>
                <th>{second}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.day}>
                  <th scope="row">{row.day}</th>
                  <td>{row.a === null ? "—" : number(row.a)}</td>
                  <td>{row.b === null ? "—" : number(row.b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
const tableDefinitions: Record<
  ReportTable,
  { title: string; label: string; first: string; second: string }
> = {
  sources: {
    title: "Traffic sources",
    label: "Source",
    first: "Visits",
    second: "Converting sessions",
  },
  "website-pages": {
    title: "Website pages",
    label: "Page",
    first: "Page views",
    second: "Visits",
  },
  queries: {
    title: "Google search terms",
    label: "Search term",
    first: "Clicks",
    second: "Appearances",
  },
  "google-pages": {
    title: "Pages found on Google",
    label: "Page address",
    first: "Clicks",
    second: "Appearances",
  },
};
function DetailTable({
  table,
  selection,
  range,
  revision,
}: {
  table: ReportTable;
  selection: ReportSelection;
  range: DateRange;
  revision: string;
}) {
  const definition = tableDefinitions[table],
    query = selectionQuery(selection);
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [sort, setSort] = useState("primary"),
    [direction, setDirection] = useState("desc");
  const [result, setResult] = useState<{
      rows: TableRow[];
      total: number;
    } | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(
          `/api/dashboard/reports/table?${query}&${new URLSearchParams({ table, search, page: String(page), sort, direction })}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        setResult(await response.json());
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, table, search, page, sort, direction, revision, retry]);
  function order(key: string) {
    setDirection(sort === key && direction === "desc" ? "asc" : "desc");
    setSort(key);
    setPage(1);
  }
  const google = table === "queries" || table === "google-pages";
  return (
    <section className="report-panel report-detail">
      <header>
        <div>
          <h2>{definition.title}</h2>
          <p>{dates(range)} · Pacific Time</p>
        </div>
        <span className="report-pill">{google ? "Google" : "Website"}</span>
      </header>
      <label className="report-search">
        <Search size={18} aria-hidden="true" />
        <span className="report-sr">Search {definition.title}</span>
        <input
          type="search"
          placeholder={`Search ${definition.label.toLowerCase()}…`}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="report-warning">
          Could not update this table. Any rows below are from its previous
          view. <button onClick={() => setRetry(retry + 1)}>Retry table</button>
        </p>
      )}
      <div
        className="report-table-scroll"
        tabIndex={0}
        role="region"
        aria-label={definition.title}
        aria-busy={loading}
      >
        <table>
          <caption className="report-sr">
            {definition.title}. Choose a column heading to sort.
          </caption>
          <thead>
            <tr>
              {[
                ["label", definition.label],
                ["primary", definition.first],
                ["secondary", definition.second],
                ...(google ? [["position", "Avg. position"]] : []),
              ].map(([key, label]) => (
                <th
                  key={key}
                  scope="col"
                  aria-sort={
                    sort === key
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button onClick={() => order(key)}>
                    {label}
                    {sort === key ? (direction === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result?.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{number(row.primary)}</td>
                <td>{number(row.secondary)}</td>
                {google && <td>{number(row.position ?? 0)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!result?.rows.length && (
          <p className="report-empty">
            {loading
              ? "Loading saved data…"
              : error
                ? "The table is unavailable."
                : search
                  ? "No matching rows."
                  : "No recorded rows for these dates. Check data coverage below."}
          </p>
        )}
      </div>
      <footer>
        <span role="status">
          {loading
            ? "Updating…"
            : `${number(result?.total ?? 0)} rows · Page ${page}`}
        </span>
        <div>
          <button
            disabled={page === 1 || loading}
            onClick={() => setPage(page - 1)}
            aria-label={`Previous page of ${definition.title}`}
          >
            Previous
          </button>
          <button
            disabled={loading || page * 10 >= (result?.total ?? 0)}
            onClick={() => setPage(page + 1)}
            aria-label={`Next page of ${definition.title}`}
          >
            Next
          </button>
        </div>
      </footer>
    </section>
  );
}
const connectionMessages: Record<string, string> = {
  connected: "Google is connected. Your first import has been queued.",
  denied: "Google permission was declined. You can try connecting again.",
  invalid_state:
    "This connection request expired or was already used. Start a new Google connection.",
  matching_property_not_found:
    "The Google account must have access to the tailoredagents.com Domain property.",
  missing_refresh_token:
    "Google did not provide continuing access. Reconnect and approve access again.",
  scope_missing: "Approve the requested read-only Search Console permission.",
  connection_error:
    "The connection could not be completed. Review the setup, then try again.",
  not_configured:
    "Google setup is incomplete. Review the connection details below.",
};
export function ReportingDashboard({
  report,
  initialStatus,
  connectionResult,
  invalidDates,
}: {
  report: ReportingOverview;
  initialStatus: ReportingStatus;
  connectionResult?: string;
  invalidDates?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [statusError, setStatusError] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const lastProgress = useRef("");
  const active = status.runs.find((run) =>
    ["queued", "running", "retry_wait"].includes(run.status),
  );
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);
  useEffect(() => {
    let stopped = false;
    const controller = new AbortController();
    async function update() {
      try {
        const response = await fetch(
          "/api/integrations/search-console/status",
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        const next = (await response.json()) as ReportingStatus;
        if (stopped) return;
        setStatus(next);
        setStatusError(false);
        const progress = JSON.stringify(
          next.runs.map((run) => [run.id, run.completed, run.status]),
        );
        if (lastProgress.current && lastProgress.current !== progress)
          router.refresh();
        lastProgress.current = progress;
      } catch {
        if (!stopped) setStatusError(true);
      }
    }
    const interval = setInterval(update, active ? 5000 : 60000);
    void update();
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [Boolean(active), router]);
  async function action(name: "sync" | "disconnect") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/integrations/search-console/${name}`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error();
      setMessage(
        name === "sync"
          ? "Update queued. You can close this page; the background worker will continue."
          : "Google disconnected. Saved reports remain available.",
      );
      const next = await fetch("/api/integrations/search-console/status");
      if (next.ok) setStatus(await next.json());
      router.refresh();
      setConfirmDisconnect(false);
    } catch {
      setMessage(
        "That action could not be completed. Check your connection and sign-in, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const { website, google } = report,
    query = selectionQuery(report.selection),
    connected =
      status.connection && status.connection.status !== "disconnected";
  const needsReconnect = [
    "reconnect_required",
    "permission_required",
    "matching_property_not_found",
  ].includes(status.connection?.lastError ?? "");
  return (
    <main className="reporting" id="website-reports">
      <div className="report-breadcrumb">
        <span>
          <Globe2 size={17} aria-hidden="true" />
          Tailored Agents / Website reports
        </span>
        <span>
          <ShieldCheck size={16} aria-hidden="true" />
          Private team workspace
        </span>
      </div>
      <header className="report-heading">
        <div>
          <p className="report-eyebrow">YOUR WEBSITE, AT A GLANCE</p>
          <h1>
            See what’s bringing
            <br className="report-desktop-break" /> people to your business.
          </h1>
          <p>
            Traffic, search visibility, and real inquiries for{" "}
            <strong>www.tailoredagents.com</strong>.
          </p>
        </div>
        <div className="report-actions">
          <a
            className="report-button"
            href={`/api/dashboard/reports/export?${query}`}
          >
            <Download size={18} aria-hidden="true" />
            Export CSV
          </a>
          <button
            className="report-button report-primary"
            disabled={
              busy ||
              Boolean(active) ||
              !connected ||
              !status.configured ||
              needsReconnect ||
              !status.canManage
            }
            onClick={() => action("sync")}
          >
            <RefreshCw size={18} aria-hidden="true" />
            {active ? "Update in progress" : "Refresh Google"}
          </button>
        </div>
      </header>
      <section className="report-controls" aria-label="Report dates">
        <div className="report-presets">
          {["7d", "30d", "90d"].map((range) => (
            <Link
              key={range}
              href={`?range=${range}`}
              aria-current={
                report.selection.range === range ? "page" : undefined
              }
            >
              {range.slice(0, -1)} days
            </Link>
          ))}
        </div>
        <form key={query}>
          <input type="hidden" name="range" value="custom" />
          <label>
            From
            <input
              type="date"
              name="start"
              required
              defaultValue={report.selection.start ?? website.range.start}
            />
          </label>
          <label>
            To
            <input
              type="date"
              name="end"
              required
              defaultValue={report.selection.end ?? website.range.end}
            />
          </label>
          <button className="report-button" type="submit">
            Apply dates
          </button>
        </form>
      </section>
      <p className="report-date-note">
        Report days use Pacific Time. Custom ranges support up to 366 days.
        Google results arrive later than website activity.
      </p>
      {invalidDates && (
        <p className="report-warning" role="alert">
          Those custom dates could not be used. Choose valid dates in order, up
          to today and no more than 366 days apart. Showing the default 30-day
          report.
        </p>
      )}
      {connectionResult && (
        <p className="report-notice" role="status">
          {connectionMessages[connectionResult] ??
            "Review the Google connection details below."}
        </p>
      )}
      {message && (
        <p className="report-notice" role="status">
          {message}
        </p>
      )}
      {statusError && (
        <p className="report-warning" role="alert">
          Live status is unavailable. The last loaded report remains visible;
          try reloading if this continues.
        </p>
      )}
      {(status.worker.stale || status.connection?.lastError) && (
        <div className="report-warning" role="status">
          <strong>
            {status.worker.stale
              ? "Automatic updates need attention."
              : "The last Google update did not finish."}
          </strong>{" "}
          Saved reports remain available.{" "}
          {needsReconnect
            ? "Reconnect Google below to restore access."
            : "Review the connection details below."}
        </div>
      )}
      <div className="report-freshness">
        <span>
          <i />
          Latest website activity: <LocalTime value={report.latestActivity} />
        </span>
        <span>
          Google checked through{" "}
          <strong>{google.latest ?? "not imported yet"}</strong>
        </span>
      </div>
      <section className="report-metrics" aria-label="Main numbers">
        <article>
          <span className="report-metric-icon">
            <Globe2 size={21} />
          </span>
          <h2>Website visits</h2>
          <strong>{number(website.visits)}</strong>
          <p>Measured browser sessions, not distinct people.</p>
          <Comparison
            value={website.visits}
            previous={website.comparison?.visits ?? null}
          />
          <small className="report-metric-date">{dates(website.range)}</small>
        </article>
        <article>
          <span className="report-metric-icon">
            <Mail size={21} />
          </span>
          <h2>Received inquiries</h2>
          <strong>{number(website.inquiries)}</strong>
          <p>Successfully saved website inquiries.</p>
          <Comparison
            value={website.inquiries}
            previous={website.comparison?.inquiries ?? null}
          />
          <small className="report-metric-date">{dates(website.range)}</small>
        </article>
        <article>
          <span className="report-metric-icon">
            <ArrowUpRight size={21} />
          </span>
          <h2>Google search clicks</h2>
          <strong>{google.available ? number(google.clicks) : "—"}</strong>
          <p>Clicks from Google search to your website.</p>
          <Comparison
            value={google.clicks}
            previous={google.comparison?.clicks ?? null}
          />
          <small className="report-metric-date">{dates(google.range)}</small>
        </article>
        <article>
          <span className="report-metric-icon">
            <Search size={21} />
          </span>
          <h2>Search appearances</h2>
          <strong>{google.available ? number(google.impressions) : "—"}</strong>
          <p>Times your website appeared in Google results.</p>
          <Comparison
            value={google.impressions}
            previous={google.comparison?.impressions ?? null}
          />
          <small className="report-metric-date">{dates(google.range)}</small>
        </article>
      </section>
      {(!website.complete || !google.complete) && (
        <p className="report-notice">
          {!website.complete
            ? "Website measurement does not cover all requested dates. "
            : ""}
          {!google.complete
            ? `${google.missing.length} Google days in this range have not been checked. Available totals may be partial; gaps are not counted as zero.`
            : ""}
        </p>
      )}
      <div className="report-pair">
        <Trend
          title="Website activity"
          range={website.range}
          first="Visits"
          second="Inquiries"
          data={website.trend.map((row) => ({
            day: row.day,
            a: row.visits,
            b: row.inquiries,
          }))}
        />
        <Trend
          title="Google search performance"
          range={google.range}
          first="Clicks"
          second="Appearances"
          data={google.trend.map((row) => ({
            day: row.day,
            a: row.clicks,
            b: row.impressions,
          }))}
        />
      </div>
      <section className="report-insights" aria-label="What the numbers mean">
        <article>
          <h2>{number(website.conversionRate)}% inquiry conversion</h2>
          <p>
            {number(website.convertingVisits)} measured visits submitted an
            inquiry. {number(website.attributed)} of {number(website.inquiries)}{" "}
            inquiries have measurement context. Privacy choices and missing
            historical tracking explain some gaps.
          </p>
        </article>
        <article>
          <h2>
            {google.available ? `${number(google.ctr)}%` : "—"} click-through
            rate
          </h2>
          <p>
            The share of Google appearances that led to a click. Average search
            position:{" "}
            <strong>
              {google.available && google.impressions
                ? number(google.position)
                : "unavailable"}
            </strong>
            . A smaller position number is closer to the top.
          </p>
        </article>
      </section>
      <p className="report-date-note">
        Visitor actions:{" "}
        <strong>{number(website.activities.phoneClicks)} phone clicks</strong> ·{" "}
        <strong>
          {number(website.activities.bookingClicks)} booking clicks
        </strong>{" "}
        · <strong>{number(website.activities.formStarts)} form starts</strong>.
        These are separate activities, not proof of completed calls,
        appointments, or an ordered journey.
        {website.activities.legacySubmissions > 0
          ? ` ${website.activities.legacySubmissions} older browser-reported submissions are excluded from verified conversion counts.`
          : ""}
      </p>
      <div className="report-pair">
        {(
          [
            "sources",
            "website-pages",
            "queries",
            "google-pages",
          ] as ReportTable[]
        ).map((table) => (
          <DetailTable
            key={`${table}-${query}`}
            table={table}
            selection={report.selection}
            range={
              table === "queries" || table === "google-pages"
                ? google.range
                : website.range
            }
            revision={report.generatedAt}
          />
        ))}
      </div>
      <p className="report-date-note">
        Google clicks and measured visits come from different systems and can
        differ. Search totals use Google’s property totals. Google hides some
        search terms and limits detailed results; visible rows will not always
        add up to the totals.
        {google.detailLimited
          ? " At least one date reached Google’s detailed-result limit."
          : ""}
      </p>
      <details
        className="report-panel report-connection"
        open={!connected || Boolean(status.connection?.lastError)}
      >
        <summary>
          <span>
            <ShieldCheck size={22} aria-hidden="true" />
            <span>
              <strong>Google connection & update history</strong>
              <small>
                {connected
                  ? status.connection?.propertyUri
                  : "Connect Google to see how people find your website"}
              </small>
            </span>
          </span>
          <ChevronDown size={20} aria-hidden="true" />
        </summary>
        <div className="report-connection-body">
          <div className="report-connection-top">
            <div>
              <h2>
                {needsReconnect
                  ? "Google needs permission again"
                  : connected
                    ? "Your Google connection"
                    : "Connect your Google account"}
              </h2>
              <p>
                Use the Google account you used to verify ownership of the{" "}
                <strong>tailoredagents.com Domain property</strong>. This
                connection can read search reports; it cannot change your website.
              </p>
              <p>
                Initial history: 90 completed days. The first scheduled check
                after 10:17 UTC requests each daily refresh.
              </p>
            </div>
            {status.canManage && (
              <div className="report-actions">
                {status.configured ? (
                  <a
                    className="report-button report-primary"
                    href="/api/integrations/search-console/connect"
                  >
                    {connected ? "Reconnect Google" : "Connect Google"}
                  </a>
                ) : (
                  <span className="report-pill">Setup required</span>
                )}
                {connected && (
                  <button
                    className="report-button"
                    onClick={() => setConfirmDisconnect(true)}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            )}
          </div>
          {!status.configured && (
            <div className="report-warning">
              <strong>Review setup with your website administrator.</strong>
              <p>
                Check the Google client settings and the primary website
                address. Callback: <code>{status.redirectUri}</code>
              </p>
              <p>
                Missing or inconsistent settings: {status.missing.join(", ")}.
              </p>
            </div>
          )}
          {status.connection?.lastError && (
            <p className="report-warning">
              {needsReconnect
                ? "Reconnect Google to continue."
                : status.connection.lastError === "google_rate_limit"
                  ? "Google has asked us to wait. The import will retry after a delay."
                  : "The update was interrupted. Retry the update; if it fails again, review the setup."}{" "}
              {!active && !needsReconnect && status.canManage && (
                <button disabled={busy} onClick={() => action("sync")}>
                  Retry update
                </button>
              )}
            </p>
          )}
          {active && (
            <div className="report-progress" role="status">
              <strong>
                {active.completed} of {active.total} days checked
              </strong>
              <progress
                aria-label="Import days checked"
                value={active.completed}
                max={active.total || 1}
              />
              <p>
                {active.status === "retry_wait"
                  ? "Waiting before retrying."
                  : "Your import is saved and continues in the background."}{" "}
                You can close this page.
              </p>
            </div>
          )}
          {status.runs.some((run) => run.historyLimited) && (
            <p className="report-warning">
              Some gaps are older than Google’s available history. They cannot
              be recovered from Google and are not treated as completed dates.
            </p>
          )}
          <dl className="report-health">
            <div>
              <dt>Worker last checked in</dt>
              <dd>
                <LocalTime value={status.worker.lastCheck} />
                {status.worker.stale && <strong> · Needs attention</strong>}
              </dd>
            </div>
            <div>
              <dt>Last completed import</dt>
              <dd>
                <LocalTime
                  value={status.connection?.lastSuccessfulSyncAt ?? null}
                />
              </dd>
            </div>
            <div>
              <dt>Retention maintenance</dt>
              <dd>
                <LocalTime value={status.retention.lastCheck} />
                {status.retention.stale && <strong> · Needs attention</strong>}
              </dd>
            </div>
            <div>
              <dt>Inquiry attribution</dt>
              <dd>
                {status.pendingAttribution ? (
                  `${status.pendingAttribution} saved inquiries waiting for attribution`
                ) : (
                  <>
                    <Check size={16} aria-hidden="true" />
                    Up to date
                  </>
                )}
              </dd>
            </div>
          </dl>
          <h3>Recent updates</h3>
          <ul className="report-history">
            {status.runs.length ? (
              status.runs.map((run) => (
                <li key={run.id}>
                  <span>
                    <strong>{run.status.replace("_", " ")}</strong> ·{" "}
                    {run.completed} / {run.total} days ·{" "}
                    {run.trigger === "scheduled"
                      ? "Automatic"
                      : run.trigger === "oauth"
                        ? "Initial connection"
                        : "Manual refresh"}
                  </span>
                  <LocalTime value={run.startedAt} />
                </li>
              ))
            ) : (
              <li>No imports have been requested yet.</li>
            )}
          </ul>
          {confirmDisconnect && (
            <div className="report-confirm" role="alert">
              <h3>Disconnect Google?</h3>
              <p>
                This stops pending imports and removes the saved Google
                credentials. Your saved reports will remain available.
              </p>
              <button
                className="report-button"
                onClick={() => setConfirmDisconnect(false)}
              >
                Keep connected
              </button>
              <button
                className="report-button report-danger"
                disabled={busy}
                onClick={() => action("disconnect")}
              >
                Yes, disconnect Google
              </button>
            </div>
          )}
        </div>
      </details>
      <footer className="report-footer">
        Reports for Tailored Agents · Private to your team · Update times shown
        in your local timezone
      </footer>
    </main>
  );
}
