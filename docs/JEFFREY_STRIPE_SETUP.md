# Jeffrey — Stripe setup and connection handoff

Prepared November 15, 2026. **Status: preparation handoff; not ready for provider connection yet.** Austin requested that implementation happen first and that Jeffrey own Stripe account setup and connection as the final activation step.

The [commercial preparation release](COMMERCIAL_PREPARATION.md) supports private agreement versions, referral decisions, assignment history, project budgets, invoice drafts and hypothetical calculation previews. It does not yet contain the Stripe adapter, webhook endpoint, verified-collection pipeline or automatic recurring ledger posting. There are currently no Stripe environment-variable names or webhook URLs to copy from this repository into a live account. Do not substitute an old Meta, Mail or other integration endpoint.

## What Jeffrey will own once the implementation gates pass

1. Create or select the company-owned Stripe account and complete business identity, authorized representative, bank and account verification. Use the actual contracting legal entity from the reviewed agreements. Grant appropriate team access; do not share an individual's login or send credentials in chat.
2. Confirm the billing/payment methods and actual account pricing. Keep upfront implementation and recurring services separate; products/prices must match approved customer contracts. Do not create an extra marketplace/payout setup merely to collect company invoices.
3. Connect sandbox credentials first, through the website's private hosting environment. The completed adapter release must supply the exact environment names, merchant/workspace identity, pinned API version, least-privilege permissions, webhook events and endpoint below.
4. Run the supplied sandbox acceptance procedure: ordinary recurring payment, mixed invoice, partial payment, prepaid services, delayed/failed bank payment, refund/credit, dispute, duplicated/out-of-order webhook and reconnect/replay. Confirm client mapping and exact reconciliation; verify that invoices or drafts do not themselves create collected revenue.
5. Have the finance owner approve collection semantics, signed rule versions, customer-specific entitlements, opening balances and the pilot cohort. Resolve unmatched/unclassified items before enabling ledger posting.
6. Connect live credentials with the same account/mode checks and begin read-only reconciliation. Record the deployment version, merchant identity, successful synchronization and reviewed real evidence. Only then enable the agreed billing/posting capabilities separately.
7. For any real invoice, charge, customer notification or payout acceptance test, use an explicitly authorized customer/recipient, amount and content. A configuration check is not permission to make a test charge or transfer funds.

## Engineering must complete before asking Jeffrey to connect

| Gate | Current state |
| --- | --- |
| Private commercial preparation and manager history | Implemented locally in migration 0069; release verification in the runbook |
| Customer-specific role entitlements and eligibility intervals | Capture implemented in migration 0070: exact executed versions, customer/source identity, manager periods, work/leave and separate notice/cure reviews. [Limits and financial activation gates](CUSTOMER_ELIGIBILITY.md); receipt anchors and financial consumption still pending |
| Verified receipt, invoice-line and service-period model | Pending |
| Stripe adapter, signed webhook intake and recoverable reconciliation worker | Pending |
| Compatible recurring/internal-recipient ledger and reviewed statements | Pending |
| Client-success task/calendar/notification workflows | Pending |
| Reviewed assistant billing actions | Pending |
| Exact account scopes, environment variables, API version, webhook URL/events and worker settings | To be filled from implemented code; do not guess |
| Sandbox fixtures, provider acceptance script and rollback procedure | To be finalized with adapter release |
| Approved private terms, signatures and live cohort | Business/finance confirmation required |

## Final connection block — deliberately unfilled until code exists

- Verified implementation commit and migration set:
- Website/worker service names and deployment version:
- Stripe account ID and workspace mapping:
- Sandbox/live mode separation:
- Required environment-variable names (names only; never values):
- API version and restricted permissions:
- Webhook endpoint, subscribed events and signing-secret location:
- Reconciliation schedule, replay/backfill procedure and stale-data indicators:
- Exact sandbox test commands and expected results:
- Rollback switches and evidence-preserving recovery:
- Approved live pilot and finance sign-off:
- Observed provider acceptance date/result:

Keep private commercial rates, signed agreements, credentials, bank/tax data and customer financial exports out of this public repository. Use authorized private storage for the actual configuration and acceptance evidence. A future update will replace the pending entries with verified implementation details rather than presenting this draft as a finished connection guide.
