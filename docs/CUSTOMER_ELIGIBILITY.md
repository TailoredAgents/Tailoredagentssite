# Customer-specific eligibility preparation

November 15, 2026. This extends [commercial preparation](COMMERCIAL_PREPARATION.md) with durable customer attribution and human-reviewed service eligibility. It does not enable financial posting, calculate actual commissions, connect Stripe or start a payment window.

## Where to work

Open **Partners → Agreements, referral decisions & billing drafts → Customer eligibility**. Existing finance read/manage permissions apply to every page, service call and assistant read. Selecting a work focus or knowing a URL does not grant financial access. Readers see history; finance managers can record evidence and decisions.

1. Record the exact private agreement in Agreements & billing, review it, then record its actual execution evidence and effective date. A draft or internal review cannot authorize customer attribution.
2. For an external partner or an employee who recruited that partner, accept the referral and bind it to the connected client. Direct internal originators do not need an external partner record. Manager attribution requires an internal agreement containing that role.
3. Record customer attribution, selecting the exact executed version and source, with approval evidence. Rates, role terms, execution evidence, acceptance date and the conversion deadline are snapshotted from these records; none is supplied by the assistant or seeded from private drafts.
4. Add eligible service periods with their supporting evidence. Manager periods also select the actual assignment history for that customer and recipient. Dates must fit the recorded assignment; a cutover baseline cannot prove earlier service.
5. Record actual work, approved/protected leave and any necessary human reviews. Keep medical details out of evidence fields; use an authorized private reference.

## Continuity and dates

The customer attribution record persists across renewals, expansions, superseded agreement versions and member suspension. One external attribution and one internal originator are supported per customer. Manager recipients have distinct records. Duplicate creation is rejected rather than restarting customer history. Exceptional splits, recipient corrections and prospective changes to pinned rate versions require a later explicit reviewed workflow; editing an old document or creating another customer to bypass this rule is not a supported correction.

Periods use **start-inclusive, end-exclusive Eastern calendar dates**. The first eligible day counts; the first excluded day does not. Same-role periods cannot overlap, including different managers. Customer-level transactional locks serialize competing assignments and attribution; request replay and revision checks prevent duplicates or stale writes.

This is a capture convention for reviewed dates, not final financial acceptance of transfer-day proration. A manager assignment's current timestamp history supplies the boundary. Same-day handoffs or unknown historical coverage that cannot fit these dates need separate review before posting. If an assignment subsequently changes, the eligibility page flags any now-inconsistent coverage and preserves the original periods. It does not silently rewrite financial history. Prospective transfers can end an open internal period and start another without overlapping dates. Closed periods cannot be rewritten through these actions; historical corrections remain held for a separate reviewed adjustment workflow.

Offboarding does not delete attribution or past eligible periods. Historical, ended internal periods can be evidenced after departure, while new/future periods require active editing membership. This preserves the evidence needed for later collections attributable to earlier service; it does not itself create a payable.

External customer windows cannot be ended through the ordinary departure/term-end action. They await a verified qualifying first receipt in the later collection pipeline, with one preserved customer anchor. No date is inferred from a CRM sale, invoice draft or agreement execution. Full reversal of an eventual first receipt must remain a reviewed correction, not an automatic clock restart. Changes to a referral decision after attribution produce an explicit reconciliation warning while retaining the original acceptance snapshot.

## Work, leave, notice and cure

Inactivity reviews belong to originators; performance reviews belong to managers. A finance manager records the observed period, actual delivered notice, reviewed cure deadline, policy/calendar calculation and evidence. Opening a review sends no notification and changes no eligible period. The software validates date order and requires the cure deadline to have passed before a human can end future eligibility. It does **not** calculate or certify a policy's private inactivity threshold, holiday calendar or minimum business-day cure duration. Those values must be checked against the signed version by the authorized reviewer.

Retain/cured and dismissed decisions preserve eligibility. An end decision requires a prospective effective date, an expired cure, one open period spanning that date, no later periods, and explicit decision evidence. Protected leave overlapping the review blocks ending eligibility; qualifying work also blocks an inactivity end. These conservative holds require the reviewer to retain/dismiss the case and reconsider the evidence. There is no automatic forfeiture, blanket backdated cancellation or redistribution to another recipient. A pending review cannot be bypassed with the ordinary period-end action.

Work/leave evidence and review outcomes are retained with actor and revision history. Existing paid ledger rows are never changed. This release adds no notice delivery, calendar obligations or employee notification automation; those belong to the client-success phase.

## Implementation and limits

- [Migration 0070](../db/migrations/0070_customer_eligibility.sql) adds customer entitlement identities, service periods, distinct reviews, work/leave evidence and decision events. It seeds no counterparties, rates or rights.
- [Service](../lib/commercial/eligibility.ts) enforces finance permissions, signed authority, source identity, assignment bounds, nonoverlap and reviewed transitions. Supersession can no longer change an executed document's effective date.
- [Workspace](../app/dashboard/finance/eligibility/page.tsx) and [history page](../app/dashboard/finance/eligibility/[id]/page.tsx) expose the preparation workflow. Lists page at 50 records; selectors show up to 500. Detail displays up to 500 periods and 100 records per other history and explicitly flags truncation. Full history remains stored.
- Assistant reads `list_customer_eligibility` and `get_customer_eligibility` use the same fresh finance authorization. No eligibility approval/signature/write tools were granted to the assistant.

The earlier invoice calculator remains a hypothetical scenario tool. It does not consume these records as approved payable rules. The verified collection phase must resolve receipt semantics, service dates, conversion deadlines/extensions, the original window anchor, complete eligibility history and financial adjustments before recurring ledger posting. External agreement intake closure, exceptional splits/fraud decisions, pinned-term amendments and historical corrections need explicit reviewed lifecycle support before any affected real cohort is enabled. Ordinary agreement supersession alone is not a referral intake termination notice.

Apply migration 0070 through the normal migration process before serving the new routes. No provider keys are needed. Preserve the new tables/history if reverting the UI; never delete evidence to roll back a release. Existing legacy manual ledger behavior is unchanged and is not retroactively migrated into this eligibility model.

## Verification boundary

Local verification uses isolated PostgreSQL, synthetic recipients and deliberately synthetic agreement terms. No real agreement, recipient, collection, notification, provider credential or commission was activated. Final check results are recorded in the commercial preparation runbook; production acceptance remains separate.
