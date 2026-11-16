# Reviewed invoice actions and recurring setup

November 16, 2026 engineering checkpoint. Migrations 0075 and 0076 add durable provider-action receipts. This extends [draft exports](STRIPE_DRAFT_EXPORTS.md); all provider write switches remain **off**. No Stripe account, actual invoice, subscription, charge or customer notification was used in these local checks. Financial exception implementation and provider acceptance remain separate gates in [Jeffrey’s handoff](JEFFREY_STRIPE_SETUP.md).

## Customer identity before the first invoice

The original mapping path required an imported invoice. Finance can now link a new customer before billing: `preview_stripe_customer_mapping` resolves the CRM identity and the existing Stripe customer using the restricted **read** key; `map_stripe_customer` requires its fingerprint, evidence and exact human approval. It rechecks both identities and blocks conflicting mappings. It does not create Stripe customers, guess matches from names/emails, or fabricate a payment. Initialize the configured connection with the read-only worker first. The customer can be created manually in the correct Stripe sandbox/account by an authorized operator.

## One-off invoice workflow

1. Prepare and finance-review the latest local invoice, then use the existing reviewed draft export.
2. Call `preview_stripe_invoice_action` with the export ID and `operation: issue`. The preview resolves the current provider invoice, customer, amounts, service periods, due date and presentation. It returns a fingerprint; use it to propose `perform_stripe_invoice_action`.
3. Human approval rechecks the exact review, current finance access, local revision and customer mapping. Execution claims a durable receipt, rechecks provider terms immediately before the POST and finalizes with `auto_advance=false`.
4. Sending is a **second preview and human approval**, with `operation: send`. It requires a confirmed issue receipt and an unchanged, open, unpaid invoice. The send action requests one Stripe invoice email; it does not request a payment-method charge.
5. Read `get_stripe_draft_export`. Its `actions` distinguish confirmed provider acceptance from uncertain outcomes. Finance document pages show the same receipts; local document status is not proof of issue, delivery, payment or commission eligibility.

Both issue/send and recurring tools require `operations:write`, `conversations:send`, current finance-management access and human approval, even when the employee has direct actions enabled. Existing local draft creation and identity linking require finance management and operations write access but no send scope. An uncertain provider result becomes `outcome_unknown` in Assistant, rather than a success banner.

The supported one-off path is a positive USD manually collected invoice of at least 50 cents from our verified export. It holds changed or superseded local versions, expired due dates, wrong account/mode/customer, nonzero customer credit/cash balances, unexpected adjustments/discounts/tax settings, shipping, application fees, transfers and incomplete or changed lines. Explicit reviewed invoice amounts do not calculate tax. Source line classification and periods must still pass collection review before commissions.

The provider can be edited outside this application between reads and writes; Stripe does not supply an atomic compare-and-finalize primitive in this path. Restrict concurrent operator edits during approval and check the resulting receipt. The post-write verification detects mismatches but cannot recall an already accepted finalization/email.

## Recurring invoice commitment

`preview_stripe_recurring` requires the latest **executed customer-service agreement**, its revision, a verified customer mapping, an existing Stripe price, quantity, recipient, start, term, due interval and private authorization/tax-review references. It shows the signed source and exact provider terms; `create_stripe_recurring_schedule` requires the returned fingerprint and mandatory human approval. The employee must confirm that the executed agreement actually authorizes these terms; the system does not interpret signatures or legal text.

The first supported schedule is deliberately bounded:

- One active monthly, licensed, fixed-unit USD price; quantity 1–1,000, price at least 50 cents and monthly total at most the existing invoice-money limit. No metered, tiered, transformed, trial or usage-priced plan.
- A future start at least 24 hours and at most two years away. UTC day 1–28 avoids month-end ambiguity. One to 24 monthly periods, an explicit end, cancellation at that end and no prorations. UTC anchors can shift local clock time around daylight saving.
- Manual invoice collection (`send_invoice`), a reviewed 1–90 day payment deadline, no inherited discounts or tax rates and automatic tax disabled. The price must be marked inclusive or the Stripe customer marked tax-exempt. These settings do **not** establish tax correctness: finance must approve the treatment and ensure imported tax exclusions reconcile before any commission posting. Tax calculation, filing and tax advice are not supplied by this adapter.
- No pending items, open/uncollectible invoices or nonterminal subscriptions/schedules. Lists are bounded at 100; incomplete histories are held rather than silently ignored. No replacement, upgrade, cancellation, proration or renewal mutation is exposed in chat in this release.
- One durable setup per customer and configured connection. Even a new agreement cannot bypass an existing or uncertain setup. Later renewals/replacements need a reviewed reconciliation workflow; do not delete receipts to unlock them.

**Approval authorizes future invoice generation and possible email delivery by Stripe throughout the term.** It does not configure automatic card charging. Future payments, notification settings and changes must be monitored in Stripe. The setup receipt is an observation at creation, not a live subscription-status monitor. Cancellation and correction currently happen through an authorized operator in Stripe, preserving our receipt and recording evidence privately.

## Failure handling and rollback

Invoice actions claim one row per export/operation before network I/O. Recurring setup claims one customer operation and records the schedule ID before final verification. Stable per-operation idempotency keys supplement permanent local duplicate protection. Exact request/review data and completed receipts are immutable; no background retry is scheduled.

`running` after a terminated process and `needs_review` both mean the request may have completed. Inspect the correct account/mode, known provider ID, request/idempotency metadata and actual Stripe object. Do not retry using a new request, invoice family or agreement. Automatic adoption and replacement of uncertain operations are not implemented. A schedule with an uncertain result may still start billing later: inspect it immediately and cancel/correct it in Stripe when appropriate.

Disable the individual action flags to stop new requests. Preserve all records and leave read-only import available for reconciliation. **Disabling our flags does not cancel an existing Stripe schedule or recall in-flight emails.** Do not roll back by deleting ledger, action or schedule history. If recurring activation is withdrawn, an authorized operator must separately review/cancel the affected schedules in Stripe.

## Configuration and sandbox acceptance

Retain the existing configured workspace, account, mode, pinned `2026-10-28.endive` version, read key and separate restricted write key. Add these independent default-off gates:

| Variable | Capability |
| --- | --- |
| `BILLING_STRIPE_DRAFT_WRITES_ENABLED` | Existing prerequisite for all provider writes |
| `BILLING_STRIPE_INVOICE_ISSUE_ENABLED` | Exact reviewed finalization |
| `BILLING_STRIPE_INVOICE_SEND_ENABLED` | Separately reviewed invoice email request |
| `BILLING_STRIPE_RECURRING_ENABLED` | Exact reviewed finite recurring schedule |

The read key additionally needs customer GET access for initial mapping. The write adapter reads account, customer, cash balance, invoices/lines, prices/products, subscriptions, schedules and pending invoice items as applicable. Its POST endpoints are existing invoices/invoiceitems, invoice `finalize`/`send`, and `subscription_schedules` creation. No pay, charge, refund, transfer or payout endpoint is exposed. Stripe permission categories can group operations; Jeffrey must verify the narrowest actual restricted-key grants in the sandbox. A broad key is not a substitute for disabled feature gates.

After connection is authorized, use synthetic sandbox customers and test prices only. Record each exact account/mode, deployment commit, migration set, action ID, provider ID and observed outcome in private evidence:

| Exercise | Required outcome |
| --- | --- |
| New customer with no invoices | Read-key identity preview and reviewed mapping work; no fabricated payment or provider write |
| Draft → issue → send | Separate approvals and receipts; exact recipient, lines, totals, periods and dates preserved; auto advancement remains false |
| Changed invoice/customer/price/agreement | Approval fails before mutation; fresh review required |
| Wrong mode/account, missing permissions, revoked finance/send grant, disabled gate | No provider mutation |
| Duplicate/concurrent approval and timeout after POST | One operation; uncertain outcome visible; no automatic resend/recreation |
| Recurring start/end and invoice behavior | One finite manual-collection schedule, correct price/quantity/deadlines; no auto-charge; observed first/final cycle and cancellation match review |
| Extra pending item, credit balance, discount, open invoice, existing subscription or incomplete list | Held for reconciliation |
| Rollback with an existing schedule | App flags stop new actions; separately verified Stripe cancellation stops future billing |

Stripe suppresses actual invoice email delivery in test mode, even when its send endpoint accepts the request. Sandbox acceptance cannot establish live deliverability. An actual send test needs a separately authorized recipient/content after live approval. See [Stripe send behavior](https://docs.stripe.com/api/invoices/send), [finalization](https://docs.stripe.com/api/invoices/finalize), [schedule creation](https://docs.stripe.com/api/subscription_schedules/create), [schedule cancellation](https://docs.stripe.com/api/subscription_schedules/cancel), [cash balances](https://docs.stripe.com/api/cash_balance/retrieve) and [official schedule parameter definitions](https://github.com/stripe/stripe-go/blob/master/subscriptionschedule.go).

## Local evidence

Local tests use isolated PostgreSQL, synthetic agreements and mocked provider responses. They cover finance/tenant checks, stale reviews, mandatory approval, send consent, customer bootstrap, immutable receipts, concurrency/replay, partial results, finite recurring terms and changed provider objects. Final counts and browser evidence are recorded in the handoff checkpoint after verification. No local test establishes actual Stripe authorization, account configuration, future billing cycles or email delivery.


Local verification for this checkpoint: 65 billing adapter/database cases passed across the final targeted runs, including three additional malformed-evidence cases; 45 Assistant OAuth/execution/security cases passed, with the 40-case integration suite repeated after adding customer mapping. Another 53 commercial/recurring-ledger/import regression cases passed. Twelve browser journeys passed initially; a missing execution-evidence value in the new synthetic browser fixture was corrected, then all four issue/recurring receipt journeys passed on desktop/phone, completing 14 distinct commercial journeys. Build, TypeScript and lint passed. Phone receipts were visually inspected with no horizontal overflow. No real provider or production acceptance is claimed.
