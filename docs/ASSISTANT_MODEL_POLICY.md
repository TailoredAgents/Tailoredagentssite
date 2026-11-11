# Assistant models and spending

November 10, 2026. Extends the employee assistant release; does not replace its permissions, background grants, documents, routines, or exact email review.

## Conversation behavior

- New dashboard messages use the company spending settings. There is no per-message dollar selector or cost receipt in Chat or My work. Voice transcription costs also move out of the composer.
- Each assignment starts on `gpt-6.1-sol`, low reasoning. The internal `adjust_reasoning` tool lets it choose medium for planning/comparisons and high for difficult analysis, then return to lower effort. It does not grant additional business tools or permissions.
- Astra is requested only for exceptional unresolved analytical complexity. The server requires a completed Sol high request in the same assignment before accepting Astra, forces Astra high, and permits at most two Astra requests including uncertain requests. Afterwards requests return to Sol high. At most four routing changes and 36 total tool steps per assignment prevent unbounded switching/loops.
- The prompt prohibits escalation to fix missing information, access restrictions, or provider/tool failures. The server verifies the attempt history and count; it cannot objectively prove that an analysis was difficult enough. Representative real-use evaluation is still needed to tune that judgment.
- Web/calculation subrequests stay on Sol. Document vision remains Sol low. No automatic pro mode, xhigh or max until evaluations justify them.
- Provider requests allow up to 60 seconds, within the 90-second lease. Worker checkpoints leave time for a full provider call. Low/medium/high output limits are 3,000/5,000/8,000 tokens including reasoning. Unknown outcomes keep their reservation and are never automatically reissued. Encrypted reasoning is omitted from mixed-model replay; visible context and action receipts remain.

## Settings and accounting

Assistant → Settings → Models & usage shows estimated total monthly use, per-model completed/reserved spending and average completed request cost. Totals include voice transcription; model rows cover Responses API work.

Owners/admins can explicitly select **No monthly assistant spending cap**, then **Save allowance**. This is uncapped dollar spending, not infinite tasks or unlimited OpenAI throughput. API charges and provider rate limits still apply. To pause paid work, uncheck it, set the monthly limit to 0, and save. Requests already issued may finish.

Migration `0062_assistant_model_policy.sql` defaults uncapped to false and preserves existing company limits. New interactive messages omit `maxCostDollars` and persist `budget_managed=true`. Old clients may still supply an explicit assignment limit. Existing tasks and recurring routines retain their original limits, even with uncapped company spending. Earlier assignment limits can be adjusted in Settings before resuming. Permissions and exact review do not change when uncapped is selected.

Usage reservations remain transactional across employees and dictation. Retry identifiers include the spending mode, so they cannot silently change an existing assignment. The model cannot change the allowance. Model selection, effort, and uncertain charges are recorded in the existing request ledger.

Rates checked against [OpenAI pricing](https://developers.openai.com/api/docs/pricing) and [reasoning guidance](https://developers.openai.com/api/docs/guides/deployment-checklist#set-up-reasoningeffort): standard Sol $2/M input, $10/M output; Astra $10/M input, $50/M output. Thus 10,000 input + 2,000 output tokens are approximately $0.04/$0.20 before tools. This is an example, not a measured average task. One task may make multiple requests. Internal estimates conservatively use 30-minute cache-write input rates ($2.50/$12.50) and apply long-context multipliers above 272,000 input tokens. Cache discounts and invoice adjustments are not reconciled. Uncertain requests retain their upper estimate.

## Verification and rollout

Local verification uses synthetic OpenAI responses and dedicated disposable PostgreSQL databases. No real AI requests, emails, SMS, or calls are needed. Coverage includes model/effort selection, Astra eligibility/caps, encrypted-context transfer, persisted routing, deduplication, accounting, owner-only uncapped settings, explicit assignment limits, pausing, dictation, and existing permissions/review flows. Desktop/phone tests cover the clean composer, Settings persistence, ordinary chat, reviewed work, and private document export.

Deploy the website through its normal Render main-branch pipeline, which applies database migrations before startup. No Mail Worker deployment or new credentials are needed for this change. Keep the separate Mail/Apple activation gates in `OPERATIONS_ASSISTANT_RELEASE.md` intact. Verify Chat and Settings after deployment, then save the requested spending mode through the owner account; the migration itself does not opt a company in.

A harmless production chat completed during the later SMS acceptance, but per-model availability (especially Astra), escalation quality and representative latency remain unverified. An unavailable model produces a visible failure/uncertain receipt, not a silent paid retry or alternate-provider fallback.

## Verified local release checks

- 49 focused model-policy/chat/dictation tests passed using isolated local PostgreSQL databases and synthetic providers.
- Full website unit suite: 833 passed, 645 environment-dependent cases skipped; the focused database cases above were run separately.
- Six desktop/phone browser journeys passed, including keyboard/back navigation, unsent draft preservation, uncapped setting persistence, exact action review, and document export. Browser testing exposed and fixed a refresh/navigation race; tab changes now use router navigation.
- Production build, TypeScript, lint, and capability inventory passed. No real AI or communication requests were issued during testing.
- Production release `99166c8` was recorded live in Render deployment `dep-dbprnkks728c738oi440` November 10 at 7:53:29 PM Eastern. Authenticated readback confirmed Austin selected uncapped company spending and it persisted after reload. Permissions remained unchanged. See [release evidence](OPERATIONS_ASSISTANT_RELEASE.md). This does not establish Astra availability, escalation quality or typical generation latency.
