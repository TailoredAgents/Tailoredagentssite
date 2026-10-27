# Website Builder audit — October 27, 2026

## Scope and constraints

Austin requested an end-to-end audit and fixes after the approved Cosmo plan encountered a palette-parser defect. Starting release: `0614025`. Review includes research/planning contracts, approved inputs, generation, imagery, rendering, browser/design QA, spending, recovery, uploads, isolated preview hosting, exports and the salesperson workflow.

Keep exact human plan approval; sparse leads remain supported. Preserve $25/month research and $50/month/$5 per-build limits, accounting for earlier/uncertain charges, maximum review/retry counts, existing working previews and accessibility checks. No new paid test builds or outside subscriptions are authorized by this audit. Recovery of the existing approved Cosmo build can proceed inside its remaining allowance.

## Live evidence

- Cosmo project `7663f9da-2652-46b5-93dc-74881ea1d39e`: plan v5 was approved by Austin and became website v4.
- The palette fix deployed as `0614025` to CRM and builder. Explicit recovery reused the saved design response and advanced to Images at 4:55 PM EDT without another design-generation request.
- The build subsequently completed Images, then stopped in QA after its included correction. Final review reported that the mobile contact strip covered Home imagery and all four inner pages inherited the Home hero despite intended compact introductions. Existing website v3 remains available.

## Confirmed findings and implementation log

| Priority | Finding | Impact | Status |
| --- | --- | --- | --- |
| High | Renderer unconditionally inherits Home hero on inner pages | Generated instructions cannot express a text-only inner introduction, so paid correction cannot satisfy review | Fixed for presentation-enabled builds; explicit inner imagery remains supported |
| High | Mobile contact controls overlay content | Controls cover imagery/captions and can repeatedly fail review | Fixed for presentation-enabled builds with normal-flow controls and deterministic overlap check |
| High | Paid repair response lacks durable checkpoint before local validation | A local validation defect can consume the sole repair without a recoverable response | Fixed: checkpoint/replay against original blueprint hash, no extra repair request |
| Medium | Failed QA has no inspectable screenshot/report in the CRM | Diagnosis relies on a truncated two-issue error message | Fixed: private bounded diagnostics and screenshots, never a shareable failed preview |
| Medium | QA failure always sends salesperson to a new plan | A renderer fix can recheck the saved design but UI hides administrator recovery | Fixed: bounded administrator recovery; existing limits still enforced |
| Medium | Exhausted failed build permanently locks its uploaded logo | User cannot replace the logo for future versions when recovery is no longer allowed | Fixed; queued/running/recoverable builds still protect snapshots |
| Medium | Four-request preview limit rejects normal asset bursts | CSS, fonts or images can fail for ordinary visitors | Fixed: four active requests plus a bounded 24-request/5-second waiting queue |
| Medium | Late provider requests can outlive the worker lease | Paid responses may arrive after the worker loses permission to checkpoint | Fixed: require four-minute deadline plus 30-second checkpoint margin before reserving and attempting |
| Medium | Repair instruction truncation can omit blocking errors | Optional warnings can occupy the bounded correction prompt | Fixed: errors precede warnings within the existing 20-issue limit |
| Medium | Page matching allows additional unapproved pages | Build may exceed the approved page scope | Fixed: one-to-one alias matching now rejects unexpected page identities too |
| Medium | Hidden service-tab panels escape accessibility checks | Inaccessible revealed content may pass the initial-page scan | Fixed: bounded axe scans for each revealed panel |
| Medium | Renderer adds default links/contact lists beside explicit actions | Repetition contradicts the intended design and wastes the correction on immutable defaults | Fixed: honor configured service actions; include each direct channel once across contact sections, retaining missing channels and unconfigured service fallbacks |
| Medium | Hero captions overlay detailed imagery | Small disclosure text becomes hard to read | Fixed: presentation-enabled hero captions occupy their own readable strip below the hero |
| Medium | Exhausted visual reviews still offer administrator retry | A retry cannot purchase another review and sends the user through a futile loop | Fixed: expose only the bounded review count; direct exhausted quality failures to revised-plan review; unrelated publish/verification failures remain recoverable |

## Checks already present and preserved

- Exact latest-plan approval, immutable approved content/uploads, workspace authorization and server-side permission checks.
- Budget reservations, retained uncertain charges, bounded explicit retries, saved generation/images and frozen checked artifacts before publication.
- Separate preview origin, local-only generated assets/scripts/fonts, escaping and HTML/CSS/file-path validation, authenticated private artifact downloads.
- Pending upload recovery after 15 minutes and two-pass storage cleanup already exist; this is not a new defect.
- Desktop/mobile browser checks, demo-form behavior, local links, serious/critical accessibility checks, resource budgets, screenshot review and a scored rubric.

## Validation and remaining evidence

- Full Factory suite: **283 tests across 26 files passed**, including the three isolated PostgreSQL integration suites. A single root-owned run used disposable databases, never production.
- Preview service: **14 real local HTTP tests passed**, covering burst admission, bounded overflow, timeouts/disconnects, authorization, paths, hashes/revocation and storage limits. The reproduced eight-request burst improved from four successes/four 503s to eight successes, with processing concurrency capped at four.
- Lint, TypeScript and production build passed. Independent review found no blocking issue in the private diagnostic projection or correction recovery tests.
- Five free industry/sparse-input benchmarks passed with zero reported issues and 26 desktop/mobile captures. Root visually inspected the trades Home and Services mobile output, confirming separate contact controls and compact inner introduction.
- **14 desktop/phone salesperson scenarios passed**, including private failed-review screenshots, bounded administrator recovery, accessibility/overflow, sparse-lead planning, approval, preserved drafts, progress, source download and sharing. The local development server logged two aborted-stream messages during deliberate reloads; all assertions passed. No production session/database was used by these tests.
- Live deployment/recovery results follow below.

## Release and live verification

- Fix commits: `7d5e723` (bounded preview request queue) and `9b85761` (builder audit fixes). A concurrent documentation-only update `fd8edaf` was merged without rewriting shared history. Release `a05ca0bde278d185da7f2bd037a5cbbd3ddf9dfb` is verified as the last successfully deployed commit for CRM, builder and preview/storage services.
- CRM health, the existing v3 short link and eight concurrent public CSS/runtime/image requests all returned HTTP 200 after deployment. This is a small smoke check, not a load certification.
- At 5:16 PM EDT, administrator recovery requeued the same Cosmo website v4 / approved plan v5. The worker was triggered at 5:17 PM and reached corrected-page QA at 5:18 PM. No new plan was approved, and no spending/review/correction limit was reset. Final result follows.
- The third review cleared the original hero-inheritance/mobile-overlay findings but still failed: **AI assessment 82/100 against the 85 target**. It reported renderer-added contact lists repeated beside explicit channels/forms, default service links beside explicit topic actions, excessive Contact spacing and a small caption over the hero image. This is an AI assessment, not a measured customer score.
- Root downloaded and visually inspected the private desktop/mobile Home screenshots. The new output is materially richer than v3, with multiple images, service-topic cards, a process section and FAQs; inner-page repetition and spacing still prevent calling it finished. The private report is visible in the CRM. The previous v3 preview remains available; v4 is not published.
- Follow-up addresses deterministic duplicate actions/channels and caption placement. The UI recognizes an exhausted visual-review allowance before offering another technical retry. **Do not retry v4 again or reset its three reviews.** A further generated revision requires a revised plan and human approval.
- Follow-up combined verification: **287 tests across 26 Factory files passed**, including all three disposable PostgreSQL suites; lint, TypeScript and production build passed. The tests cover explicit/partial channel deduplication, preserved configured/unconfigured service actions, and desktop/mobile caption geometry. Both targeted desktop/phone exhaustion-screen scenarios also passed. Final release verification follows.
- Final code release **`8a08a94ec41d53afa0deda12ce5f0b1a4dfdc6a4` is verified live on CRM, builder and preview/storage**. The signed-in Cosmo project now explicitly says all three visual reviews were used and directs to revised-plan approval; the futile administrator retry is absent. Failed quality findings and private screenshot downloads were verified. Live evidence: `C:/Users/xenon/.codex/visualizations/2026/10/27/website-builder-audit-live-result.png`.
- No further build/research request was made after the third review. Renderer follow-ups apply to future approved builds; the audit does not claim that the revised renderer has earned a new live AI score. Existing published bundles remain unchanged.

## Cosmo revised-plan handoff — 5:51 PM EDT

- Austin authorized preparing the next proposal after the audit explanation. The live project now has **plan version 7, Ready to review**. No new website build was approved or started; exhausted website v4 was not retried, and ready website v3 remains the existing preview.
- Plan v6 introduced the focused revision: a compact Contact page with one direct-channel group and one form, specific service-topic actions, compact inner introductions, below-image captions, normal-flow mobile controls and tighter spacing. Review caught one malformed action instruction; v7 corrects it to seven valid plan-summary entries, with three distinct Services topic actions retained in the page requirements.
- Verified the returned full v7 proposal in the signed-in CRM: exactly five distinct pages (Home, Services, Service Areas, About, Contact); unchanged five-field Contact and four-field Service Areas demonstration forms, notices, validation and submitted-state confirmations; correct business telephone/email targets and three Home service-anchor destinations. The navy/teal local-sans-serif direction, purposeful imagery, evidence boundaries, desktop/mobile acceptance checks and existing spending limits remain in the plan.
- **Next action belongs to Austin:** review plan v7 and click **Approve plan & build website** in [the Cosmo project](https://www.tailoredagents.com/dashboard/sales/factory/7663f9da-2652-46b5-93dc-74881ea1d39e). After approval, inspect the actual generated desktop/mobile output; plan correctness does not establish the finished site's visual quality.
- Screenshot evidence: `C:/Users/xenon/.codex/visualizations/2026/10/27/cosmo-plan-v7-approval.png`. This handoff changed the live planning record only; no application code or configuration changed.

## Remaining priorities

1. **Reduce avoidable image spend:** run image-independent content/page/fact checks before imagery, with a deliberate path to use the existing single correction. Simply rejecting every imperfect saved generation would strand builds and remove their repair opportunity; do not implement that shortcut.
2. **Split long QA work into separately leased steps:** browser inspection, visual review, correction and final inspection currently share a worker window. The new deadline guard prevents late paid calls but may pause a large build safely for an explicit retry.
3. **Calibrate actual visual quality:** assess this approved Cosmo build against Austin's reference, then approved examples from other industries. Fixture success and AI scores alone do not prove consistently excellent client impressions.
4. **Measure hosted performance:** current Chromium observations are local and unthrottled. Add repeatable hosted mobile/network measurements before claiming real visitor Core Web Vitals. The preview queue handles tested normal bursts, not unlimited traffic; every asset still requires a fresh authorization resolution.
5. **Later product work:** editing copilot and visitor chatbot remain separate milestones after builder reliability and quality validation. Keep secrets server-side, site-specific knowledge and separate spending limits when implementing them.

Residual durability limit: a process can still stop between receiving a paid provider response or image and its first durable checkpoint. Earlier/uncertain charges stay counted; this audit does not claim atomic transactions across the provider, storage and database.

Synthetic/provider-injected tests do not establish real provider latency, consistent visual quality across industries or actual visitor Core Web Vitals. The live Cosmo build is the current approved pilot; additional paid industry pilots require reviewed plans. This audit is a bounded engineering review, not a security certification or a promise of zero defects.
