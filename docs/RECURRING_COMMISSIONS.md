# Recurring commission ledger

November 15, 2026 implementation checkpoint. Open **Finance → Recurring commissions**. This extends the existing referral ledger for internal and external recipients. Stripe import and recurring posting remain disabled by default; no actual commercial policy, customer cohort, receipt, payment or provider connection was activated by this release.

**November 16 update:** [Financial exceptions and settlement](FINANCIAL_EXCEPTIONS.md) adds reviewed closed-dispute/credit allocation, owner original-window corrections, partial payments, paired offsets, reversals and statement delivery/dispute records. Migration 0077 and the later workflow below supersede the earlier release’s missing exception paths. Provider acceptance remains pending.

## Preparation workflow

1. Record the exact executed agreement and customer attribution in [Customer eligibility](CUSTOMER_ELIGIBILITY.md). Preserve service periods, assignment history, work/leave and review evidence.
2. Import and review the customer's source invoices using [Collections & reconciliation](BILLING_RECONCILIATION.md). Match actual customer identities, classify all invoice lines, and approve the applicable processor-availability or bank-evidence clearing requirement.
3. Prepare one customer calculation policy per **test/live mode**. Record private evidence approving the supported convention against the signed terms. Rates and window lengths come from pinned agreement rules; the software does not seed them.
4. For every fixed window, review the earliest qualifying recurring receipt and record historical-completeness evidence. Check prior billing accounts, earlier systems and unmapped history outside the visible import. The system can validate mapped evidence; it cannot prove that unknown accounts or missing customer mappings do not exist.
5. Save shadow calculations for each invoice. A saved run preserves the policy, exact invoice snapshot/review identities, collected/refunded amounts, classified lines, attribution, eligibility periods, anchors, decisions and calculated components. Held runs are preserved too.
6. Reconcile those results against privately approved examples. Posting remains a separate activation step; preparation does not create payables.

All new pages and actions require current finance access. Read-only finance users cannot mutate records. Owners/admins alone can approve a customer for posting. Employee and partner recipients are explicit identities; a role, work focus or relationship does not grant finance access. The new statement pages are finance-only, including for recipients. Legacy partner-granted statement access remains scoped to the legacy program.

## Supported convention

`calendar-month-v2` is an explicit convention to approve, not an interpretation silently applied to every agreement:

- Allocate net collected cash proportionally across all reviewed invoice lines after successful refunds. Upfront, tax, pass-through and other nonrecurring classifications remain excluded from recurring commissions. Processor fees remain separate.
- Allocate prepaid recurring cash equally to complete calendar months. Weight a partial month by its covered calendar days divided by the days in that month. Integer largest-remainder allocation conserves the cash basis, with stable line/month ordering.
- Recognize each service segment at calendar month-end, after the clearing gate. Future months remain deferred. The selected date caps service recognition using **current** receipt evidence; it is not a reconstructed historical processor balance.
- Eligibility starts are inclusive and ends exclusive. Preserve gaps and prior service rights after transfer/offboarding. Rounded shares within one role use deterministic residual allocation. Same-role overlaps and excessive combined components are held.
- A fixed window starts on the approved original cleared receipt date. Add its configured number of months, clamp a missing anniversary day to that month's last day, and exclude the anniversary date. Service outside the resulting interval is excluded, even when cash arrives later. A different contractual boundary requires a different reviewed implementation.
- No role receives another role's absent share. The remaining customer revenue is an unallocated amount before other costs, not a profit calculation.

The earlier hypothetical draft and basic collection previews retain their full-month-only convention. Use this new workspace for saved partial-month and approved-window calculations.

## Original window protection

Anchors bind the customer entitlement, mode-specific policy, source invoice, exact original snapshot/review, receipt identity and dates. They are append-only. Renewals, upgrades and new subscriptions for the mapped customer reuse that history.

The review checks the complete bounded mapped customer history across connections in the selected mode. Every mapped source must be current and reviewed; scans and pending/retry/failed jobs must be resolved, and source/scan evidence must be no more than one day old. Shared receipt allocations, open eligibility reviews, changed referral acceptance/deadlines, missing periods and invalid manager coverage are held. Bounds are explicit: at most 500 invoices, 100 entitlements and 100 periods per entitlement and 200 combined eligibility segments in one complete calculation. Calculation schedules are bounded to 600 line/month segments and 1,000 recipient components; excess history is held, never silently truncated.

A newly found earlier receipt or changed clearing date holds the original window. A full refund of an already anchored first receipt requires a specific, evidence-backed **retain original window** decision for that refund snapshot before calculation can resume. The decision permits a zeroed/refunded calculation without granting a replacement window. A fully reversed receipt discovered before an anchor exists requires explicit owner/admin authority to preserve that original date. A changed original receipt can now be corrected through the owner/admin workflow, preserving every version and the signed window length. The application never chooses the next receipt to reset the clock.

## Posting and adjustments

`COMMISSION_LEDGER_POSTING_ENABLED=false` is the server-side default. Enabling it is only one gate. An owner/admin must also approve the exact customer/mode using a current, unheld shadow result and private acceptance evidence. No flag or approval was enabled by this release.

Finance then posts a reviewed run explicitly. The service rechecks current evidence under transactional customer/source locks and compares its fingerprint with the saved run. Stale, held or backward service-date runs cannot post. Request replay protection and customer serialization prevent concurrent duplicate earnings.

The target is the cumulative calculated amount for each invoice line, service month and entitlement. Posting appends only the difference from prior ledger entries. Successful partial/full refunds, corrected service classifications and newly recognized prepaid months follow the same calculation path. Adjustment details retain previous/target amounts and a link to the prior component entry; originals stay intact. A completed reconciliation is recorded even when the amount did not change, so statements can prove that the latest evidence was reviewed without creating a duplicate earning.

Source records and typed recipients extend `crm_referral_sources`, `crm_referral_earnings` and `crm_referral_statements` with a program discriminator. Legacy manual earning/reversal/statement routes cannot mutate the recurring records. No existing agreement, earning, partner grant or historical statement is converted or reseeded.

Open disputes, unmatched credits, split charges and unsupported source exceptions remain held. Supported final disputes/recoveries and canonical credit allocations can now receive exact finance exception review; see the linked exception runbook. The current release does not invent arbitrary manual commission adjustments or override contractual authority to clear these holds.

## Monthly statements

Statements select a completed **booking month**, recipient and mode. They preserve each customer/service month, role, cash basis, original calculation and adjustment amount. Late collections and corrections book when posted while retaining their original service month. A finance reviewer records the actual agreed due date; no private deadline is hardcoded.

The existing statement lifecycle is reused: draft → reviewed → approved → recorded paid. Draft/reviewed statements may be voided, releasing their entries while preserving the old snapshot. Entries cannot belong to two active statements. Approvals/settlements recheck the latest posted reconciliation for every included invoice; stale or held source evidence requires refresh and reviewed reconciliation first.

Paid statement amounts and items are immutable. A later refund creates a new adjustment available to a later statement. Recording payment requires a positive statement balance and actual external settlement evidence; **it does not transfer money**. Test statements explicitly carry no live payment obligation.

Partial external payments and same-recipient/mode credit offsets now preserve individual allocations. Reversals reopen balances without rewriting snapshots. Delivery performed elsewhere and specific dispute/resolution events are recorded; open disputes block approval/settlement. Zero/negative balances cannot be marked as positive payments. Recipient self-service and exports remain outside this release. No statement is emailed or texted automatically.

## Deployment and rollback

Apply all migrations through [0077](../db/migrations/0077_financial_exception_evidence.sql), including [migration 0072](../db/migrations/0072_recurring_commission_ledger.sql) before deploying these routes. It adds policy/anchor/calculation/posting history, typed recipients, compatible ledger fields and database guards for immutable evidence, recurring earnings and statement snapshots. It seeds no rates, payees or approvals.

Keep both billing import and posting switches off until [Jeffrey's final acceptance](JEFFREY_STRIPE_SETUP.md). No recurring calculation worker is scheduled: importing or reviewing a receipt does not automatically post or create a statement. Finance explicitly reconciles each invoice, including prepaid months as they mature.

For rollback, disable recurring posting first and preserve all immutable records. Keep source import/review available when needed to reconcile existing obligations. Do not delete financial history or rewrite a paid statement to undo a release. Provider writes, invoice issuance, signatures, transfers and customer messages remain separate capabilities.

## Verification record

Local acceptance uses isolated PostgreSQL and synthetic policies with deliberately different values from the private commercial pack. The checks cover allocation/rounding, partial months, prepayments, transfers, original anchors, refund decisions, earlier discovered history, permissions, mode separation, concurrency/replay, stale evidence, offboarding, linked adjustments, immutable paid statements and legacy compatibility. All 24 new cases and 71 earlier regression cases passed (95 total); the 24 new cases passed again after final bounds. Ten browser journeys passed, with the two new journeys repeated successfully after the finance-list layout correction. TypeScript, lint and production build passed. Desktop/phone screenshots were reviewed; populated finance lists now use an explicit two-column layout with a single-column phone arrangement. See [the commercial preparation checkpoint](COMMERCIAL_PREPARATION.md) for the complete local acceptance record.

No Stripe sandbox/live acceptance, real financial activation or authenticated production acceptance is implied by local tests or a Git push.
