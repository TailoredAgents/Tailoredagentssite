# CRM lead quality feedback to Meta

Austin chose status-based qualification on October 28, 2026: Qualified means the team spoke with the prospect and confirmed a fit. Moving directly from New to Proposal or Won also indicates a positive outcome. Status changes from the Leads dropdown, lead detail, or linked sales conversion are captured in the same database transaction.

Implementation is **paused by default**. Local tests establish queue and transport behavior, not live Meta acceptance or campaign eligibility. Finish the test and funnel steps below before switching the campaign objective.

## Stage mapping

| CRM status | Meta event | Funnel meaning |
| --- | --- | --- |
| New | `NewLead` | Initial CRM intake |
| Qualified | `QualifiedLead` | Earliest positive/optimization stage |
| Proposal | `Proposal` | Positive, after Qualified |
| Won | `Won` | Positive, after Proposal; not a paid purchase |
| Lost | `Lost` | Negative; exclude from positive funnel |
| Archived | `Archived` | Exclude from positive funnel |

Configure QualifiedLead → Proposal → Won in that order. Meta's funnel setup says selecting the earliest positive target includes later funnel stages in optimization. A lead that skips Qualified sends its actual Proposal or Won stage. We do not manufacture intermediate events. Returning to an earlier status creates a real new transition; re-saving an unchanged status creates none. Avoid toggling statuses merely to generate advertising signals.

This integration only reports Facebook/Instagram Instant Form leads that retain their original verified intake receipt and Meta lead ID. Website, manual and Apollo leads are not sent. The browser Pixel remains independent.

## Connect and verify

1. In Meta Events Manager, select the existing Tailored Agents dataset, **1785858192683666**, and its CRM/Conversions API setup. Verify asset ownership and the ad account connection. Preserve the existing Pixel and dataset. Generate a Conversions API access token for this dataset; the existing Page intake token is a separate credential.
2. Privately configure the **website Render service** with `META_CAPI_DATASET_ID=1785858192683666`, `META_CAPI_ACCESS_TOKEN` and `META_CAPI_MODE=test`. Set `META_CAPI_TEST_EVENT_CODE` to the code displayed in this dataset's Test Events tab. Keep the existing `META_PAGE_ID=539290305941060` and `META_GRAPH_API_VERSION=v26.0`. Tokens never belong in chat, the repository, client-side variables or the cron service.
3. Let the deployment apply migration `0036_meta_conversions.sql`. Create a test lead through Meta's Lead Ads Testing Tool for the connected Page/form. Confirm it imports into CRM, then change its status. The existing five-minute worker sends queued events; Settings → Facebook & Instagram shows tested, accepted, queued, failed and expired totals. Test mode can send other recent queued stages to Test Events too.
4. In Test Events verify the real Meta lead ID, `system_generated` action source, `crm` event source, original transition time and exact event names above. Confirm the test events are accepted. Check the dataset's diagnostics; a local test or HTTP acceptance alone does not verify matching or optimization readiness.
5. Set `META_CAPI_MODE=live` and clear `META_CAPI_TEST_EVENT_CODE`, then redeploy. Successfully tested events still within seven days are delivered to production with their original timestamps. Test event IDs have a `test:` prefix; live deliveries use the persistent UUID. Confirm production events and the CRM connection's verification state in Events Manager.
6. Configure the sales funnel using the table above: exclude Lost/Archived and choose QualifiedLead as the earliest target. Verify Meta includes Proposal and Won as later positive stages. Meta controls when data coverage and other account requirements permit conversion-leads optimization; receiving an event does not guarantee immediate eligibility. Only then switch the intended campaign/ad set to maximize qualified/conversion leads.

## Operation and recovery

- Capturing a status change does not depend on the Meta API being reachable. A transactional database trigger enqueues it, and the existing shared worker delivers it. No additional paid service is required.
- Payloads contain the original Meta lead ID, stage, event time, event ID and CRM source labels. No contact names, email addresses, phone numbers, notes or form answers are sent by this implementation.
- Each delivery keeps its event ID and time across retries. Timeouts, rate limits and transient errors retry with backoff; permanent errors stop for review. Attempts are bounded to 12 and 24 hours from the first attempt. A crashed final attempt is stopped after its lease expires.
- Owners/admins can retry corrected failures in Settings within that original 24-hour window. Retrying does not renew the event timestamp or delivery window. Check tokens/permissions in Events Manager for `meta_190` or related provider codes. Detailed provider messages are not stored because they can echo credentials or identifiers.
- Once attempted, an event is pinned to its dataset and delivery mode. Changing either will hold unfinished events to avoid ambiguous cross-dataset delivery; restore the original configuration to recover them. Successfully tested events can promote to live. A test request with an uncertain outcome must finish in test mode before promotion.
- All events older than seven days expire without fabricated dates. The migration backfills only recent initial intake events using their recorded import time; historical qualification dates are not invented. This means existing qualified leads do not automatically produce a historical qualified event.
- Queue metadata is removed after 90 days even while paused. Anonymizing or deleting a lead removes its conversion records. A request already in flight may finish; local deletion cannot retract an event already accepted by Meta.
- Set `META_CAPI_MODE=paused` to stop future delivery. Status capture continues, with the same seven-day expiry. Disabling Instant Form import is independent.

## Verification references

- Unit transport/config tests: `npx vitest run lib/meta/conversion-provider.test.ts`.
- Disposable database tests: set `TEST_META_CONVERSION_DATABASE_URL` to the dedicated `ta_meta_conversion_test` database on `127.0.0.1:55435`, then run `npx vitest run lib/meta/conversions.integration.test.ts`. Never point these destructive fixture tests at a shared or production database.
- [Meta: implementing CRM integration](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/crm-integration/3-implementing-the-crm-integration).
- [Meta: configure your sales funnel](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/crm-integration/5-configure-your-sales-funnel).
