# Website Builder: consistent quality and salesperson independence

Created October 27, 2026. **Status: planned; implementation and live acceptance below are not complete.** Austin requested this plan after confirming that favicons and link-preview images should be standard and that the system must consistently produce impressive websites without Austin or Codex finishing them manually.

## Outcome we are building toward

New lead → automatic research and likely industry identification → proposed website plan → salesperson's optional planning chat → exact human approval → background build, checks and supported corrections → hosted preview with a short shareable link and a polished link card.

The salesperson reviews the direction, approves the plan, opens the result and shares it. They do not configure icons, social metadata, image sizes, hosting, retries or technical checks. Missing company name, website, industry, logo, location or phone must not prevent a useful provisional concept. Research may remain uncertain; an uncertain company match must not become a published fact.

“Consistently amazing” means distinctive, convincing and useful to a prospect on both phone and desktop, delivered dependably through that workflow. It is an outcome to demonstrate across actual builds, not a label earned by adding features, passing fixture tests or receiving an AI score.

## Current evidence and gaps

Baseline: implementation `42222e7`, production verification recorded through documentation commit `d90957b`. See [automation and release evidence](WEBSITE_BUILDER_AUTOMATION.md).

| Area | Confirmed now | Work still needed |
| --- | --- | --- |
| Intake and approval | Automatic new-lead research enabled; planning chat and exact-version approval implemented | Fresh-lead, real-provider acceptance across several input types |
| Design | Six design families, multiple compositions, approved design recipe, local fonts, image slots and supplied branding | Measured variation, persuasive content and consistently strong real output beyond Cosmo |
| Checks and correction | Desktop/phone checks, visual review, at most two scoped corrections and three reviews per version | Human calibration, wider viewport coverage, supported recovery from common interruptions |
| Identity and sharing | Page title and description | Favicon, touch icon, branded sharing image, social metadata and anonymous public sharing verification |
| Performance | Asset byte budgets and isolated, unthrottled browser observations | Reproducible throttled tests against hosted pages; real-device observations |
| Sales handoff | Website Builder/My Day updates, preview link and source export | Independent salesperson acceptance and clear stalled-worker diagnosis |

Cosmo v9 required explicit manual revisions. Keep it as diagnostic/reference evidence; do not count it as an unattended success. Existing synthetic benchmarks prove the renderer can handle their inputs, not that the generator reliably chooses equally good designs.

## Boundaries throughout the work

- Research/planning stays at **$25/month**. Builds/images/review stay at **$50/month**, with **$5 per approved site shared across its revisions**. These are ceilings, not expected prices. Read the remaining ledger before any paid acceptance batch; include prior, reserved and uncertain charges. No new subscriptions or budget increases are implied.
- Keep exact human plan approval. A changed scope, new creative direction or materially changed assets needs the normal revised plan/approval flow. Do not approve a real customer's plan on their salesperson's behalf to fill an evaluation quota.
- New behavior applies to new builds and explicitly requested checked revisions. Existing public artifacts remain immutable; an earlier working preview stays available until a replacement passes. No mass rebuild of old projects.
- Keep static portable output, shared Render hosting, isolated preview origin, authenticated CRM, no secrets in artifacts, and revocation/expiry enforcement. Preview forms remain demonstrations and previews remain excluded from indexing.
- Preserve the current **85 overall / 75 per dimension** model gate while calibrating it. Human quality targets below are separate rollout criteria, not a silent threshold change or a reason to weaken checks.
- No routine paid “generate several and pick the prettiest” process. Use saved artifacts, free renderer fixtures and scoped fixes before buying another attempt.

## Work packages, in order

### P0 — Establish a reproducible baseline

**Owner: Codex.** Do this before changing generation prompts or rendering decisions.

- [ ] Create a versioned evaluation manifest for trades, wellness, hospitality, professional services and sparse/unknown businesses. Include at least two creative briefs within the same industry to catch identical layouts with swapped text.
- [ ] Cover no website, company name `None`, ambiguous company matches, missing logo/photos, unusually long names, substantial existing content and a brief with very little copy. These are test cases, not new mandatory intake fields.
- [ ] Retain a tuning set and separate held-out cases. Freeze the cohort and scoring anchors before seeing results. Use sanitized fixtures and private evaluation records; do not commit real contact details or private research to a public report.
- [ ] Save baseline screenshots, full artifacts, prompt/renderer/model configuration versions, exact plan, findings and ledger references. Keep human-made reference examples separate from generated outputs.
- [ ] Add a result-record template with the fields under “Evidence record” below. No invented example scores or sample successes in the actual results ledger.

**Done when:** another developer can rerun the free baseline, identify which version produced each result and distinguish mocked workflow tests from genuine generated sites.

### P1 — Finish identity, link previews and portable exports

**Owner: Codex. First implementation slice.** This should not add a paid AI stage.

- [ ] Generate local PNG favicon variants (32/64 pixels) and a 180-pixel touch icon from usable approved branding. Use a readable concept mark when no appropriate logo exists. Base any displayed name on the approved public identity, not an unreviewed CRM personal name. Never scrape a possible company's logo and silently treat it as approved.
- [ ] Generate a branded **1200 × 630 JPEG sharing card** from the approved palette/name, local font and already-approved imagery. Use a deliberate typographic fallback without a photo. Fit long names, preserve logo aspect ratio and check thumbnail legibility. This size is our implementation choice, not a universal platform guarantee.
- [ ] Render page-specific Open Graph titles/descriptions/URLs plus image type, dimensions and alternative text; include compatible large-image Twitter card metadata. A common branded image is sufficient for the first release. Keep titles and descriptions honest and consistent with the page.
- [ ] Use trusted server-configured public version URLs for absolute sharing-image/page metadata; do not trust request Host headers or model-supplied arbitrary URLs. Icons remain relative to each page so nested pages and exports work.
- [ ] Include the derived assets in the hashed manifest and byte accounting. Add a separate sharing-card size target (start at 300 KB); do not preload the social card as a normal page resource. Avoid expensive extra image requests.
- [ ] Extend the exact asset/link allowlist in `site/safety.ts`. It currently permits only the stylesheet `<link>` and known content image/font files. Permit only the intended icon relationships and validated derived files; keep the one trusted script/stylesheet/CSP contract. PNG avoids requiring `.ico` support in the current artifact MIME map.
- [ ] Extend export packaging with a documented `SITE_PUBLIC_URL` build setting or equivalent explicit configuration. Rebind absolute sharing metadata to the final deployment's origin and optional base path. If no URL is configured, keep the export runnable with local assets and omit preview-origin absolute metadata; explain how to enable full sharing on its new host. Never leave purchased sites dependent on the preview server or its expiry.
- [ ] Preserve demo/noindex defaults in the export until deliberate production finishing. Actual customer launch, sitemap/indexing setup, real forms and chatbot credentials are separate launch decisions.

**Acceptance:** decoded favicon/touch icon/card assets, correct nested paths, escaped titles, long-name and no-logo examples, public MIME and dimensions, no unexpected requests/secrets, and an exported site running without Factory access. Test both root and subdirectory export deployments. Inspect the icon in browser tabs and the card at small display size.

**Main code areas:** `lib/factory/site/render.ts`, `images.ts`, `artifacts.ts`, `safety.ts`, `package.ts`; derive assets in a focused module such as `identity.ts`. Read the actual pipeline and local Next guides before implementation; names here are a work map, not permission to bypass existing validation.

### P2 — Verify the link a salesperson actually sends

**Owner: Codex; Austin/teammate supplies the final real-phone observation when needed.**

- [ ] Check required metadata, local asset existence, image decoding, dimensions, content types, size and page-specific URLs before publication. Add negative tests for missing/wrong-origin assets and metadata pointing to an older version.
- [ ] After publication, follow the branded short link **anonymously**, without the worker's private verification header, and retrieve the declared sharing image. Preserve existing private byte/hash checks; the public check serves a different purpose.
- [ ] Bound redirects and fetches to configured public hosts/version paths, with timeout/size limits. Verify homepage and representative inner-page metadata, plus revoked/expired behavior. Do not make untrusted URLs a server-side fetch capability.
- [ ] Retain noindex and origin isolation. Inspect the actual preview host's root crawler policy rather than assuming the per-site `robots.txt` controls it. Do not remove search-index protection to make a thumbnail work.
- [ ] Preview the exact copied link in an actual phone messaging composer and a relevant social preview inspector. Record platform, URL, time and screenshot. Do not send test messages or publish posts without the user's explicit instruction. A crawler fetch is necessary evidence but does not guarantee every app's rendering/cache behavior.
- [ ] Ensure an anonymous verification failure leaves a clear recoverable status and preserves the previous working URL. A pending verification must not present a new link as fully verified.

**Done when:** a newly approved site's copied short link opens anonymously and produces its intended card in the tested real channel, while its exported equivalent uses its own deployment URLs. Record platform limitations without promising universal instant cache refresh.

**Main code areas:** `lib/factory/build-worker.ts`, preview resolver/storage/server, `app/preview/[slug]/route.ts`, export and integration tests.

### P3 — Improve the generator's design decisions

**Owner: Codex. Changes follow observed failures and the frozen baseline.**

- [ ] Audit whether research, planning and generation agree on audience, requested work, likely industry, approved facts and assets. Preserve uncertainty and support a confident provisional design when facts are sparse.
- [ ] Make the existing plan carry a concise creative direction: visitor benefit, public identity, supported visual recipe, page purposes, image roles and meaningful next actions. Prefer extending the existing planning/generation request over adding another paid agent stage.
- [ ] Evaluate the actual supported components as a curated design system. Fix repeated renderer weaknesses globally: hero balance, navigation, typography, image crops, section rhythm, inner-page depth, compact contact pages and phone stacking. Add new layouts only when a demonstrated gap warrants them.
- [ ] Require useful variation: contrasting briefs within the same industry should differ in composition and emphasis where appropriate. Industry is an input to design judgment, not a single mandatory template.
- [ ] Improve copy through concrete visitor benefits and distinct page purposes. Eliminate repetitive inquiry instructions, filler, repeated slogans and unsupported credibility claims. Do not solve thin content by inventing services, testimonials, team members, years or results.
- [ ] Reuse suitable approved logos/photos and purposefully different crops. Generated imagery must not pretend to depict real staff, completed jobs or premises. Optional new image work stays in the approved plan and existing allowance.
- [ ] Keep general lessons in `lib/factory/website-standards.ts`, used by planning, generation and review. Keep client-specific colors, page counts and wording in that client's approved plan. Compare each change against the held-out cases before calling it an improvement.

**Done when:** blind comparisons show a measurable gain over the frozen baseline in the rubric below, without reduced truthfulness, mobile usability, completion rate or budget compliance. A more complicated prompt or more components alone is not completion.

### P4 — Make checking and recovery dependable

**Owner: Codex.**

- [ ] Add viewport coverage for narrow phones, a common phone, tablet and desktop. Retain all-page checks at the existing main viewports; include long text, menus, service tabs, reduced-motion behavior, keyboard focus and form demonstration behavior.
- [ ] Add reproducible throttled hosted-page performance checks. Record browser/tool version, device/CPU/network settings, cold versus warm cache, and three-run median. Initial engineering targets: mobile Lighthouse performance ≥90, lab LCP ≤2.5 s, CLS ≤0.1; investigate worst pages rather than averaging them away. Retain the existing 800 KB full-page mobile budget unless evidence justifies an explicit revision.
- [ ] Keep lab scores separate from field Core Web Vitals. Field targets, where enough real traffic exists, are p75 LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1. Low-traffic previews may never have enough field data; do not invent an INP result or claim field success from in-memory QA.
- [ ] Calibrate screenshot review with human labels and held-out examples. Check attractive Home pages with weak inner pages, polished but invented claims, legitimate minimalist designs, long names and missing business facts. A model must not reward extra words or blindly approve its own style preferences.
- [ ] Keep corrections scoped to supported content/layout changes and the exact approved plan. Preserve the two-correction/three-review limit, saved-response reuse and cycle detection. If repeated defects require renderer work, fix the renderer and regression case rather than adding endless repair requests.
- [ ] Add safe, bounded recovery/backoff for known resumable stages such as rechecking persisted artifacts. Save checkpoints, keep idempotency and cumulative accounting, and never blindly repeat an ambiguous paid request. Simulate timeouts, worker restarts, expired leases and storage verification interruptions.
- [ ] Add worker heartbeat and queue-age visibility. Show queued, active, automatically retrying, blocked by budget and needs-attention states with useful next steps. Avoid a progress bar that silently sits forever or a generic retry that burns another allowance.

**Done when:** supported interruptions recover without developer involvement or duplicate charges; unsupported cases stop clearly with saved work; performance and visual regressions are reproducible; publication still enforces the factual, functional and approval boundaries.

### P5 — Prove the salesperson can finish independently

**Owner: Codex prepares the workflow; Devon or Jeffrey performs the acceptance session.**

- [ ] Use an ordinary active Member account, not Austin's Owner privileges. Find a lead/project, review the plan, add one planning-chat direction, approve the current version, leave the browser and return to the ready update.
- [ ] Open the preview, inspect the phone view, copy the short link and locate the source export without developer coaching. No hosting, environment or API configuration should be required.
- [ ] Keep the primary workflow in Website Builder and My Day with clear next actions. Place technical diagnostics behind an administrative detail view. Do not expose internal model scores as a guarantee of quality.
- [ ] Target ≤5 minutes of interface operation to review/adjust/approve a ready plan and, once ready, find/copy the finished link, excluding time spent reading and considering the proposal. Record that review time and worker wait separately. Use a provisional goal of ≤20 minutes at p90 from approval to verified preview under normal load; measure first and revise based on evidence rather than promising an unsupported ETA.
- [ ] Record confusion and unintended clicks, not just completion. Fix workflow friction and repeat with a fresh project; do not count a coached walkthrough as independent acceptance.

**Done when:** at least two independent Member sessions finish without Austin/Codex taking over, and a failure/budget case is understandable without asking the salesperson to debug logs.

### P6 — Earn confidence through real builds, then keep it

**Owner: Codex collects evidence and fixes defects; human reviewers assess prospect appeal.**

1. **Free regression:** complete P0–P5's non-provider tests and inspect existing saved-artifact replays. Replays are diagnostics, not new autonomous generation successes.
2. **Three-site pilot:** use three fresh, separately human-approved plans: an established service business, a contrasting industry, and a sparse/unknown business. Their $5 ceilings total at most $15 within the existing remaining build allowance, not an additional allocation or expected cost. Research uses its separate remaining allowance. A synthetic paid case must be explicitly approved as such and remains separate from the real-lead completion denominator.
3. **Ten-build evaluation:** after fixes, evaluate ten consecutive eligible approved lead builds across the benchmark contexts, including sparse input. If lead volume does not cover a context, report it as untested. Use ordinary scheduled workers, real providers and normal hosting. Log every failure and manual intervention. Do not repeat until pretty and discard earlier attempts.
4. **Rolling twenty-build check:** earn broader confidence only after twenty consecutive builds on a stable release family meet the targets below. This can span months; prefer actual sales work over buying twenty artificial builds. At the $5 ceiling twenty sites could use $100, so never schedule them as a one-month batch under the $50 cap.
5. **Ongoing:** monitor production outcomes, add failed cases to regression coverage, and sample fresh human reviews. Prompt/model/renderer changes require relevant regression and a fresh pilot; preserve historical results by version. Broad claims must narrow again when a material regression appears.

### Proposed acceptance targets

These are operating goals to implement and measure, **not current achievements** or statistically proven population guarantees.

| Dimension | Target |
| --- | --- |
| Hard correctness | Every released site has working intended routes/actions, appropriate demo behavior, no material unsupported business claims, no severe accessibility defect, no missing assets and no approval/budget breach. Any breach blocks that release regardless of appearance score. |
| Brand and sharing | Every new released site has a readable favicon/touch icon, coherent card, valid metadata, successful anonymous image retrieval and portable export metadata. Record real-channel display separately. |
| Pilot | All three cases complete without developer changes after approval and pass independent send-worthy review. If not, diagnose, fix and start a new recorded pilot; keep the original failed batch. |
| Expanded operation | At least 9/10, then 19/20, consecutive approved builds reach verified hosted/share-ready status within the original allowance without developer intervention. Count failed/stalled/budget-exhausted/technical-recovery cases in the denominator; report user cancellation separately. |
| Prospect appeal | At least 9/10, then 19/20, of those same builds are independently judged ready to show a prospect. Target human median ≥90/100 across rendered cohort outputs, reporting the number scored alongside all failures. Within this acceptance cohort, a site below 85 overall or 80 in any human dimension cannot count as a quality pass. Unfinished builds count as failures in the appeal-rate denominator. |
| Comparisons | At least 8/10 held-out comparisons prefer or tie the new output against the frozen baseline; record exact votes and reasons. A baseline win cannot substitute for the absolute send-worthy target. |
| Usability and speed | Two independent Member sessions pass P5. Report active staff time, median/p90 queue/build times, caps, all-attempt cost and technical intervention rate together. A quick low-quality result is not a pass. |

Use the existing six rubric dimensions: first impression/identity 25%, composition/typography 20%, imagery/brand 15%, honest persuasive copy 15%, page usefulness/actions 10%, mobile presentation 15%. A 90 means distinctive and convincing; 100 remains exceptional, not a routine target badge.

Every completed cohort case needs at least one human send-worthy judgment and dimension scores; have two humans independently score a representative calibration subset, including weak cases. At least one reviewer should not have made the site. These are rollout evaluation criteria, not a new human quality-approval step before every routine publication. Hide output provenance and randomize order for comparisons. Ask “Would you send this to a prospect without apologizing for the design?” plus dimension scores and one concrete weakness. Large disagreements (>10 points or a send-worthy disagreement) need reconciliation, not selective averaging. Codex/another AI is useful for diagnosis but is not a second human reviewer. Calibrate automated judgments against these labels; do not change thresholds just to agree with the builder.

Ten or twenty successes can support scoped operational confidence, not a guarantee about every industry or future build. Report the sample size, tested contexts, release version, worst results and failures whenever describing reliability. The user's meaning of “amazing” remains anchored in what prospects and salespeople actually see.

## Evidence record for every acceptance build

Store privately: case/project/version IDs, intake category and known missing fields, confirmed versus candidate facts, approved plan version, actor role, code/prompt/renderer/model configuration, timestamps for queue/stages/ready, every correction and recovery, screenshots of every page/viewport, artifact hashes, anonymous link/card checks, device/browser/platform, export check, lab settings/results, research/build ledger references including uncertain amounts, human votes/scores, and whether anyone manually touched the site after approval. Log failure reasons and negative results. A manually recovered or hand-edited site can be useful to sales but remains a failure for the unattended metric. Successful bounded automatic recovery can count as unattended completion; retain all its attempts, elapsed time and cost in the record.

## Cost, ownership and deferred work

Codex owns code, fixtures, diagnostics, documentation and deployment verification. Salespeople retain plan approval and brief review; Austin supplies taste feedback on a small review set, not manual design work for every client. Jeffrey is not needed for new Cloudflare infrastructure: this continues on existing Render services.

Deterministic icons/cards, saved-artifact checks and local fixtures add no AI requests. Existing AI calls still incur their usual charges. Additional quality experiments must fit the remaining ledger and their approved scope; pause paid experiments when the cap is insufficient and continue free work. Do not purchase a data tool, add a paid agent loop or change the model merely because “more AI” sounds stronger.

The visitor chatbot, unrestricted code-editing copilot, live inquiry delivery and customer production launch remain subsequent milestones. A future chatbot needs its own server-side API boundary, approved business knowledge, usage limits and accuracy tests; it is not required to prove the core website builder's design quality.

## Resume here

**Next engineering step:** P0's free baseline/result template, followed by P1 and P2 as one coherent favicon/social-sharing/export release. Then use observed P3/P4 gaps to prepare the three-site pilot. Do not return to manual Cosmo polishing or launch a paid evaluation batch as the first step.

Current completion: read-only gap audit and this plan are complete. P0–P6 implementation/acceptance checkboxes remain open. Update this document with each focused commit, validation result, live deployment and remaining failure; keep the primary [factory resume guide](AI_WEBSITE_FACTORY_BUILD_PLAN.md) pointed here.

## Primary references consulted

- [Open Graph protocol](https://ogp.me/): required page identity/image metadata and image properties. This informs P1; actual app display still requires observation.
- [Google favicon documentation](https://developers.google.com/search/docs/appearance/favicon-in-search): icon link/brand guidance. Browser favicon support is distinct from eligibility in Google Search, and our concept previews intentionally remain noindex.
- [Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds): field p75 thresholds and the distinction from lab observations. P4's Lighthouse/latency goals are our engineering targets, not claimed Google ranking guarantees.
- [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices): representative cases, repeated evaluation and human calibration. Use the existing repo-owned test/reporting tooling; this plan does not depend on purchasing or adopting a hosted evaluation product.

Documentation-only planning update. No new build, paid provider request, site regeneration, budget change or production setting change was performed to create this plan.
