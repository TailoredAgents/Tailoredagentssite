# Website Builder evidence records

These files support the [quality plan](../WEBSITE_BUILDER_QUALITY_PLAN.md). They do not certify that a generated site is beautiful or that live generation is reliable.

The [recorded original baseline](baseline-2026-10-28-v1.json) completed all ten cases: eight passed the automated checks; the compact trades and minimal unknown-business cases retained `thin_page` findings. Human scores remain empty. The first five preexisting cases also passed under the untouched original runner. An initial expanded run stopped on an evaluator-only logo-preparation error; its files are retained, and the corrected rerun used identical cohort inputs. The detailed ledger preserves this distinction rather than counting the harness error as a production failure or discarding it.

The [identity release comparison](identity-comparison-2026-10-28-v1.json) reran the same ten plans/blueprints with derived identity enabled: four identity assets per case, no new detected issues, and the same eight passes/two thin-page negatives. A final rerun after tightening head-boundary validation produced identical artifact bytes; the earlier identity run remains in the ledger. Source hashes stayed unchanged during each completed run. This establishes local identity integration without a renderer regression in this cohort; it does not establish better human design scores, real social-app display or unattended generation quality. Full local artifacts remain outside the repository.

After the recorded final comparison, an isolated optional photo-free identity-helper branch was added and covered by focused identity/export tests plus a Linux image-decode check. It does not change the photo-backed cohort artifacts or the renderer's required hero-image contract. The comparison ledger retains the exact earlier source hashes; it is not represented as a run of that later branch.

The [P3 comparison](p3-comparison-2026-10-28-v1.json) reran all ten frozen cases with identity enabled after the design-direction, renderer and content-check changes. All plan/blueprint hashes match the frozen manifest. Eight cases passed; compact trades and company `None` retained only their prior `thin_page` findings. No new browser, content or delivery findings appeared. All forty derived identity assets remained byte-identical to the identity release; rendered HTML/CSS changed. The final run saved 160 site artifacts and 48 desktop/phone screenshots with stable source hashes. It ran once after the final fixes, preserving the [earlier completed P3 run](p3-comparison-2026-10-28-v1-r1.json); both runs produced identical site artifact bytes. The final ledger records the source differences and both report hashes. These checks show local regression behavior, not improvement in AI-generated designs: no provider requests were made, human scores remain empty, and the new prompts still require fresh human-approved live builds and actual design assessment.

## Frozen free cohort

`cohort-2026-10-28-v1.json` freezes ten synthetic cases, their exact plan/blueprint SHA-256 hashes, five tuning/five held-out assignments and the existing six-dimension rubric. The original renderer baseline is commit `194da47fa5e906caed55634ccf9bd8bbde6c7a35`. The cohort covers trades, wellness, hospitality, professional services and unknown businesses. Two trades briefs intentionally have different scope, composition and emphasis. Other cases cover company `None`, uncertain directory matches, missing websites/contact/logo/photos, a long name, substantial copy and very little copy.

These conditions describe hand-authored **approved render inputs**. This run does not test whether research will discover an industry, whether the planner will correctly interpret `None`, or whether the generator will choose a good composition. Workflow tests and real-provider acceptance must establish those separate claims. Candidate facts remain internal to the synthetic brief; no real customer record or contact detail is required.

Keep the ten inputs, rubric and split fixed. Do not pad a weak held-out case or erase a failed run. Change the tuning implementation, compare all outputs, and record negative findings. If a fixture itself is invalid or a new population is needed, make a new cohort version with an explanation; preserve v1. The unit test detects silent changes to frozen plan/blueprint bytes. Holding out a fixture protects against deliberate tuning to that brief; it is not evidence of independence when every case has already been inspected repeatedly.

Run free local checks from the repository:

```powershell
node --conditions=react-server --import tsx scripts/evaluate-factory-benchmarks.ts "$env:TEMP\ta-quality-new-run" --cohort
```

For the identity release, add `--identity`. This creates local icons/cards with no AI requests and uses a reserved synthetic HTTPS base URL in metadata. It does not publish that URL. Without the flag, no identity module is loaded, so the same evaluator can run against the archived original renderer.

The output directory must not exist. Each run saves portable site files, every tested desktop/phone screenshot, exact plan/blueprint, QA findings, delivery/lab observations, all artifact/screenshot hashes, and **unfilled** human reviews. `provenance.json` captures source-file hashes, renderer/prompt files, model policy, package lock, tool versions, manifest and Git revision. Models invoked and provider cost are explicitly zero. Source changes during a run are flagged; an unstable-source run is diagnostic only. Timing is unthrottled, in-memory Chromium, not Lighthouse or field Core Web Vitals.

## Reproduce the original renderer

Archive exact baseline commit `194da47fa5e906caed55634ccf9bd8bbde6c7a35` into a new temporary directory, install that lockfile's dependencies (or use the identical local dependency tree), then overlay only `scripts/evaluate-factory-benchmarks.ts` and `lib/factory/site/quality-cohort.ts` from the evaluation release. Do not overlay renderer, prompts, models, CSS or images code. Run with `--cohort --source-revision=194da47fa5e906caed55634ccf9bd8bbde6c7a35` and without `--identity`. The reported exact source hashes document the two-file evaluation overlay as well as the original implementation. Browser/tool versions must be compared when interpreting differences.

For a current release, run in a clean checkout without `--source-revision`. Never use the explicit revision option to disguise a modified implementation. The runner's source hashes and dirty-file list remain part of the evidence.

## Private real-build records

Copy `acceptance-result-template.json` to private, backed-up storage for each eligible approved build. It contains no sample client data, scores, successes or ledger entries. Set `recordKind` to `real-lead`, `approved-synthetic-provider-case`, `saved-artifact-replay`, or `synthetic-renderer-fixture`. Only eligible real leads belong in the real-lead completion denominator. Preserve failures, budget stops, uncertain charges and manual interventions. A hand-fixed output can be useful to sales but is not an unattended success.

Keep customer research, contact data, production identifiers, screenshots and private URLs out of committed public reports. Use opaque record references for summarized results. Save actual human reviews in `humanReviews`; `humanReviewTemplate` is only a blank shape. No reviewer means no human score or send-worthy judgment. Record independent blind votes, concrete weaknesses and disagreements before reconciliation. AI ratings do not count as human votes.

Real-channel sharing requires observing the intended app's card separately from anonymous HTTP metadata checks. Do not send a message or post to a channel without explicit authorization. Fresh real builds also require the ordinary exact human plan approval and sufficient remaining research/build budgets; this template grants neither.
