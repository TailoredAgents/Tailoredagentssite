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

## Remaining priorities

1. **Reduce avoidable image spend:** run image-independent content/page/fact checks before imagery, with a deliberate path to use the existing single correction. Simply rejecting every imperfect saved generation would strand builds and remove their repair opportunity; do not implement that shortcut.
2. **Split long QA work into separately leased steps:** browser inspection, visual review, correction and final inspection currently share a worker window. The new deadline guard prevents late paid calls but may pause a large build safely for an explicit retry.
3. **Calibrate actual visual quality:** assess this approved Cosmo build against Austin's reference, then approved examples from other industries. Fixture success and AI scores alone do not prove consistently excellent client impressions.
4. **Measure hosted performance:** current Chromium observations are local and unthrottled. Add repeatable hosted mobile/network measurements before claiming real visitor Core Web Vitals. The preview queue handles tested normal bursts, not unlimited traffic; every asset still requires a fresh authorization resolution.
5. **Later product work:** editing copilot and visitor chatbot remain separate milestones after builder reliability and quality validation. Keep secrets server-side, site-specific knowledge and separate spending limits when implementing them.

Residual durability limit: a process can still stop between receiving a paid provider response or image and its first durable checkpoint. Earlier/uncertain charges stay counted; this audit does not claim atomic transactions across the provider, storage and database.

Synthetic/provider-injected tests do not establish real provider latency, consistent visual quality across industries or actual visitor Core Web Vitals. The live Cosmo build is the current approved pilot; additional paid industry pilots require reviewed plans. This audit is a bounded engineering review, not a security certification or a promise of zero defects.
