# Billing evidence and read-only Stripe reconciliation

**November 15 recurring-ledger update:** [Recurring commissions](RECURRING_COMMISSIONS.md) now connects reviewed source evidence and pinned eligibility to original receipt windows, saved calculations, typed-recipient ledger differences and monthly statements. Posting stays disabled and requires separate customer/mode approval. This later checkpoint supersedes earlier references below to the recurring ledger being entirely unimplemented; historical release evidence remains intact.

November 15, 2026 source checkpoint. This implements the next preparation phase after [customer eligibility](CUSTOMER_ELIGIBILITY.md). Stripe connection remains Jeffrey's final activation responsibility. Import is disabled by default; no credentials, provider calls, customers, invoices, payments, signatures or payable entries were activated during development.

## Employee workflow

Open **Partners → Agreements, referral decisions & billing drafts → Collections & reconciliation**. Existing finance permissions apply independently of work focus, assistant scope and URL knowledge.

The list shows configured source identity/mode, imported invoices, the last completed invoice listing and pending/retrying/failed jobs. A completed listing means invoices were queued, not that every queued invoice has reconciled. **Request reconciliation** queues another full listing and retries failed imports; it makes no Stripe writes. It only runs when the independently configured worker is enabled.

An imported invoice's detail page preserves payment, balance-availability, fee, refund, credit-note and dispute evidence. Review the exact snapshot, explicitly map its Stripe customer to a CRM client, classify every source line and reconcile amounts after discounts with a separate tax allocation. Recurring lines need human-reviewed covered service dates. Subscription IDs and provider period timestamps are reference context; neither silently sets service dates or MRR. Mapping uses provider identity, never an email/name match. An existing conflicting mapping is blocked for reviewed correction rather than silently moved.

Choose the clearing requirement approved by the signed terms: **available processor funds**, or **available processor funds plus bank evidence**. The latter is the UI default. Bank dates/references must identify an actual imported charge and an actual past/present clearing date. This records human reconciliation; the application does not log into a bank, equate a payout notification with bank settlement or interpret private contract text. Fees are reported separately and do not reduce the gross recurring basis.

The preview allocates eligible net receipts proportionally across the reviewed lines, excludes nonrecurring amounts, defers future full service months, and uses the existing full-calendar-month/month-end convention. It reads pinned agreement rates and reviewed eligibility periods, including historical periods after offboarding. It never creates ledger entries. A source update makes an older review stale; a fresh review is required before another calculation.

## Supported evidence and explicit holds

- Separate successful captured charge, pending/available processor balance and human bank evidence. Pending receipts remain pending rather than becoming income merely because an invoice says paid.
- Partial invoice payments and multiple distinct processor charges on one invoice. Stable charge and invoice-payment identities prevent duplicate events from duplicating cash.
- Successful partial/full refunds preserve the original invoice/receipt snapshot. A single credit-note refund link is recognized only when its amounts match exactly; the same cash refund is never deducted twice.
- USD, positive finalized invoices, up to 50 reviewed allocation rows, and complete bounded source pagination. Other currencies, zero/negative/draft invoices, incomplete source identities and malformed totals need review.
- Shared/split charge allocations across invoice payments, out-of-band/payment-record credits, unmatched/partial credit-note refund mappings, pending refunds and all dispute/recovery states remain held. This release does not automatically decide chargeback/refund overlap or release recovered dispute funds. These require the later explicit adjustment workflow.
- Partial service months, missing reviewed eligibility, manager coverage changes, changed referral decisions, open eligibility reviews and incomplete histories hold the commission preview. Sources older than a day and relevant queued/failed imports also block calculation.
- Fixed customer windows remain held until the next recurring-ledger phase records and validates the original qualifying receipt anchor. No renewal, expansion, new invoice or fully reversed initial receipt automatically starts a new clock. Conversion deadlines, historical backfill and anchor corrections remain explicit approval gates.

Observed gross/net values can still appear alongside holds; they are evidence totals, not approved earnings or bank balances. Sandbox evidence is clearly labeled and cannot post commissions. New-program posting is absent in both modes; the legacy manual ledger is unchanged.

## Import, recovery and storage

[Migration 0071](../db/migrations/0071_billing_reconciliation.sql) adds scoped merchant/mode connections, minimal event receipts, leased jobs, versioned normalized invoices, stable charge/payment links, explicit customer mapping and finance reviews. No rates or rights are seeded. Database triggers reject updates/deletes to source snapshots and review contents; a new version records changed facts. Reviewer anonymization can clear its actor reference without changing financial content. Preserve source evidence during rollback or retention work; client/workspace deletion can correctly be blocked by financial references.

[The reader](../lib/billing/stripe.ts) makes only GET requests to fixed `https://api.stripe.com/v1/` resources, disables redirects, pins API version **2026-10-28.endive**, bounds response sizes/pages/requests and separates account/mode/workspace identity. It whitelists financial fields; payment-method details, customer contact/address data and arbitrary provider metadata are not persisted in snapshots. Tokens never enter the database or job error messages. [Stripe documents API version pinning](https://docs.stripe.com/api/versioning).

The [webhook](../app/api/integrations/stripe/events/route.ts) verifies the raw body's HMAC, a five-minute timestamp tolerance and configured mode/version before durably recording a scoped event identity and queuing work. It stores minimal IDs/type/hash, not an entire customer-bearing event body. Repeated event IDs are acknowledged without another job request. Events are hints: workers retrieve current canonical objects, so old event delivery cannot roll back newer payment facts. Snapshot events on the configured company account are supported; thin/Connect destinations are not configured by this release. [Stripe webhook delivery and security guidance](https://docs.stripe.com/webhooks).

[The worker](../lib/billing/reconciliation.ts) uses database leases and tokens checked again before committing source facts. An expired worker cannot overwrite a later worker's result. Interrupted invoice listings retain cursors; events arriving while a job runs cause another pass. Transient errors back off; five failed attempts leave visible failed work for finance recovery. A daily full listing is scheduled by the running worker independently of webhooks, including older invoices that may have changed. Nested lists are fully read or the import fails visibly—never silently truncated.

Run `npm run billing:worker` in a separately scheduled server process after configuration. One invocation is bounded to 50 steps and approximately 210 seconds, with per-invoice work bounded by a 100-second source deadline and a 150-second database lease. A later invocation resumes remaining work. Schedule every five minutes during provider acceptance; the command itself checks for the daily full-listing requirement. No new Render worker was deployed or scheduled in this checkpoint.

## Future connection configuration — not an instruction to activate now

The exact server-only names are listed in [.env.example](../.env.example):

| Name | Purpose |
| --- | --- |
| `BILLING_STRIPE_IMPORT_ENABLED` | Default `false`; the explicit import/webhook/worker switch |
| `BILLING_STRIPE_MODE` | `test` or `live`; matches restricted-key prefix and object/event mode |
| `BILLING_STRIPE_ACCOUNT_ID` | Expected company merchant `acct_…`, checked through the API |
| `BILLING_STRIPE_WORKSPACE_ID` | Exact active CRM workspace UUID; account/mode binding cannot move silently |
| `BILLING_STRIPE_READ_KEY` | Restricted `rk_test_…` or `rk_live_…` key; never a publishable key or a provider-write credential |
| `BILLING_STRIPE_WEBHOOK_SECRET` | The selected endpoint's `whsec_…` signing secret |

The reader needs access to `GET /v1/account`, invoices and their lines, invoice payments, payment intents, charges, balance transactions, refunds, disputes and credit notes. Jeffrey must verify the corresponding restricted-read permissions in the actual account during sandbox acceptance; no endpoint requires create/update/delete permission. Restricted-key dashboard labels and successful provider authorization have not yet been observed.

After the remaining implementation gates pass, initialize the account binding by running the configured worker, then register the snapshot endpoint `/api/integrations/stripe/events` on the existing website host, with the pinned version. Use the company account, not connected accounts. Recommended events are `invoice.finalized`, `invoice.updated`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.voided`, `charge.succeeded`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `refund.created`, `refund.updated`, `refund.failed`, `credit_note.created`, `credit_note.updated`, `credit_note.voided`, `balance.available`, and `payout.paid`/`payout.failed`. Refund/credit/dispute/balance/payout events request a full rescan. Payout events do not mark bank clearing. Keep webhook and worker configuration consistent.

The versioned invoice-payment resource connects invoice allocations to actual PaymentIntents/charges; paid invoices can also carry payment records outside Stripe. Balance evidence separates gross, fee, net and availability. [Invoice payments](https://docs.stripe.com/api/invoice-payment/object), [balance transactions](https://docs.stripe.com/api/balance_transactions/object). Current credit-note refund-link fields were checked against [Stripe's official OpenAPI schema](https://github.com/stripe/openapi/blob/master/openapi/spec3.json).

## Local checks and later provider acceptance

All development checks use synthetic data and an isolated loopback PostgreSQL database. Reader tests inject mocked Stripe responses; these are **not Stripe sandbox or live acceptance**. No new credentials/account were needed. Current test/build/browser results are recorded in [commercial preparation](COMMERCIAL_PREPARATION.md).

Local verification commands, with the environment pointing only to the designated test databases:

```text
npx vitest run lib/billing/service.integration.test.ts lib/billing/allocation.test.ts lib/billing/stripe.test.ts
npx vitest run lib/commercial/service.integration.test.ts lib/commercial/calculation.test.ts lib/relationships/operating-model.integration.test.ts --no-file-parallelism
npx playwright test tests/reporting/commercial.spec.ts --config playwright.config.ts
```

Do not run database suites concurrently against the same fixture database. The integration suite requires `OPERATING_TEST_DATABASE_URL` on loopback with database `ta_operating_test`; browser fixtures require the separately named `ta_reporting_browser_test`. Fixture resetters must never target production.

Jeffrey's later sandbox procedure must verify actual restricted permissions, merchant/mode isolation, an ordinary captured payment, pending/failed bank payment, mixed and partial invoices, prepaid dates, refund with linked credit, all held dispute/split/out-of-band cases, duplicate/out-of-order events, page boundaries, an interrupted worker and reconnect/replay. Reconcile exact cents and record any intentionally held cases before a live read-only pilot. Creating sandbox financial objects or sending any live invoice remains a separate authorized action.

Rollback: disable `BILLING_STRIPE_IMPORT_ENABLED`, stop the scheduled worker and disable the matching webhook delivery. Preserve all tables, snapshots, jobs, maps and reviews. After repair, restore the same merchant/mode/workspace binding and request reconciliation; source versions and charge/payment identities must remain unchanged. There is no payout or posting switch to reverse in this release.

Next work: original receipt anchors and reviewed exceptions, durable versioned recurring allocations/adjustments, compatible internal-recipient ledger and statements. Manual out-of-band verification, historical mapping correction, full subscription/MRR reporting and automated bank reconciliation are not silently covered by this first reader. Jeffrey's actual provider connection remains last, as described in [his handoff](JEFFREY_STRIPE_SETUP.md).
