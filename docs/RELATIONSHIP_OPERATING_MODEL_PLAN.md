# Relationship-led operating model: implementation and resume plan

Prepared November 10, 2026 after Austin authorized a full plan and implementation. Baseline: main `6244e98`; preserve the unrelated generated `next-env.d.ts` change. Work on main and push verified, focused releases. This file is the durable resume point. Checked implementation items mean source and local verification are complete; the delivery record distinguishes publishing, deployment and business activation.

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

## Current continuation authorization

Austin explicitly requested a goal to finish releases 2–5, test, commit and push. He then chose **Conner configures the referral rules before activation**. Implement the complete configurable software; do not guess those policies, seed private rates or activate real finance records. Preserve the unrelated generated `next-env.d.ts` change and the concurrent visual-audit release (`57f2a06`).

## Release 2 — Referral agreements and earnings ledger

- [x] Add a Partners workspace using existing introducer identities, with internal agreements, effective dates and attributable agreement versions. Separate attribution from compensation eligibility.
- [x] Require explicit policy configuration and agreement activation for the definition of eligible documents/services, billing versus collection basis, payment timing, duration, refunds/credits and multiple-introducer rules. **Business activation remains with Conner:** he enters the actual rules; this release seeds no rates, policies, agreements or payables.
- [x] Store document usage and other revenue in separate source-backed buckets. Use stable event IDs, integer money, deterministic calculations, corrections/reversals and immutable statement inputs. Do not apply the non-document percentage to document revenue or count a retried document twice.
- [x] Support draft/reviewed/approved/paid statement states with source drill-down. No automatic money movement. Pipeline value is not collected revenue; AI-generated estimates are not payable transactions.
- [x] Add finance permissions and a bounded partner view before exposing financial details. Devon's own attributed earnings must not imply access to everyone's margins or mail.
- [x] Test duplicate events, refunds, agreement changes, period boundaries, attribution disputes, unauthorized reads/writes and exact payout review. Keep terms private and real accounting imports separately authorized.

## Release 3 — Discovery to solution design

- [x] Present the general Mockup sales stage as Solution design while preserving stored stage keys/history. Keep website mockups contextual.
- [x] Add a staff-editable solution brief: confirmed workflow, systems/access, volumes, baseline, desired outcome, assumptions, proposed pilot, human checkpoints, acceptance criteria, delivery responsibility and support scope.
- [x] Let the assistant prepare drafts from permitted discovery/meetings with source links and explicit unknowns. Do not promise integrations or savings without evidence.
- [x] Reuse current tasks/calendar/project conversion. New automated research needs an explicit budget/source/activation decision; do not borrow Website Builder's allowance.

## Release 4 — Capture and team workspaces

- [x] Phone-friendly encounter capture with optional details, meeting context and an explicit introducer selector. Reuse existing manual prospect duplicate checks; add dictation only through the current explicit recording/transcription flow.
- [x] Preserve NFC/QR campaign attribution independently of introducer, appointment setter, salesperson and account manager. A shared link cannot establish an agreement or overwrite credit.
- [x] Offer focused default views for appointment setting, selling/development and finance within the same system. View filters are not security boundaries; enforce access in services.
- [x] Add permitted structured discovery/introduction/handoff actions to both native assistant and Operations MCP coverage. Keep company knowledge current with actual roles and approved service guidance.

## Release 5 — Ongoing services and measured outcomes

- [x] Track active services/automations, deployment references, owner, health, incident follow-up, agreed review cadence, usage/cost and renewals.
- [x] Distinguish measured document throughput/time savings from estimates; retain baselines and calculation assumptions. Do not fabricate ROI from a sales amount.
- [x] Bring service reviews and meaningful exceptions into existing My day/assistant routines. Opt-in notifications and current permissions remain in force.

## Completion and resume rules

Finish and verify each coherent release before broadening the implementation. Record the exact implemented scope, tests, commit and remaining gates below. Do not label the entire program complete after release 1. Do not restart completed Mail, SEO, calling or builder setup because older documents have historical blockers.

Current work: releases 2–5 are implemented and locally verified; commit/push status is recorded below. The finance-policy decision is resolved as an activation handoff: Conner enters the actual rules before agreements can become active. No real payouts, private rates, grants or agreements are created by this development goal.

## Delivery record

- Release 1 implemented: protected relationship overview, record links, internal handoffs/My day queue, five assistant changes and three reads; additive migration `0063_relationship_handoffs.sql`.
- Verification: 40 focused PostgreSQL/Operations cases passed; six desktop/phone journeys plus two dark-mode journeys passed, including accessibility/overflow checks. Full suite: 833 passed, 658 environment-dependent skipped (focused database suites run separately). Lint, TypeScript, production build, capability inventory and whitespace checks passed. Synthetic data/providers only; no real messages or paid AI requests.
- Release 1 source and local verification are complete in the accompanying main-branch commit. Production authenticated acceptance remains separate; this record does not claim a deployed version.
- Repository visibility was verified as public. Exact owner-supplied compensation rates are retained in a private local note outside the repository, not in public site content or committed documentation. Obtain the owner's protected agreement details when implementing Release 2; do not guess from this generic plan.


## Releases 2–5 implementation record (November 10)

- Partners workspace: explicit finance/bounded partner grants, immutable agreement versions, source-backed document/other-revenue earnings, duplicate and allocation controls, correcting reversals, exact statement review/approval and external-settlement recording. No money movement or real activation.
- Solution design: existing stage key preserved; versioned team briefs, connected citations, explicit unknowns and an editable unsent assistant handoff.
- Capture and daily work: optional-details encounter workflow, normalized contact-match review, original campaign/ownership preservation, separate appointment setter/introducer and saved personal work-focus views.
- Services: client systems, owner/deployment/project/support references, reviews, incidents, usage/outcome evidence, finance-protected provider costs and My day/assistant exceptions.
- Additive migrations: 0064–0066. No new provider, credentials, paid generation, live messages or Cloudflare Mail changes.
- Local verification: 59 focused PostgreSQL/assistant cases passed, including the final service-review change. Full suite: 833 passed, 677 environment-dependent skipped; the relevant database cases were run separately. Production build, typecheck, lint, capability inventory and whitespace checks passed. Browser evidence: 16 desktop/phone operating-model and handoff journeys, six dark-mode journeys, two unsent assistant handoff checks and four existing manual-intake regression checks passed. Accessibility/overflow checks passed on the new workspaces; desktop/phone/light/dark screenshots were inspected.
- Test-harness corrections: select controls are located by their accessible role/name; the development assistant check allows cold-route compilation while preserving the production HTTPS-origin requirement; the old manual-intake heading assertion now matches the established person-first UI. No production authentication or quality checks were weakened.
- This record accompanies the main-branch implementation commit. The final response records its hash and push result. No production authenticated staff acceptance is claimed; no live messages, paid AI requests, finance grants, policies, agreements, earnings or settlements were created.
- Operating guides: [Employee workflow](OPERATING_MODEL_GUIDE.md), [Conner’s referral setup](REFERRAL_LEDGER.md). Remaining real-world activation is policy entry/access verification by the owner and Conner, plus normal production acceptance after deployment.

## Reproduce local verification

Use disposable local databases only. The new integration suite refuses non-loopback databases or any name other than `ta_operating_test`. Other suites enforce their own dedicated database names. Do not run fixture seeders against live data.

```powershell
$env:OPERATING_TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:55443/ta_operating_test'
$env:ASSISTANT_TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:55443/ta_assistant_test'
$env:TEST_RELATIONSHIPS_DATABASE_URL='postgresql://ta_test@127.0.0.1:55443/ta_relationships_test'
npx vitest run lib/relationships/operating-model.integration.test.ts lib/assistant/service.integration.test.ts lib/relationships/handoffs.integration.test.ts
npm test
npm run typecheck
npm run lint
node scripts/assistant/coverage.mjs --check
```

The browser/build checks used an isolated copy without real `.env` files or provider credentials. Seed the existing reporting fixture using `scripts/seed-reporting-preview.mjs` with `TEST_DATABASE_URL` set to the loopback `ta_reporting_browser_test` database, then build that copy with blank provider keys. Keep all localhost fixture credentials out of production.

```powershell
$env:REPORTING_TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:55443/ta_reporting_browser_test'
$env:REPORTING_TEST_PORT='3194'
$env:OPENAI_API_KEY=''
$env:TWILIO_SMS_ENABLED='false'
npx playwright test tests/reporting/operating-model.spec.ts tests/reporting/relationships.spec.ts --config playwright.config.ts
$env:DASHBOARD_TEST_THEME='dark'
npx playwright test tests/reporting/operating-model.spec.ts --config playwright.config.ts --grep 'sparse meetup|finance operator|client service'
Remove-Item Env:DASHBOARD_TEST_THEME
npx playwright test tests/reporting/manual-leads.spec.ts --config playwright.config.ts --grep 'adds a phone-only|adds a person without'
# The assistant OAuth origin correctly requires HTTPS in production;
# this separate configuration uses development-only loopback support.
npx playwright test tests/assistant/solution-handoff.spec.ts --config playwright.assistant.config.ts
```

## Production acceptance and Conner's remaining steps

1. Confirm Render deploys the pushed website commit and additive migrations 0064–0066 succeed through the existing build command. A main-branch push is not itself proof of a live version.
2. With actual staff accounts, verify Capture conversation, relationship solution briefs, My day work-focus/service exceptions, and the new Services/Partners navigation. Confirm a regular teammate has no ungranted financial access and a partner grant exposes only the selected partner's approved records. Do not create test customer messages or financial entries merely to check access.
3. Owner/admin verifies Conner's actual account and explicitly grants finance management if needed. Conner completes [the referral checklist](REFERRAL_LEDGER.md), enters privately agreed terms, and activates the correct agreement only after review. No code or environment variable supplies the real rules.
4. Use real source evidence for later earnings and service measurements. Automated accounting imports, payments, live uptime monitoring and notification activation remain separate work; the software does not claim they exist.
