import Link from "next/link";
import { OperationForm } from "@/components/dashboard/operation-form";
import { retryMetaImportsAction, retryMetaConversionsAction } from "@/lib/meta/actions";
import { getMetaStatus } from "@/lib/meta/service";
import type { getMetaConversionStatus } from "@/lib/meta/conversions";

export function MetaSettingsPanel({
  state,
  conversions,
  admin,
}: {
  state: Awaited<ReturnType<typeof getMetaStatus>>;
  conversions: Awaited<ReturnType<typeof getMetaConversionStatus>>;
  admin: boolean;
}) {
  const pixel =
    process.env.NEXT_PUBLIC_META_PIXEL_ENABLED === "true" &&
    /^\d{5,30}$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID || "");
  const imported =
    state?.counts.find((row) => row.status === "imported")?.count || 0;
  const failed =
    state?.counts.find((row) => row.status === "failed")?.count || 0;
  const pending =
    state?.counts
      .filter((row) => row.status === "pending" || row.status === "working")
      .reduce((sum, row) => sum + row.count, 0) || 0;
  const count = (status: string) => conversions?.counts.find(row => row.state === status)?.count || 0;
  return (
    <section
      className="dashboard-panel dashboard-detail-card"
      id="meta"
      aria-label="Facebook and Instagram connection"
    >
      <div className="dashboard-panel-heading">
        <div>
          <span>Lead acquisition</span>
          <h2>Facebook & Instagram</h2>
        </div>
        <Link href="/dashboard/leads?source=facebook">View Meta leads</Link>
      </div>
      <dl className="dashboard-detail-list">
        <div>
          <dt>Website Pixel</dt>
          <dd>
            {pixel ? "Configured — verify in Meta Test Events" : "Setup needed"}
          </dd>
        </div>
        <div>
          <dt>Instant Forms</dt>
          <dd>
            {!state
              ? "Status unavailable"
              : !state.configured
                ? "Setup needed"
                : !state.enabled
                  ? "Importing paused"
                  : state.needsAttention
                    ? "Needs attention"
                    : imported
                      ? "Receiving leads"
                      : "Configured — waiting for a test lead"}
          </dd>
        </div>
        {state?.pageId && (
          <div>
            <dt>Connected Page ID</dt>
            <dd>{state.pageId}</dd>
          </div>
        )}
        <div>
          <dt>Imported / queued / needs attention</dt>
          <dd>
            {imported} / {pending} / {failed}
          </dd>
        </div>
        <div>
          <dt>Lead quality reporting</dt>
          <dd>{!conversions ? "Status unavailable" : conversions.mode === "paused" ? "Paused — setup needed" : !conversions.ready ? "Setup incomplete" : conversions.mode === "test" ? "Testing — verify in Meta Test Events" : "Live — verify sales funnel in Meta"}</dd>
        </div>
        {conversions?.datasetId && <div><dt>Conversions dataset ID</dt><dd>{conversions.datasetId}</dd></div>}
        <div>
          <dt>Conversions accepted / tested / queued / needs attention / expired</dt>
          <dd>{count("accepted")} / {count("tested")} / {count("pending") + count("working")} / {count("failed")} / {count("expired")}</dd>
        </div>
      </dl>
      <div className="dashboard-long-copy">
        <p>For Facebook and Instagram Instant Form leads, changing status reports the new stage to Meta once reporting is enabled. Qualified, Proposal and Won are your positive stages. Mark a lead Qualified after speaking with them and confirming a fit; you can also move straight to Proposal or Won.</p>
        <p>Meta must verify the connection and sales funnel before you switch the campaign to maximize qualified leads. Accepted deliveries do not guarantee campaign eligibility. Events older than seven days expire.</p>
        {!!conversions?.problems.length && <p>Conversion delivery needs attention: {conversions.problems.map(problem => `${problem.code} (${problem.count})`).join(", ")}. An administrator can check the connection in Meta Events Manager. Delivery retries keep the original event to prevent duplicates.</p>}
        {admin && conversions?.ready && count("failed") > 0 && <OperationForm action={retryMetaConversionsAction} submitLabel="Retry failed conversions"><p>Retry corrected connection errors within 24 hours of the first attempt. Older failures remain visible for review.</p></OperationForm>}
        <p>
          New Instant Form submissions appear in Leads with the submitted
          answers and available ad details. Assign an owner and follow up from
          the CRM. Website inquiries continue to arrive through the existing
          forms.
        </p>
        {state?.needsAttention && (
          <p>
            Some leads could not be imported. Their notifications are saved for
            recovery. Check the Meta connection and submitted-data handling.
            Queued imports retry automatically; stopped imports can be retried below.
          </p>
        )}
        {admin && failed > 0 && (
          <OperationForm
            action={retryMetaImportsAction}
            submitLabel="Retry failed imports"
          >
            <p>
              Retries use the original Facebook lead ID to avoid duplicates.
            </p>
          </OperationForm>
        )}
        <p>
          An administrator can finish setup in Meta Events Manager and the
          website hosting settings.
        </p>
      </div>
    </section>
  );
}
