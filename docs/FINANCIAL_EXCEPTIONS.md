# Financial exceptions and statement settlement

November 16, 2026 source checkpoint. Migration **0077** completes the bounded preparation workflows before Jeffrey connects Stripe. This release contains no actual commercial terms, provider connection, payment, notification or activation. Local acceptance is recorded below; provider acceptance is still required.

## Collection exceptions

Open **Finance → Collections & reconciliation → invoice**. Refresh canonical evidence, save the exact customer/line/clearing review, then use **Review financial exceptions**. The approval belongs to one immutable snapshot and one collection review. A changed source or new review invalidates it; it never overrides an unresolved hold.

Supported cases:

- Closed `lost`, `won` and `warning_closed` disputes with complete, reconciled processor balance movements. Open disputes, missing/pending/mismatched balances and unresolved refund overlap remain held. Principal losses reduce cash; processor/dispute fees do not reduce the contractual gross basis. A fully refunded receipt with no additional dispute withdrawal is not deducted twice.
- Recovered funds under the bank-evidence policy require a separate actual recovery clearing date/reference. Original receipt dates remain the original window evidence; a recovery does not renew the commission window.
- Pure pre-payment credit notes with complete original invoice-line references. The reviewed source amount stays preserved; credit amounts reduce the corresponding allocation weights and separately reviewed tax. Collected cash must still reconcile. Custom/unmatched lines remain held.
- Pure post-payment credits whose successful refund allocations reconcile exactly, including multiple refund links. Refund cash is deducted once and cannot be consumed by multiple credit notes beyond its actual amount.

Mixed pre/post credits, customer-balance credits, out-of-band payments/credits, split-charge allocation, FX, unresolved tax allocation and incomplete legacy evidence remain explicit holds. They are excluded from the initial pilot. Do not fabricate cash or approve arbitrary adjustments to release them. If the actual pilot needs one, extend and test that exact reconciliation path before including it.

The reader uses GETs for canonical dispute balance transactions and complete credit-note lines, within its existing page/request/response bounds. Stripe describes withdrawal/reinstatement movements in [the dispute object](https://docs.stripe.com/api/disputes/object), and original invoice-line, discount and tax fields in [credit-note line items](https://docs.stripe.com/api/credit_notes/line_item). Actual API-version and restricted-key acceptance remains Jeffrey's sandbox responsibility.

## Original-window corrections

Open the customer under **Finance → Recurring commissions**. When complete evidence identifies an earlier receipt or a changed clearing date, calculation remains held. An owner/admin can record **Correct original receipt evidence**, bound to the current evidence fingerprint and preceding correction. The target must be the earliest verified recurring receipt; the pinned agreement's window length is retained.

Original anchors and all corrections remain immutable. Effective dates come from the latest preserved correction; prior calculations become stale and need recalculation. Existing earnings and paid statements are never rewritten: approved differences become later ledger entries.

A fully reversed initial receipt can be preserved only with explicit owner/admin signed-policy authority when creating the anchor. A later fully reversed anchored receipt requires the specific retained-original decision. Neither workflow selects the next payment as a replacement window. Unsupported signed conventions must remain held.

## Statement settlement

Open a recurring commission statement. Its original total and items remain unchanged throughout:

1. Review and approve the exact statement revision. Current posted source reconciliation is required.
2. Record actual completed external payments with amount, actual date, unique reference and evidence. Partial payment leaves a remaining balance; an overpayment cannot be recorded through this workflow. A repeated request cannot create a second payment, and an unreversed external reference cannot be reused in the same workspace/mode.
3. Apply an approved negative credit statement to a positive statement for the **same recipient and test/live mode**. Both current revisions, balances and source histories are checked. Equal/opposite offset entries are committed together. No money moves; a positive balance settled entirely by offsets uses the existing `paid` status with its offset journal explaining the settlement.
4. Correct an incorrectly recorded payment with a reversal entry. The original remains; a paid statement may reopen. Reversing a credit offset restores both sides atomically. This corrects bookkeeping evidence only, not the actual external transfer.
5. Record delivery performed elsewhere, an open dispute, or resolution of a specific dispute. An unresolved dispute blocks review/approval and new settlements. A correction reversal remains available because it releases no payable. Recording delivery sends no message.

The page and Assistant read expose original total, applied amount, remaining balance, offsets, reversals and disputes. Full history determines balances and holds; the UI shows the latest 100 entries and prioritizes unresolved disputes in its bounded notes list. Older evidence remains stored. A zero statement is not a positive cash payment; a fully offset negative statement remains approved with zero remaining credit. Recipient self-service, automatic delivery, payouts and arbitrary manual money adjustments are outside this release. Finance must reconcile recipient-wide outstanding credits before deciding an external payment; this journal records the specific reviewed statement allocation.

## Deployment and rollback

- Apply migrations through 0077 before serving the changed pages or running workers. It adds append-only exception approvals, anchor corrections, settlement entries and statement notes; it backfills already recorded recurring `paid` statements as `legacy_payment` evidence without moving money. No legacy-program statements are converted.
- Keep import, all provider-write switches, recurring ledger posting and client-success activation off until their respective handoff acceptance. No new feature flag bypasses current finance permissions.
- Saved calculation fingerprints include the expanded evidence. Recalculate and review existing affected runs after deployment; never reuse a stale approval to force a posting or payment.
- Roll back by disabling posting and provider writes, preserving all records and reconciling failures. Do not drop the migration, delete settlements or rewrite snapshots. Older application code that assumes a single payment is not an appropriate writer once partial settlements exist.

## Local verification

All 153 cases passed across the 11 billing, commercial and commission test files, using isolated PostgreSQL and synthetic provider responses. Coverage includes review invalidation, closed/open disputes, bank recovery, credit/refund conservation, preserved anchors, permissions, replay, partial payments, overpayment rejection, paired offsets/reversals, statement disputes and immutable history.

Twelve commercial browser journeys passed initially; the two new statement journeys reached completed partial settlement and then stopped on a test-only label selector. The selector was corrected. All four changed collection/statement journeys then passed on desktop and phone, including specific dispute resolution and original-window correction, completing 14 distinct commercial journeys. Accessibility/overflow checks passed on those journeys, and phone screenshots were visually inspected. Production build, TypeScript and lint passed on final source. A test-only browser fixture variable shadowing `document` was corrected before the final build.

Reproduce locally (isolated test databases only): set `OPERATING_TEST_DATABASE_URL` to the local `ta_operating_test` database, then run `npx vitest run lib/billing lib/commissions lib/commercial --no-file-parallelism`. Seed `ta_reporting_browser_test` using `scripts/seed-reporting-preview.mjs`, set `REPORTING_TEST_DATABASE_URL` and a free `REPORTING_TEST_PORT`, and run `npx playwright test tests/reporting/commercial.spec.ts --config playwright.config.ts` after `npm run build`. Run `npm run lint`.

All fixtures are synthetic and deliberately separate from actual private policies. No provider sandbox, production migration, live financial flow or delivery acceptance is claimed.
