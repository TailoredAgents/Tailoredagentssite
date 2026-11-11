# Relationship-led operating model: implementation and resume plan

Prepared November 10, 2026 after Austin authorized a full plan and implementation. Baseline: main `6244e98`; preserve the unrelated generated `next-env.d.ts` change. Work on main and push verified, focused releases. This file is the durable resume point; unchecked work is not shipped.

## Intended employee experience

Capture a person at a meetup, through a referral, NFC card, campaign QR, website or phone call. Preserve what they actually said and missing information. Keep acquisition source separate from introducer credit. Assign discovery to an appropriate teammate, prepare a grounded brief, agree the next action, scope a solution, deliver it and support the relationship over time. Website creation is an optional path, not a prerequisite.

Functional responsibilities supplied by Austin:

- Devon: introducer/revenue-share partner and appointment setter; sales responsibility may grow later.
- Austin: lead developer and salesperson.
- Jeffrey: co-developer and salesperson.
- Conner: CFO, commercial structure and financial oversight.

These descriptions are not automatic permission grants. Preserve current access until explicit role assignments are made. Keep partnership terms off public pages. The agreed headline referral model is a per-document amount plus a percentage of non-document revenue; the exact private commercial terms remain owner-supplied and must not be inferred by AI.

## Existing foundations to reuse

- Canonical leads, businesses, opportunities, clients, contacts, projects and their existing links; do not add a second customer database.
- `lib/relationships/service.ts`: append-only discovery, introductions preserved through conversion, separate client account manager.
- Unified Inbox permissions, independent meeting visibility, existing calendar conflict checks and employee assistant delegated scopes.
- Smart Card and industry campaign source snapshots. Their owner/source is not automatically a payable introducer.
- Existing assistant action receipts, reviewed/direct modes, private documents and published company knowledge.

## Release 1 — Relationship overview and accountable handoffs (implement first)

- [x] Add a protected relationship overview linked prominently from prospect, sales, client and contact records. Show identity, recorded discovery, introducers, sales/account/project owners, related projects, next actions and links to permitted communications/meetings. Sparse prospects must work without a company, email or website.
- [x] Keep private meetings and channel-restricted messages out of broad summaries. Do not copy communication content into team-visible records. Link to the Inbox's existing authorization flow instead.
- [x] Add durable internal handoffs: recipient, next action, due time, context, pending/accepted/completed/cancelled state and an attributable history. Assigning does not mean the recipient accepted. Retain source record and show multiple related opportunities clearly.
- [x] Give employees a visible handoff queue on My day, with received and sent work, actionable overdue state and direct relationship links.
- [x] Require current revision for state transitions, active same-workspace recipients, recipient-only acceptance/completion, authenticated mutations and viewer denial. Make repeated submission safe. Do not send customer/employee messages or reserve calendar time merely by recording a handoff.
- [x] Add assistant reads/actions through the existing scope/review/receipt pipeline for relationship overview, handoffs, discovery, introductions and account manager changes. Distinguish recorded facts, ideas and commercial agreements.
- [x] Use existing Slate & blue/dark tokens, responsive layouts, descriptive actions and accessible forms. No new mandatory company fields or hard-coded employee IDs.
- [x] Test canonical links, cross-workspace and private-source denial, handoff ownership/revisions/replay, conversion preservation, viewer limits and assistant review/direct behavior. Exercise desktop and phone journeys with synthetic data; lint, typecheck and build.
- [x] Update current docs, commit/push and distinguish local verification from observed production deployment. No live email, SMS, calls or paid AI tests without the corresponding authorization.

## Release 2 — Referral agreements and earnings ledger

- [ ] Add a Partners workspace using existing introducer identities, with internal agreements, effective dates and attributable agreement versions. Separate attribution from compensation eligibility.
- [ ] Conner/Austin must decide the definition of a processed/eligible document, billing versus collection basis, earnings/payment timing, agreement duration, eligible services, refunds/credits and multiple-introducer rules. Do not invent these or activate payouts while unresolved.
- [ ] Store document usage and other revenue in separate source-backed buckets. Use stable event IDs, integer money, deterministic calculations, corrections/reversals and immutable statement inputs. Do not apply the non-document percentage to document revenue or count a retried document twice.
- [ ] Support draft/reviewed/approved/paid statement states with source drill-down. No automatic money movement. Pipeline value is not collected revenue; AI-generated estimates are not payable transactions.
- [ ] Add finance permissions and a bounded partner view before exposing financial details. Devon's own attributed earnings must not imply access to everyone's margins or mail.
- [ ] Test duplicate events, refunds, agreement changes, period boundaries, attribution disputes, unauthorized reads/writes and exact payout review. Keep terms private and real accounting imports separately authorized.

## Release 3 — Discovery to solution design

- [ ] Present the general Mockup sales stage as Solution design while preserving stored stage keys/history. Keep website mockups contextual.
- [ ] Add a staff-editable solution brief: confirmed workflow, systems/access, volumes, baseline, desired outcome, assumptions, proposed pilot, human checkpoints, acceptance criteria, delivery responsibility and support scope.
- [ ] Let the assistant prepare drafts from permitted discovery/meetings with source links and explicit unknowns. Do not promise integrations or savings without evidence.
- [ ] Reuse current tasks/calendar/project conversion. New automated research needs an explicit budget/source/activation decision; do not borrow Website Builder's allowance.

## Release 4 — Capture and team workspaces

- [ ] Phone-friendly encounter capture with optional details, meeting context and an explicit introducer selector. Reuse existing manual prospect duplicate checks; add dictation only through the current explicit recording/transcription flow.
- [ ] Preserve NFC/QR campaign attribution independently of introducer, appointment setter, salesperson and account manager. A shared link cannot establish an agreement or overwrite credit.
- [ ] Offer focused default views for appointment setting, selling/development and finance within the same system. View filters are not security boundaries; enforce access in services.
- [ ] Add permitted structured discovery/introduction/handoff actions to both native assistant and Operations MCP coverage. Keep company knowledge current with actual roles and approved service guidance.

## Release 5 — Ongoing services and measured outcomes

- [ ] Track active services/automations, deployment references, owner, health, incident follow-up, agreed review cadence, usage/cost and renewals.
- [ ] Distinguish measured document throughput/time savings from estimates; retain baselines and calculation assumptions. Do not fabricate ROI from a sales amount.
- [ ] Bring service reviews and meaningful exceptions into existing My day/assistant routines. Opt-in notifications and current permissions remain in force.

## Completion and resume rules

Finish and verify each coherent release before broadening the implementation. Record the exact implemented scope, tests, commit and remaining gates below. Do not label the entire program complete after release 1. Do not restart completed Mail, SEO, calling or builder setup because older documents have historical blockers.

Current next step: Release 2 policy/design with Conner and Austin, then the referral agreement/earnings ledger. Release 1 local verification is complete; verify production after the normal Render deployment. Revenue-share decisions and financial permissions remain unresolved; no payouts or new access are authorized by this plan.

## Delivery record

- Release 1 implemented: protected relationship overview, record links, internal handoffs/My day queue, five assistant changes and three reads; additive migration `0063_relationship_handoffs.sql`.
- Verification: 40 focused PostgreSQL/Operations cases passed; six desktop/phone journeys plus two dark-mode journeys passed, including accessibility/overflow checks. Full suite: 833 passed, 658 environment-dependent skipped (focused database suites run separately). Lint, TypeScript, production build, capability inventory and whitespace checks passed. Synthetic data/providers only; no real messages or paid AI requests.
- Release 1 source and local verification are complete in the accompanying main-branch commit. Production authenticated acceptance remains separate; this record does not claim a deployed version.
- Repository visibility was verified as public. Exact owner-supplied compensation rates are retained in a private local note outside the repository, not in public site content or committed documentation. Obtain the owner's protected agreement details when implementing Release 2; do not guess from this generic plan.
