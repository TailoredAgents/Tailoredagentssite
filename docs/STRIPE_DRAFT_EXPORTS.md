# Reviewed Stripe draft exports

**Later November 16 update:** [Reviewed issue/send and recurring setup](STRIPE_INVOICE_ACTIONS.md) now implements the next provider-action steps, separately gated and disabled. The checkpoint below describes draft creation only; its original pending issue/send references are superseded by that runbook.

November 16, 2026 source checkpoint, migration 0074. **Disabled by default; no provider account was connected or exercised.** This is the draft-creation step. Invoice finalization/sending, subscriptions and the remaining financial exception workflows are still pending.

## Workflow

1. Finance prepares a local invoice and records review of its exact latest version. The existing read-only reconciliation connection must already have a finance-reviewed Stripe customer mapping for that client.
2. An employee with finance-management authority asks the Assistant to `create_stripe_invoice_draft`, supplying the document ID, current revision and mapped customer ID. The tool always requires exact human approval, including on direct-action connections.
3. The review resolves the configured account/mode, verifies the provider customer’s current identity/email, and displays the exact invoice, lines, service dates, recipient, due date and total. Current source, role and mapping are rechecked before execution. Recipient mismatch, newer versions, changed revisions and disabled configuration block the operation.
4. Execution durably claims one operation per invoice family and connection before contacting Stripe. It explicitly creates a draft with `auto_advance=false`, `collection_method=send_invoice`, automatic tax disabled, no inherited discounts/default tax rates, and pending invoice items excluded. Individual invoice items are attached only to the newly created invoice. Classified amounts are explicit reviewed amounts; this does not calculate tax.
5. The provider invoice ID is saved before item creation. Each POST has its own stable operation-derived idempotency key. Final verification checks mode, customer, draft state, collection settings, recipient, total and complete line descriptions/amounts/unique indices.
6. Finance document pages show the operation and known provider invoice ID. `get_stripe_draft_export` exposes the same finance-authorized receipt. `ready` means a draft was verified at completion; it does not promise that nobody edited it afterward. It does not mean issued, sent, paid or commission-eligible.

## Interrupted operations

A rejected request, timeout, malformed response, partial item creation or failed final verification leaves **needs review** with any known invoice ID. A terminated process can leave **running**; if no process remains active, treat it as unknown. Repeated approvals return the same operation, never a new invoice. No autonomous retry, deletion or recreation is performed, including after Stripe’s idempotency-retention window.

Inspect the exact Stripe account/mode, operation metadata and recorded invoice ID. Reconcile incomplete drafts with an authorized operator. Do not make a new local invoice family to evade the hold. Automatic adoption/recovery and supported replacement exports are not implemented in this checkpoint. These holds must be resolved before the affected cohort is activated. Operations never finalize, email, charge, refund, subscribe or change commission eligibility.

## Jeffrey’s later sandbox configuration

- Keep `BILLING_STRIPE_DRAFT_WRITES_ENABLED=false` until the review below is approved.
- Use a separate server-only `BILLING_STRIPE_WRITE_KEY`, a restricted `rk_test_...` key initially. Keep the existing read key separate. Mode, workspace and account reuse `BILLING_STRIPE_MODE`, `BILLING_STRIPE_WORKSPACE_ID`, `BILLING_STRIPE_ACCOUNT_ID`.
- Pin API version `2026-10-28.endive`. Required resources: read account/customer/invoice/invoice lines; create invoices and invoice items. Verify actual restricted-key permission groupings in the sandbox. Do not grant unrelated payment/refund/subscription permissions for this step.
- Apply 0074 and deploy the matching source before enabling the flag. No new worker or recurring paid job is needed. Each adapter instance has an 80-second overall network deadline and 15-second individual request deadlines.
- Use an approved sandbox customer whose email matches the local reviewed invoice. Check mixed classifications, service periods, excluded pending items/default discounts/taxes, exact totals, wrong account/mode, permission revocation, repeated/concurrent approval, incomplete writes and process termination. Confirm no email, finalization or charge occurs.
- Live activation remains separate after sandbox evidence and a finance-approved pilot. Turn the draft-write switch off to stop new proposals/executions. Preserve operation rows, source versions and provider IDs; pausing cannot recall an already in-flight request.

Implementation references checked November 16: [Stripe invoice creation](https://docs.stripe.com/api/invoices/create), [idempotency behavior and retention](https://docs.stripe.com/api/idempotent_requests), and [Stripe’s invoice-item SDK definitions](https://github.com/stripe/stripe-go/blob/master/invoiceitem.go). Sandbox acceptance must verify these assumptions against the actual configured account.

Local validation: 25 billing/adapter/database cases and 42 Assistant OAuth/execution/security cases passed with synthetic provider responses. Production build and lint pass. Browser acceptance and observed deployment are recorded separately; no real provider write, customer email or charge was made.

Browser evidence: all 12 desktop/phone commercial journeys passed, including the interrupted-export receipt. Screenshots exposed a long account-ID wrap issue on phones; the receipt now explicitly wraps identifiers. These local checks do not establish live provider acceptance.
