# Website Builder quality upgrade — October 27, 2026

Ongoing policy: [shared Website Builder standards](WEBSITE_BUILDER_STANDARDS.md) now carry the general lessons from this pilot into planning, generation and review. Individual client choices remain specific to their approved plan.

## Authorization and objective

Austin approved implementation after comparing the system's Cosmo v3 (~65/100 subjective prospect impression) with his handmade Cosmo mockup (~90/100). These are human impression benchmarks, not measured conversion or performance scores. Goal: consistently client-ready, distinctive sites with a simple salesperson workflow. Do not claim that implementation alone proves generated sites reach 90.

Reference: https://cosmos-heating-air.onrender.com/ . Existing generated preview: https://tailored-agents-site-previews.onrender.com/p/cosmos-heating-air-v3/ . Use composition, identity, concise benefit-led copy and varied imagery as references; do not copy unverified business claims into a new approved plan.

## Preserve

- Any lead can be researched and planned; no mandatory business name, website, location or industry.
- Lead → review/discuss direction → exact human plan approval → build → open/share.
- Research/planning $25/month; builds/images $50/month and $5/site maximum. Keep existing reservations, uncertain charges, bounded retries and prior working previews.
- Actual source/asset export and shared Render preview hosting.
- No automatic paid rebuild of Cosmo's or other existing approved/ready projects just to demonstrate the upgrade. A materially changed creative direction needs a new reviewed plan.
- Visitor chatbot and finished-site editing copilot remain separate follow-on work; this release is the design/review quality foundation.

## Implementation checklist

- [x] Broaden creative research/planning guidance: audience benefit, brand direction, purposeful pages, authorized asset opportunities, uncertainty internal.
- [x] Version-compatible presentation/media schema: supplied logos/photos, distinct hero/section images, purposeful compositions and locally bundled licensed fonts.
- [x] Durable image slots with bounded generation, snapshots of approved uploads, retry reuse and provenance/export.
- [x] Premium responsive rendering, service tabs/gallery/story layouts, exact semantic Call/Email/Contact actions.
- [x] Human-calibratable quality rubric, useful screenshot closeups, bounded targeted corrections, purpose-based copy review.
- [x] Actual resource accounting including fonts/multiple images, accessible browser interactions and honest lab measurements.
- [x] Several industry/sparse-input fixtures, desktop/mobile visual inspection, functional/security/approval-budget regressions.
- [x] Deployment verification and explicit remaining pilot work. Existing immutable previews preserved.

## Research applied

- v0 documents reusable design systems and browser critique/iteration: https://v0.app/docs/design-systems-2 and https://v0.app/docs/agentic-features . We are implementing these principles in our own portable system, not moving hosting or buying another service.
- OpenAI recommends task-specific evaluations, reference/pairwise comparisons and calibration with human judgments: https://developers.openai.com/api/docs/guides/evaluation-best-practices . Use our own benchmark harness, not the deprecated hosted Evals platform.
- Google Core Web Vitals: https://web.dev/articles/vitals . Resource budgets and deterministic local checks do not establish real-user field performance.
- New strict structured-output fields must all be required (nullable for absent choices); preserve parsing of older saved responses: https://developers.openai.com/api/docs/guides/structured-outputs .

## Resume log

- Started from clean main `44ff36e`, synchronized with origin/main. Work divided among renderer/design, assets/durable worker, evaluation/benchmarks; root handles schema, creative prompts, security boundary, integration and release.
- Actual root cause: fixed structured site assembler, single repeated hero, system-font-only styling, review restricted to these capabilities; existing screenshot review and repairs already exist and must be improved rather than duplicated.
- Implementation is complete. Final release checks and live verification are recorded below. No new paid website generation or build approval has been submitted for this upgrade.

## Implemented behavior

- New builds use explicit presentation version 1; older stored responses, paid image checkpoints and immutable completed exports remain usable. A repair may improve legacy typography/layout using its existing hero without requesting new imagery.
- Optional uploads distinguish a real logo from business photos, with a short optional description. Approval freezes roles, descriptions and upload IDs. No lead field or upload becomes mandatory. The first supplied photo remains the hero; a logo is never stretched into a hero.
- A site can use a hero and up to four supporting assets, including at most one provided logo and two extra generated photos. Each paid image is independently reserved, hashed and saved before the next request. Retry reuses successful slots. Retained image prompts/identities stay fixed during repair; public alt text/captions can be corrected and an unsuitable supporting asset can be removed without buying a replacement. Earlier charges remain counted.
- Licensed local DM Sans, Manrope and DM Serif Display subsets ship inside exports with their licenses. Exact font bytes and declarations are validated; no third-party font request is added.
- New layout options include photo grids, alternating image/story sections and keyboard-accessible service tabs. Hero, section and item placements are explicit; unavailable placements fail before image generation. Call and Email labels resolve to actual approved contact channels. Explicit internal links retain their configured targets.
- Reviews score first impression, composition, imagery, writing, business usefulness and mobile presentation. The initial target is 85 overall with a 75 dimension floor. Scores are fallible AI judgments requiring human calibration, not certifications or proven client ratings. Up to four readable screenshot crops supplement full-page views; existing repair/request caps remain.
- Photos share a conservative 450 KB mobile allowance when multiple slots exist, while the existing 800 KB per-page resource gate counts actual selected images, CSS, scripts and fonts. Local paint/layout observations are saved separately and are **not** real-user Core Web Vitals or a mobile network speed test.
- Salespeople still review/discuss the plan, approve once, then use Open website / Copy preview link. Optional assets and quality details remain secondary disclosures.

## Repeatable free benchmarks

Run `node --conditions=react-server --import tsx scripts/evaluate-factory-benchmarks.ts [outputDirectory]`.

Five cases cover trades, wellness, hospitality, professional services and sparse unknown-business input. Each emits portable files, desktop/mobile screenshots, actual delivery checks, a report and an unfilled human-review scorecard. The fixture artwork is intentionally synthetic, and no provider request is made. All five cases and 26 page/viewport captures passed local checks. Root visually inspected the trades desktop/mobile output; renderer review also inspected wellness desktop and professional mobile. Separate renderer cases cover all six supported families, including editorial.

These fixtures prove supported rendering and checks, not that live generated sites now score 90. Next pilot: prepare a revised Cosmo direction, let Austin review/approve it, inspect the resulting real desktop/mobile build against his reference, and record quality, latency and actual spend. Repeat on different approved industries before claiming consistency.

## Verification and release

- Desktop/phone salesperson suite: 12 scenarios passed across the initial eight successful cases and four targeted reruns after updating obsolete upload-label expectations. Logo role/description transport, scorecard disclosure, accessibility, overflow, approval, exports and sharing were covered.
- Independent review fixed explicit contact-target precedence, ambiguous logo names, unsupported item-image placements, long-name mobile overflow, paid-image caption repair and legacy presentation repair.
- A parallel test run accidentally shared the disposable build database and was invalidated; final database verification is performed with one owner. No production database was used by tests.
- Final isolated comprehensive suite: **258 tests passed across 26 files**, including all three planning/worker/build PostgreSQL integration suites. Lint and the production build (including TypeScript) passed. The expanded 100 KB QA report bound was tested with a ten-page scorecard/resource/lab report and an oversized rejection.
- Source `b92b7a5ce6c829604e2b445b1c782bc9dc1731b5` is verified as the last successfully deployed commit on both Render services: [CRM deployment](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbggaq7b9u1s73aij65g) and [builder deployment](https://dashboard.render.com/cron/crn-dbfth6uk1f9s73amh7ig/deploys/dep-dbggaqfb9u1s73aij720). CRM logs confirmed migration `0033_factory_brand_assets.sql` applied. Health, the existing Cosmo v3 short link and its CSS returned HTTP 200.
- Signed-in inspection verified the existing ready v3 remained available and the upgraded Optional logo & photos controls appeared. A planning-only request was saved at 4:14 PM EDT to prepare Cosmo v4 with the new capabilities, superseding the old one-image/inquiry-instructions brief. The returned proposal described five pages but its structured page list contained only Home. Human review caught this before any approval/build. A correction request asks for all five explicit page entries; a narrow page-count consistency guard and concise-page planning guidance are included in the follow-up release. Final handoff evidence follows.
- Corrected Cosmo **plan v5** returned at 4:21 PM EDT. Signed-in review verified separate Home, Services, Service Areas, About and Contact entries; the two exact demo forms, richer imagery, sans-serif direction, contact links and unchanged budgets are present. It is **Ready to review**, with **Approve plan & build website** available. No new build was approved. Website v3 remains the last working preview. Handoff screenshot: `C:/Users/xenon/.codex/visualizations/2026/10/27/cosmos-plan-v5-ready.png`.
- Follow-up also permits removing unsuitable saved supporting media during repair while rejecting replacement/new imagery. Previously incurred charges stay counted. Planning consistency checks apply only to clear current page-count declarations; sparse plans, optional future scope and unchanged previous versions remain supported.
- Follow-up verification: **268 tests passed across 26 files**, including all three PostgreSQL integration suites; lint and the production build passed again. The previously completed 12 salesperson browser scenarios and five free visual benchmark cases remain the UI/rendering evidence. No paid website generation was performed during these checks.
- Final code release `ddc06c315b6d86d4c91c04e31bf8b4bc3e2608e4` was verified as the last successfully deployed commit for both CRM and builder in Render. The remaining step is Austin's review/approval of corrected plan v5, then assessment of that actual generated site. Approval screenshot: `C:/Users/xenon/.codex/visualizations/2026/10/27/cosmos-plan-v5-approval.png`.

## Cosmo approved-plan palette recovery

Follow-up: [October 27 full builder audit](WEBSITE_BUILDER_AUDIT_2026-10-27.md) records the later renderer/recovery fixes, private failure diagnostics, preview-host burst handling and remaining engineering priorities.

- Austin approved plan v5, creating website v4. It stopped during generation with `Website palette text must have at least 4.5:1 contrast on its backgrounds`.
- Root cause is our approved-palette parser: `Muted: slate #52616B, contrast-tested on its surface` was mistaken for a surface, and `AccentSecondary: warm amber #F3AD46 for restrained highlights with dark text` was mistaken for body text. This was an application parsing defect; the contrast gate correctly rejected the resulting colors.
- Fix: explicit leading palette role labels take precedence over descriptive prose and legacy color-name heuristics. Inaccessible explicit colors still fail the same 4.5:1 validation. Added exact-plan parsing and saved-response recovery regressions.
- Recovery uses the same approved plan and saved original generation response. It does not request another paid design generation; subsequent image/review work remains subject to the existing allowance. Deployment/recovery results follow once verified.
- Verification: all 270 Factory cases passed across the comprehensive run and targeted 38-case build-integration rerun after correcting immutable-plan fixture setup. The recovery test proves generate → images without provider invocation, unchanged settled cost, same approved plan/version and private saved-response handling. Lint and production build passed. No accessibility threshold or spending limit was relaxed.


## Cosmo v5 follow-up � October 27, 2026

The human-approved plan v7 produced website v5 (`8fa770b3-f9c1-4540-8c2b-1044c72c0696`). Its failed review at 6:03 PM EDT scored 78 overall and identified two renderer defects: studio headline emphasis still selected italic serif, and Contact retained an oversized sequential channels/form composition. Shared prompt standards alone had not corrected those code defaults.

Release `3522ddc53da186a3ae53a24681ab5119ff3d17d7` was verified live on both CRM and builder. It keeps studio/technical emphasis sans, compacts text-only inner introductions, and groups adjacent Contact channels/form sections while preserving their content, identifiers, form fields and actions. Browser regressions verify typography, mobile/desktop layout, original anchors, demo-form behavior, accessibility and detailed QA crops. Lint, TypeScript and production build passed. No new site or image generation was used to test the fixes.

One explicit technical recovery rerendered v5 from its saved content/assets. The live review at 6:20 PM EDT improved to **80/100**, but still blocked publication: repetitive Contact guidance and introductions, oversized closing bands and coverage-page spacing; writing scored **72/100**. The result is not ready and the quality target remains 85 overall with a 75 dimension floor. V3 remains the last working preview. No attempt/repair counter or charge was reset.

The remaining copy cannot change through Retry: this version has used its included repair, and retry only rerenders/rechecks saved content. A planning-only request for v8 was saved at 6:23 PM EDT, retaining five pages, exact two forms, service actions, palette, evidence boundaries and existing budgets while requiring concise Contact/coverage/closing copy. It must receive exact human approval before a new build. Do not keep spending reviews on unchanged wording.

Product gap: there is no supported editor for a failed draft blueprint. The future editing workflow should allow audited, bounded corrections to saved content/assets, show the diff, preserve plan scope/charges, and require fresh QA before publication. It must not reset review limits or silently publish an unchecked artifact. Until that exists, copy revisions use planning and human approval; this is a workflow limitation, not a claim that the current pipeline reliably produces top-tier results.

The follow-up renderer changes correct direct-only closing bands (their second column had been reserved for a nonexistent form), compact non-Contact form headings and immediately preceding image-free, itemless explanations, and preserve all copy/actions/assets. Plan **v8** completed at **6:26 PM EDT**. Signed-in review confirmed five distinct page entries, seven valid CTA summary entries, exact five-/four-field forms, fixed honest demo behavior, concise Contact/coverage/closing requirements and unchanged budgets/evidence boundaries. It is **Ready to review** with **Approve plan & build website** available. No new website was approved or built. Proof: `C:/Users/xenon/.codex/visualizations/2026/10/27/cosmos-plan-v8-review.png`.

Final follow-up verification: **244 tests passed across 25 files**; 64 database integration cases were skipped because no test database was configured for this renderer-only release. The new browser suite includes 16 cases and full five-route desktop/mobile accessibility checks. Lint, TypeScript and the production build passed. Remaining live v8 website quality is unverified until human approval and generation.
