# Commercial preparation workspace

November 15, 2026 implementation checkpoint. The owner requested building the software before Jeffrey sets up/connects Stripe. This release starts that sequence; it does not complete the full recurring-finance or client-success implementation.

## Using the workspace

Open **Partners → Agreements, referral decisions & billing drafts**. `/dashboard/finance` requires existing finance read/manage permission or an owner/admin role. Selecting a finance work focus does not grant access.

Finance managers can prepare:

- Versioned external referral, internal commission and customer service agreement records. Store references to private documents and their exact proposed terms. No commercial rates or named counterparties are seeded.
- Separate upfront project budgets with the actual closer/developers, explicit amounts, costs and conditions. The project must belong to the selected client and uses cannot exceed its proposed fee.
- Internal invoice drafts with separate recurring, upfront, tax, pass-through and other lines. Recurring lines require covered service dates. These are local drafts; they are not Stripe invoices.
- Referral submissions and explicit accepted/rejected/disputed/expired decisions, evidence and dates. Related CRM records are checked for conflicting accepted attribution. Record actual acceptance and conversion deadlines; the application does not invent contractual dates.

Revising a document creates a new draft version; it does not edit the old contents. Internal review precedes recording execution. Recording a signed agreement or authorized project budget requires evidence and an effective date. It records an action completed outside the software; it does not sign anything or activate payable rules. Invoice drafts cannot be executed/issued here. Supersession preserves previous versions and history.

Client account-manager changes now append dated assignment/unassignment history, actor and reason. Existing UI and assistant writes use the same database capture. Existing current assignments receive a migration-time baseline explicitly marked as unverified prior history. An assignment is not proof of compensation eligibility. The current assignment remains in its existing client field for compatibility.

The assistant has permissioned `get_commercial_workspace` and `get_commercial_document` reads. It can explain these records using the employee's existing finance access. New contract-signing, invoice-sending, subscription-creation, approval, payout and finance-grant tools are not added by this release.

## Calculation previews

An invoice draft's detail page includes **Test a collection scenario**. Enter hypothetical collection/refund facts and role segments referencing saved agreement versions. The preview obtains rates from those private versions, not from AI guesses. Saved drafts can be used for simulation; they are not treated as executed authority.

The current preview convention is explicit: proportionally allocate net collections across invoice lines, divide prepaid full service months equally, and recognize at month-end after the assumed clearing gate. It excludes nonrecurring lines, defers future months, clips eligibility/windows and prorates manager calendar days with integer cent conservation. Overlapping same-role segments are rejected. Missing window anchors, partial-month service schedules and excessive combined commissions are held for review.

These are arithmetic scenarios, not verified receipt ingestion or payable ledger entries. They do not establish real referral acceptance, assignment eligibility or bank settlement. Actual program conventions and signed policy must be confirmed before the later calculation/posting engine is activated. The existing partner ledger and statement workflow remain unchanged.

## Implementation and migration

- [Migration 0069](../db/migrations/0069_commercial_preparation.sql): commercial document versions/review events, referral submission/decision history and client assignment capture.
- [Commercial services](../lib/commercial/service.ts): transactional finance authorization, request replay protection, version serialization and conflicting referral checks.
- [Calculation engine](../lib/commercial/calculation.ts) and [invoice simulation](../lib/commercial/simulation.ts): pure integer arithmetic behind finance-scoped source reads; no ledger writes or provider calls.
- [Workspace](../app/dashboard/finance/page.tsx) and [document review](../app/dashboard/finance/[id]/page.tsx): existing dashboard components and styles, separate preparation notices and review controls.

Apply migrations using the existing deployment process before serving the new pages. No credentials or provider configuration are needed for this release. Disabling links is not an authorization control; service checks run on every action/read. The migration adds history and no commercial defaults. Preserve the new records on rollback; do not delete signed references or attribution history to roll back UI.

## Remaining sequence — Stripe activation last

1. Finish customer-specific entitlements and distinct internal eligibility histories, including approved notice/cure exceptions and surviving rights. Submission decisions and current manager history alone do not implement these rules.
2. Build verified collection/service-period records and the Stripe read-only adapter against local fixtures, including stable business deduplication, refunds, credits, disputes and reconciliation recovery.
3. Extend the existing ledger and monthly statements for recurring allocations and internal recipients. Reconcile shadow results, including partial-month cases, against approved private examples before enabling posting.
4. Add client-success calendars, client tasks, check-in/response evidence and permissioned employee notifications. Reuse My day/Services; keep automatic forfeiture and customer outreach disabled.
5. Add explicitly reviewed assistant billing actions after the underlying services and approval contracts are tested.
6. Finalize [Jeffrey's Stripe handoff](JEFFREY_STRIPE_SETUP.md) from the implemented adapter, then let Jeffrey create/verify/connect the account and complete provider-backed sandbox/live acceptance. Connecting keys alone is not final financial acceptance.

The private pack and [gap analysis](REFERRAL_CLIENT_SUCCESS_GAP_ANALYSIS.md) retain detailed requirements. Legal review, actual signatures and final policy decisions remain business-owner work; this release does not certify or replace them.

## Verification

Local checks use isolated PostgreSQL databases and synthetic counterparties/terms. The existing operating-model integration suite passed all 15 cases after migration 0069; ten new commercial integration cases and ten pure calculation cases passed. TypeScript, lint and production build passed. Four desktop/phone browser journeys passed for invoice preparation/review/simulation and finance access restrictions, including accessibility and overflow assertions. Desktop and phone screenshots were visually reviewed and panel spacing/headings corrected before the final browser pass. All 154 local links across the eight affected/new runbooks and planning documents resolve; `git diff --check` passed. Private reference files remain Git-ignored. These are local results, not production, signature, payment or Stripe acceptance.
