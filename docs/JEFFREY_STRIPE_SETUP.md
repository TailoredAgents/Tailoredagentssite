# Jeffrey — Stripe setup and connection handoff

Prepared November 15; updated November 16, 2026. **Status: ready for Jeffrey’s staged account setup and sandbox connection for the supported pilot. Live billing remains disabled pending acceptance.** Austin requested that implementation happen first and that Jeffrey own Stripe account setup and connection as the final activation step.

The [commercial preparation release](COMMERCIAL_PREPARATION.md) supports private agreement versions, referral decisions, assignment history, project budgets and invoice drafts. The later [billing reconciliation checkpoint](BILLING_RECONCILIATION.md) adds the read-only Stripe adapter, signed webhook queue, recoverable worker, source reviews and unposted receipt-based previews. Configuration names and the endpoint now exist, but import remains disabled and actual provider acceptance has not occurred. [Recurring window anchors, ledger posting and statements](RECURRING_COMMISSIONS.md) now have source implementation and local tests, with posting disabled. [Client-success workflows](CLIENT_SUCCESS.md) now have source implementation with operational activation gates. [Reviewed provider invoice and recurring actions](STRIPE_INVOICE_ACTIONS.md) are now implemented, disabled and locally tested. [Financial exception and settlement workflows](FINANCIAL_EXCEPTIONS.md) are implemented in migration 0077. Actual provider acceptance remains unverified; unsupported cases stay held and outside the pilot. Keep Stripe connection last; do not substitute a Meta or Mail endpoint.

## What Jeffrey owns next

1. Create or select the company-owned Stripe account and complete business identity, authorized representative, bank and account verification. Use the actual contracting legal entity from the reviewed agreements. Grant appropriate team access; do not share an individual's login or send credentials in chat.
2. Confirm the billing/payment methods and actual account pricing. Keep upfront implementation and recurring services separate; products/prices must match approved customer contracts. Do not create an extra marketplace/payout setup merely to collect company invoices.
3. Connect sandbox credentials first, through the website's private hosting environment. The completed adapter release must supply the exact environment names, merchant/workspace identity, pinned API version, least-privilege permissions, webhook events and endpoint below.
4. Run the supplied sandbox acceptance procedure: ordinary recurring payment, mixed invoice, partial payment, prepaid services, delayed/failed bank payment, refund/credit, dispute, duplicated/out-of-order webhook and reconnect/replay. Confirm client mapping and exact reconciliation; verify that invoices or drafts do not themselves create collected revenue.
5. Have the finance owner approve collection semantics, signed rule versions, customer-specific entitlements, opening balances and the pilot cohort. Resolve unmatched/unclassified items before enabling ledger posting.
6. Connect live credentials with the same account/mode checks and begin read-only reconciliation. Record the deployment version, merchant identity, successful synchronization and reviewed real evidence. Only then enable the agreed billing/posting capabilities separately.
7. For any real invoice, charge, customer notification or payout acceptance test, use an explicitly authorized customer/recipient, amount and content. A configuration check is not permission to make a test charge or transfer funds.

## Implementation inventory and activation prerequisites

| Gate | Current state |
| --- | --- |
| Private commercial preparation and manager history | Implemented locally in migration 0069; release verification in the runbook |
| Customer-specific role entitlements and eligibility intervals | Capture implemented in migration 0070: exact executed versions, customer/source identity, manager periods, work/leave and separate notice/cure reviews. [Limits and financial activation gates](CUSTOMER_ELIGIBILITY.md); receipt anchors and reviewed calculation consumption added in migration 0072, with live acceptance pending |
| Verified receipt, invoice-line and service-period model | Source snapshots, explicit mapping/classification, processor/bank evidence gates and unposted full-month previews implemented in migration 0071; approved-anchor capture and separately gated posting added in migration 0072; neither activated |
| Stripe adapter, signed webhook intake and recoverable reconciliation worker | Implemented and locally tested with synthetic responses; disabled, unscheduled and not provider-verified |
| Compatible recurring/internal-recipient ledger and reviewed statements | Implemented in migrations 0072 and 0077; posting disabled. Partial payments, paired offsets, reversals, delivery/dispute evidence and reviewed supported exceptions are implemented. Local synthetic acceptance only; unsupported cohorts remain held |
| Client-success task/calendar/notification workflows | Implemented in migration 0073 with local tests and the existing cron; disabled pending reviewed calendars, enrollment, employee opt-in and observed production acceptance. [Runbook](CLIENT_SUCCESS.md) |
| Reviewed assistant billing actions | [Local invoice proposals and recurring reads](ASSISTANT_BILLING.md) implemented and locally tested. [Provider draft creation](STRIPE_DRAFT_EXPORTS.md) implemented in 0074, disabled and awaiting sandbox acceptance. [Separately reviewed issue/send and finite monthly schedule creation](STRIPE_INVOICE_ACTIONS.md) implemented in 0075–0076, with customer identity mapping before the first invoice. Provider acceptance pending; all Stripe writes remain disabled |
| Exact account scopes, environment variables, API version, webhook URL/events and worker settings | Implemented names/GET resources and proposed schedule are in [the import runbook](BILLING_RECONCILIATION.md); actual restricted permissions and hosting schedule need sandbox acceptance |
| Sandbox fixtures, provider acceptance script and rollback procedure | Synthetic local tests and future provider checklist documented; no provider sandbox or live test has run |
| Approved private terms, signatures and live cohort | Business/finance confirmation required |

## Final connection block — implementation facts and pending acceptance

- Implementation migration set: apply all repository migrations through **0077**. Record the deployed commit from `git rev-parse HEAD` in private acceptance evidence.
- Website/worker service names and deployment version:
- Stripe account ID and workspace mapping:
- Sandbox/live mode separation:
- Required environment-variable names (names only; never values): `BILLING_STRIPE_IMPORT_ENABLED`, `BILLING_STRIPE_MODE`, `BILLING_STRIPE_ACCOUNT_ID`, `BILLING_STRIPE_WORKSPACE_ID`, `BILLING_STRIPE_READ_KEY`, `BILLING_STRIPE_WEBHOOK_SECRET`. Separate write gates/key: `BILLING_STRIPE_DRAFT_WRITES_ENABLED`, `BILLING_STRIPE_WRITE_KEY`, `BILLING_STRIPE_INVOICE_ISSUE_ENABLED`, `BILLING_STRIPE_INVOICE_SEND_ENABLED`, `BILLING_STRIPE_RECURRING_ENABLED`. Separate posting gate: `COMMISSION_LEDGER_POSTING_ENABLED` (keep false until private/provider acceptance and explicit customer approval).
- API version and restricted permissions: `2026-10-28.endive`; GET-only resources listed in the import runbook. Verify actual account permissions during sandbox acceptance.
- Webhook endpoint: `/api/integrations/stripe/events` on the existing website host, snapshot events on the company account; event list and secret location in the runbook.
- Reconciliation schedule: `npm run billing:worker`, proposed every five minutes, with durable page cursors and daily full listing. Deployment/scheduling is pending; source evidence older than one day is held.
- Exact sandbox test commands and expected results: local synthetic commands and provider acceptance matrix in the runbook. Actual provider acceptance remains pending.
- Rollback: disable `COMMISSION_LEDGER_POSTING_ENABLED` first; then disable `BILLING_STRIPE_IMPORT_ENABLED`, stop the scheduled worker/webhook, preserve all source/review/history tables and requeue after repair.
- Approved live pilot and finance sign-off:
- Observed provider acceptance date/result:

Keep private commercial rates, signed agreements, credentials, bank/tax data and customer financial exports out of this public repository. Use authorized private storage for the actual configuration and acceptance evidence. Jeffrey records deployment/account/acceptance values in authorized private evidence as each step is actually observed. Empty acceptance fields are not evidence of completion.

**November 16 draft-export checkpoint:** [Draft export runbook](STRIPE_DRAFT_EXPORTS.md) supplies the separate write switch/key, reviewed mapping prerequisites, duplicate protection, interrupted-operation handling and proposed sandbox checks. This does not make the overall handoff ready for final connection; the financial exception work and provider acceptance remain. Issue/send/finite recurring setup were implemented by the later checkpoint below.


## November 16 issue/send and recurring engineering checkpoint

The [current billing action runbook](STRIPE_INVOICE_ACTIONS.md) replaces the earlier pending issue/send/subscription items. It provides exact tool sequences, restricted resource requirements, default-off flags, sandbox exercises and rollback. Customer identity can now be reviewed before the first invoice, without a fake payment. Finalization and sending require separate approval; finite monthly schedules authorize future invoices explicitly. Automatic card charging, schedule upgrades/replacements/cancellation in chat, uncertain-operation adoption and automatic payouts are not implemented.

**Still required before the complete finance rollout:** documented dispute/recovery and unmatched credit exceptions, original-anchor correction, and statement credit-offset/partial-settlement workflows. Existing refund differences and immutable paid statements already work; unsupported cases remain held. These holds must not be bypassed by inventing evidence, changing identities or deleting history. Read [the ledger’s exact supported limits](RECURRING_COMMISSIONS.md).

Provider sandbox testing necessarily belongs to your connection stage; it cannot be truthfully marked passed before an account is connected. This checkpoint does not ask you to connect now or enable live billing. Keep all provider-write/posting flags false while engineering closes the remaining finance gaps. Actual signed policies, tax treatment and pilot-cohort approval also remain private business prerequisites.


Local verification for this checkpoint: 65 billing adapter/database cases passed across the final targeted runs, including three additional malformed-evidence cases; 45 Assistant OAuth/execution/security cases passed, with the 40-case integration suite repeated after adding customer mapping. Another 53 commercial/recurring-ledger/import regression cases passed. Twelve browser journeys passed initially; a missing execution-evidence value in the new synthetic browser fixture was corrected, then all four issue/recurring receipt journeys passed on desktop/phone, completing 14 distinct commercial journeys. Build, TypeScript and lint passed. Phone receipts were visually inspected with no horizontal overflow. No real provider or production acceptance is claimed.

## Current handoff — start here (November 16 financial exception checkpoint)

This section supersedes historical “not ready” checkpoint statements above. The planned core software preparation is complete for the explicitly supported pilot. Do not wait for another generic engineering phase before starting account setup. Provider-specific problems found during sandbox acceptance must still be fixed before live activation.

Give your Codex this instruction:

> Read AGENTS.md, docs/PROJECT_STATUS.md, docs/JEFFREY_STRIPE_SETUP.md, docs/BILLING_RECONCILIATION.md, docs/STRIPE_DRAFT_EXPORTS.md, docs/STRIPE_INVOICE_ACTIONS.md and docs/FINANCIAL_EXCEPTIONS.md. Inspect current main and the deployed migration/worker version. Help Jeffrey complete company-owned Stripe setup, restricted sandbox configuration and the documented acceptance matrix. Keep live billing, ledger posting and customer messaging disabled until their exact acceptance/approval gates pass. Preserve private terms outside the public repository. Record observed results, failures and remaining gates; do not claim an account connection or test from source code alone.

Order of work:

1. Pull current `main`, verify deployment, back up the database and apply migrations through 0077 through the established migration process. Confirm all independent activation switches are still off. Products must follow each actual signed scope for custom AI, automation or optional website services.
2. Jeffrey completes legal-entity/account/bank verification and obtains the private executed agreement/rule evidence. Account setup and actual customer obligations remain human responsibilities; repository test rates are never company defaults.
3. Configure the sandbox account/workspace/read key and webhook secret from the import runbook. Enable **sandbox import only**, initialize the account binding, register the signed snapshot webhook, and schedule `npm run billing:worker` every five minutes in hosting. Verify the worker completes its full scan and queue, not merely that the website deploys.
4. Run the import matrix and new exception checks: final lost/won dispute, bank recovery evidence, source-linked unpaid credit, multi-refund credit, changed review, and intentionally held open/mixed/out-of-band/split cases. Confirm all canonical nested reads are authorized. An unexpected hold is a reconciliation task, not a reason to weaken a guard.
5. Verify private agreements, customer mappings, prior history, service dates and approved original windows. Compare representative shadow results and a complete statement period cent-for-cent. Exercise partial payments, duplicate requests, paired offsets, reversals and specific dispute resolution using **synthetic test-mode records only**.
6. Separately authorize the sandbox write capabilities needed for the pilot: reviewed draft export, separate issue/send and finite monthly invoice schedules. Use the action runbooks, exact approved sandbox recipients and safe test payment methods. Inspect provider objects after each action, including timeout/retry behavior. Disable unused write flags.
7. Record private finance acceptance and the supported live cohort. Switch to the intended live account only after identity and permission checks; start live read-only import/reconciliation. Recheck mappings and opening evidence in live mode. Test records and approvals never substitute for live identities or approved rights.
8. Enable each live write capability only when its acceptance and actual customer authority exist. Enable ledger posting only after finance accepts live shadow results and an owner/admin approves that customer/mode. No automatic payouts are implemented. Activate client-success routines separately after calendar/recipient/opt-in checks in its runbook.

The scope exclusions in FINANCIAL_EXCEPTIONS.md are intentional pilot boundaries. If a customer's actual billing requires an unsupported allocation, leave that cohort held until its path is implemented and verified. Nothing here authorizes invented clearing evidence, resetting windows, or unsupervised customer billing.

Current local evidence: 153 billing/commercial/commission tests passed; 14 distinct desktop/phone commercial journeys passed across the initial run and corrected targeted rerun; final build, TypeScript and lint passed. Details and reproducible commands are in [Financial exceptions](FINANCIAL_EXCEPTIONS.md). Production deployment/migration and actual provider acceptance must still be observed in your setup stage.
