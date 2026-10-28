# Website Builder: salesperson-operated workflow

**Quality roadmap:** [consistent quality, identity and sharing](WEBSITE_BUILDER_QUALITY_PLAN.md) tracks identity/sharing implementation and the staged real-build acceptance required to earn confidence. See [identity release notes](WEBSITE_BUILDER_IDENTITY_SHARING.md) for the completed first slice. Its proposed targets are not achievements of the deployed slice recorded below.

## Product goal

Austin clarified on October 27, 2026 that a manually polished Cosmo preview is not the goal. A salesperson must be able to take a new lead to a useful hosted mockup without Austin or Codex operating the builder or editing the website for them. Manual draft editing is optional refinement, not the normal completion path.

1. A new Facebook, website or manually entered lead creates one research project automatically.
2. Research uses available lead details and shared notes, identifies likely industry/context, and produces a proposed website plan. Missing company names, websites or other facts do not block a provisional concept. Possible matches remain separate from established facts.
3. A salesperson receives a **Plan ready** item in Website Builder and My Day. They can add direction in planning chat, review the revised proposal, and approve its exact current version.
4. Background workers build pages, prepare images, check desktop/mobile output, apply supported corrections, publish and verify the hosted files. The salesperson can close the browser.
5. A **Website ready** item links back to the project, where the salesperson opens the site and copies its short preview URL. Source export remains available.

Active workspace Members can operate this workflow; it does not require Austin's Owner account. Owners manage settings and budgets. Viewers cannot approve, edit, or dismiss work items.

## October 27 implementation

- Live **Research new leads automatically** was off. It is now enabled and saved in production, within the existing **$25/month** research allowance. This affects new intake only; it does not backfill old leads or approve any website. [Settings proof](previews/factory-auto-research-enabled.png).
- Automatic correction now returns up to twelve targeted section patches together instead of rewriting the entire blueprint. It can change headings, body copy, item wording and supported existing section layouts. Routes, forms, destinations, contact channels, images and the approved design recipe remain fixed.
- Each version has at most **two correction requests and three visual-review requests**, sharing the original approval's **$5/site** and **$50/month** build allowance. These are limits, not promised spend or guaranteed completion. Each request reserves its own allowance; a correction does not reserve a future review in advance. Budget exhaustion preserves the saved work.
- Correction requests save their attempted state and raw response before application. Saved responses replay against matching draft/finding fingerprints without another provider charge. Corrected drafts requeue for a fresh QA lease. Unchanged output, repeated unresolved findings, unknown request outcomes and exhausted limits stop further automatic requests. Historical attempts and uncertain charges remain counted.
- New reviews identify the actual correction page/section, independently of positive evidence cited elsewhere. They distinguish supported content/layout fixes from technical or scope changes. Quality thresholds remain 85 overall and 75 per dimension; neither a model score nor fixture tests guarantee customer appeal.
- Durable internal work items cover **Plan ready**, **Website ready**, and **Needs attention**. They follow the current project state, deduplicate repeated worker runs, resolve superseded work, and disappear with deleted/anonymized leads. They route to an active lead owner, with an active requester/approver/creator fallback; otherwise they belong to the team. These are CRM work items, not SMS, email, or browser push notifications.
- Work-item reconciliation runs after scheduled planning/build work and on Website Builder/My Day reads. A notification failure does not turn a completed paid job into a failed job.

Migration: `0035_factory_work_notices.sql`. No additional hosting, DNS, model, credentials, subscriptions, or budget changes are required. No Cosmo plan, approval, site or preview is changed by this release.

## Acceptance and remaining work

The new local journey tests use three synthetic scenarios: sparse wellness/beauty context, professional services, and unknown industry. They run real lead intake, research/planning persistence, planning chat, Member authorization, exact-version approval, correction, publication/verification bookkeeping and ready notices. Provider responses, images, browser QA and hosting are injected test dependencies. This establishes workflow behavior, not real model research accuracy or visual quality.

The next quality acceptance must use at least two fresh, separately human-approved leads in different industries. Let the normal workers finish without manual copy or renderer intervention. Record elapsed time, actual ledger usage, corrections, failures, desktop/mobile appearance and shareability. Do not describe the manually refined Cosmo v9 as proof of unattended generation.

Remaining engineering work after this slice:

- Safe automatic recovery for known resumable infrastructure interruptions, with bounded backoff. Expired worker leases and some temporary provider/storage/verification failures still require explicit recovery; ambiguous paid requests must never be blindly repeated.
- Worker heartbeat/queue-age health so sales can distinguish an ordinary scheduled wait from a stopped worker.
- Expand trusted presentation controls only where repeated real output demonstrates a gap. Arbitrary CSS/code and new scope are not correction permissions. Genuine renderer defects still need a developer fix.
- Calibrate generation and review on actual non-Cosmo results. Do not weaken the quality gate to manufacture successful completion.
- Broader website chat editing and the optional visitor chatbot remain separate milestones.

The structured correction response and incomplete/refusal handling follow the [OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs). Application validation still enforces target identity, scope and accounting; schema adherence alone does not prove factual or design quality.

## Release verification

Local verification completed October 27:

- 321 Factory unit/provider tests across 35 files passed.
- 61 real-database build/correction tests passed, including saved-response replay through PostgreSQL JSONB ordering, two correction rounds, cycle detection, ambiguous-request protection and immutable scope.
- 7 work-item database tests passed for routing, deduplication, permissions, acknowledgment, no-change planning replies, superseded work and deletion/anonymization.
- 26 intake/planning/journey database tests passed, including the three new Member-only full journeys above.
- Four desktop/phone browser cases passed: plan/chat/exact approval and My Day/Builder work-item navigation/acknowledgment. Accessibility and horizontal overflow checks passed. [Desktop proof](previews/factory-work-updates-desktop.png), [phone proof](previews/factory-work-updates-phone.png).
- Lint, TypeScript and the production build passed. Independent code reviews found no remaining release blocker.

All provider work above was synthetic and local. Production release and readback are recorded separately below; no live plan was approved, retried or regenerated during this work.

### Production readback

- Implementation commit `42222e7d13f497f69777d705abcaf9601c195ddd` is live on both services. Render reported successful [CRM deployment](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbgkgu29lscs73fjjajg) and [builder worker deployment](https://dashboard.render.com/cron/crn-dbfth6uk1f9s73amh7ig/deploys/dep-dbgkgua9lscs73fjjbi0); both displayed that commit as the last successfully deployed version.
- The live Website Builder and My Day pages displayed the new website-ready work item and its direct project link. The existing Cosmo preview was unchanged; this item demonstrates reconciliation of saved state, not a new unattended build. No production work item was acknowledged during verification. [Live Builder proof](previews/website-builder-automation-live.png).
- The public `/api/health` endpoint returned HTTP 200 and `status: ok` after deployment. The live work-item query also confirms migration `0035` is available to the CRM.
- Fresh-lead real-provider acceptance remains outstanding as described above. Deployment, mocked journeys and a saved preview notice must not be presented as proof that a new generated website met the visual standard without intervention.
