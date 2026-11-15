# Referral commissions and client success implementation handoff

Prepared November 15, 2026. Planning only: this change adds documentation, not application behavior, migrations, agreement activation or payouts.

## Start here

**November 15 source audit completed:** read the [gap analysis and phased implementation plan](REFERRAL_CLIENT_SUCCESS_GAP_ANALYSIS.md) for the existing/partial/missing matrix, compatible ledger migrations, Stripe-first billing recommendation and release gates. This is a planning result; implementation and financial activation remain pending. The local ignored supplement records private draft-policy mapping.

Extend the existing CRM's relationship, partner-finance and managed-service workflows to support recurring-service commissions and accountable client management. Do not build another CRM or duplicate the existing ledger.

This repository is public. Actual commercial rates, contract durations, named allocation policies, agreements and compensation records must remain in authorized private storage. Local reference material is available in the Git-ignored `docs/private/referral-program/` directory on the originating workstation. It is not included in a clone or GitHub checkout. If that directory is unavailable, obtain the private brief from the owner before implementing policy-specific behavior. Do not infer company terms from public examples or test fixtures.

Read these existing guides first:

- [Project status](PROJECT_STATUS.md) and [active roadmap](AGENCY_OS_ROADMAP.md).
- [Referral ledger](REFERRAL_LEDGER.md) for the existing finance workflow and limits.
- [Relationship workspace](RELATIONSHIP_WORKSPACE.md) and [operating-model guide](OPERATING_MODEL_GUIDE.md).
- [Unified Inbox](UNIFIED_INBOX.md) and [meeting runbook](MEETING_INTELLIGENCE.md).

Private drafts express intended business policy; they are not executed agreements or authority to activate financial rules. Signed versions and authorized effective dates govern actual counterparties. Preserve existing agreements, attribution, earnings and pending activation work.

## Existing foundation to inspect and reuse

The November 15 documentation/source inspection found the following starting points. This is not a complete code audit or fresh production verification.

| Area | Existing starting point | Extension to assess |
| --- | --- | --- |
| Partner finance | `lib/partners/contract.ts`, `service.ts`, `actions.ts`; dashboard partner and statement routes | Recurring-only source classification, service-period allocation and distinct internal compensation roles |
| Persistence | `db/migrations/0064_relationship_operating_model.sql` | Additive changes that preserve agreement versions, original sources, earnings and statements |
| Relationships | `lib/relationships/`, client introductions and handoffs | Accepted-referral lifecycle and immutable attribution history |
| Ongoing service | `lib/client-services/`; `db/migrations/0066_client_services.sql` | Dated manager assignments, activity standards and reassignment history |
| Communications | Existing Inbox, calendar, My day and Meetings & notes | Evidence-backed response and follow-up tracking within current permissions |
| Verification | `lib/relationships/operating-model.integration.test.ts`, `tests/reporting/relationships.spec.ts` | Regression coverage plus new recurring-finance and assignment cases |

The current ledger supports versioned agreements, explicit finance permissions, bounded partner reads, source deduplication, immutable earnings/reversals, reviewed statements and recording externally completed settlements. Its contract allows collected or invoiced bases and document-count or non-document revenue sources. Policy descriptions are operator-reviewed text; they do not automatically enforce service-month allocation, verified payment collection or every commercial condition.

For this new program, enforce collected eligible recurring service revenue explicitly. Do not silently change other valid agreement types, treat generic revenue fields as sufficient classification, or assume a recorded statement moved money.

## Target behavior

### Referral and role attribution

- Track partner onboarding and agreement status, referral submission, acceptance/rejection, conversion eligibility and customer conversion.
- Preserve original attribution and resolve duplicates before conversion. Apply the privately approved single-source and exceptional split rules.
- Keep external partner, internal originator, sales closer, developers and assigned account manager as distinct roles. An existing relationship or account owner is not automatically entitled to a commission.
- Store customer-specific partner commission windows from the qualifying first cleared recurring payment. Renewals and expansions must not restart the original window.
- Store role eligibility and assignments with effective dates, evidence and authorized changes. Assignment suggestions use the private operating policy and actual capacity; suggestions are not permanent entitlements.

### Financial integrity

- Classify invoice line items: recurring service, upfront project, tax, pass-through, credit and any justified additional types.
- Accrue only on eligible cleared recurring collections for the applicable service periods. Upfront development, setup and standalone later projects belong to separate approved project budgets.
- Allocate prepaid recurring receipts across covered service months after collection. Do not accrue the entire prepaid term at receipt.
- Calculate each role from its authorized agreement version, rate, eligibility and service dates. Unallocated amounts remain with the company; no automatic substitute recipient.
- Prorate manager transfers by assigned calendar days, bounded by the configured total manager allocation. Preserve previously earned periods and handle later collection under the applicable terms.
- Use integer/decimal-safe money, stable source identifiers, deterministic replay, unique ledger entries, immutable paid history and auditable corrections.
- Prepare monthly statements for review and approval. Reuse the existing settlement-recording workflow; automated bank transfers are outside the initial scope.
- Keep any additional restricted company compensation outside ordinary partner/staff statements and access paths. Private governance records are not part of this handoff.

### Client success

- Assign a responsible human on conversion, with dated coverage and transfer records.
- Track human first-response deadlines against configured business hours and holidays; auto-replies do not count as meaningful responses.
- Schedule personalized check-ins and suitable opportunity reviews using the approved private cadence, with documented exceptions.
- Connect substantive communications, next actions, missed calls, unresolved issues, renewals and account health to existing CRM records.
- Record evidence, notice/cure periods, protected exceptions and prospective reassignment. Preserve earned compensation; one isolated missed contact must not trigger automatic forfeiture.
- Show leadership source performance, collected recurring revenue, pending obligations, commission expirations, workload and service exceptions. Keep booked project revenue separate and enforce finance access on financial views.

## Phased delivery

1. **Inspect and propose:** audit schema, services, billing/payment capture, permissions, integrations and existing tests. Produce a concrete existing/partial/missing matrix with code references. Present an additive migration and rollout plan before writing migrations.
2. **Attribution and recurring finance:** implement accepted-referral lifecycle, role history, revenue classification, collection/service-period evidence, configurable eligibility/windows and dry-run reconciliation. Extend reviewed statements while preserving the existing ledger.
3. **Client management:** add assignment suggestions, business-hour reminders, check-in/review tasks, account-health views, performance evidence and dated transfers, reusing Inbox/My day/Services.
4. **Later integrations:** assess a partner-facing portal, electronic signatures, secure payee onboarding, external accounting/payment reconciliation and explicitly approved payout automation. Existing bounded internal partner reads do not establish a complete external portal.

Use feature flags and dry-run comparison before financial activation. Do not turn draft terms into seeded production defaults. Use private configuration for real terms and clearly synthetic values in committed fixtures; never copy actual contract numbers into tests or public documentation.

## Required acceptance coverage

- Eligible recurring collection allocates correctly for the applicable roles, agreement versions and dates; absent/ineligible roles receive nothing.
- Upfront and other excluded line items create no recurring commission, including mixed invoices and later standalone projects.
- Prepaid services allocate by service month after collection; late collections, refunds and chargebacks reconcile without rewriting paid history.
- Partner windows expire correctly and never restart on renewal, expansion or payment replay.
- Mid-month manager transfer preserves both managers' earned allocations without exceeding the configured cap or changing originator attribution.
- Duplicate referrals, replayed payment events, concurrent ledger submissions and statement transitions cannot create duplicate earnings or payments.
- Inactivity and performance rules respect effective dates, notice/cure and approved exceptions; historical earned periods remain protected.
- Cross-workspace, non-finance and bounded partner reads cannot disclose other parties' financial data or restricted compensation.
- Existing partner agreements, document-based earnings, communications, customer conversion and service workflows retain their supported behavior.

These are future implementation checks. No application tests or live financial acceptance are claimed by this documentation handoff.

## Resume prompt for the software chat

> Read AGENTS.md, docs/PROJECT_STATUS.md, docs/REFERRAL_CLIENT_SUCCESS_PLAN.md and docs/REFERRAL_LEDGER.md. On this workstation, also read the local ignored docs/private/referral-program/README.md and its reference files; if missing, obtain the owner's private brief before implementing policy-specific rules. Inspect the current CRM code, schema, billing and communications. Produce an evidence-backed gap analysis and phased additive implementation/migration plan that reuses existing partner finance, relationship and service features. Keep real commercial terms out of this public repository. Do not activate agreements, create live payouts, overwrite attribution, send customer outreach or change signed agreements as part of this planning step.
