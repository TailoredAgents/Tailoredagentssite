# AI lead introductions — first-message pilot

October 31, 2026. Implementation is opt-in and OFF by default. No real texts or paid AI calls were made during development. Source delivery, production deployment and live activation are different milestones; a successful push/build does not establish live acceptance.

## What the team gets

- **Settings → AI introductions:** choose allowed Meta form IDs, sending number, teammate responsible for calling, days/hours, message direction and daily limit. Owner/admin only. The server switch must also be enabled before activation is possible.
- A fresh Facebook/Instagram Instant Form lead gets one introduction, targeted for approximately 20 seconds after successful CRM import during the configured window. The model selects an expressed interest and one useful question. The application adds the Tailored Agents introduction and notice of a follow-up call. Company name/website are optional.
- **Inbox → customer details → AI introduction:** status, saved message, delivery context, pending-send cancellation, call-task status/outcome. Normal SMS delivery receipts and conversation history still apply.
- **My day → New leads to call:** the selected teammate sees the promised call; Team view also shows other permitted tasks. Open the conversation to call, then record an outcome or mark no call needed. A task is created at SMS reservation even if delivery is uncertain, so check delivery before calling. Existing call recording/transcript functionality is unchanged.
- Customer replies go to the existing Inbox and customer-text notification rules. No automatic second text, sales negotiation, appointment booking, campaign enrollment or unsolicited follow-up is implemented.

Illustrative example, not a production-generated or sent message:

> Hi Jamie! Thanks for reaching out to Tailored Agents about your website and SEO. What would you most like the new website to help your business achieve? Our team will also give you a call to follow up.

## Boundaries and delivery behavior

1. Both `LEAD_INTRO_SMS_ENABLED=true` and enabled workspace settings are required. Initial database setting is false. Existing manual SMS and lead/team alerts are unaffected by this switch.
2. Only explicitly selected Meta forms qualify. Provider submission and webhook receipt must postdate activation; submission must be within one hour of intake. No old-lead backfill action exists. Numbers must normalize to the +1 numbering plan; +1 alone does not prove US residence or recipient time zone. Website/manual/import leads are not enrolled in this pilot.
3. Defaults prepared for review: every day **9 AM–6 PM America/New_York**, **20 introductions/day**. These are editable and NOT approved live settings. Review hours against the targeted recipients (including western US leads) before enabling. Recipient-local scheduling is not implemented; area codes are not used to guess location. After-hours jobs wait for the next configured window and expire after four days.
4. Workspace owner/admin who enables the setting is the sending actor. Their membership and explicit active-number send grant, the assigned call owner's membership/send grant, Twilio account/number configuration, opt-outs, lead identity/status and unchanged draft facts are checked again before send. SMS and task content require an active number read grant; write actions require send permission. Settings access does not confer access to message bodies.
5. One durable request ID per lead-introduction job and one recipient hash per workspace prevent automatic repeat introductions, including repeated forms. An existing SMS conversation, observed email/call/SMS outreach, internal alert recipient, changed/deleted lead or blocked number prevents sending. Manual CRM text, email or call initiation cancels pending work; replies, merges and explicit takeover do too. Calls are also checked by phone before send. Mail sent outside the CRM is only observable after synchronization; off-system personal calls are not detectable.
6. The worker reserves through the existing `sendSmsMessage` intent pipeline; it does not send directly to Twilio. Normal sender, recipient, rate-limit and callback checks stay in place. A timeout/unknown provider result is **never automatically resent**. Signed receipts can resolve it. If a process dies during AI generation, the job fails rather than making another uncertain billable generation. A generic fallback is used for a returned AI error/invalid output; the UI labels fallback messages.
7. Pause in Settings cancels queued/generating/ready jobs. Per-conversation takeover cancels that introduction. The server switch stops new processing but retains pending jobs; use the Settings pause to cancel rather than merely suspend them. No system can recall a request already handed to the provider. Guard checks minimize races, but an action arriving after delivery starts cannot prevent that send.
8. Call tasks and outcomes follow merged SMS conversations. Pending introductions are cancelled when their history is merged. Lead deletion/anonymization scrubs derived body/phone/facts and removes its call tasks. A hashed recipient tombstone remains to prevent automatic re-enrollment. Outcome completion does not schedule another reminder; use normal CRM follow-up scheduling for that.
9. Optional introduction enqueue failures are isolated from lead ingestion with a savepoint. The lead is still imported and Settings reports an enqueue error; the team should follow up manually. No silent delayed replay is attempted.

## AI and runtime

- Existing server-side `OPENAI_API_KEY`, Responses API, `gpt-6.1-sol`, low reasoning, `store:false`, 550 maximum output tokens, 12-second timeout and 32 KB response limit. No web browsing or autonomous tools. `CRM_AI_DRAFTS_ENABLED=false` disables AI drafting and uses the disclosed fallback; it does not disable the introduction automation itself.
- Prompt treats form fields as untrusted facts; no required company/site. Structured output is a topic enum plus one short question, validated before application-owned copy is added. Model quality and factual appropriateness still need sample review; schema validation is not a guarantee of semantic accuracy.
- One generation reservation and one send reservation maximum per job. Daily quotas count stable timestamps in Eastern time, independently for generation and send starts. Generic fallback also counts against the generation reservation limit. Unknown sends remain counted. Existing hourly SMS limits apply too. The daily count is **not a dollar cap**; AI usage and SMS segments have their usual charges. No new hosting service is required.
- Meta webhook acknowledges the durable event first, then uses a bounded 35-second `after()` window for low-latency work. `maxDuration=120` is set on the route. The existing authenticated `/api/cron/search-console` lane recovers interrupted/delayed work. Its configured schedule is every five minutes, so recovery can take longer than the 20-second target. Burst intake, downtime and provider latency can also delay messages. This is not a guaranteed 15–30 second SLA.

## Deployment and activation checklist

- [ ] Review the committed changes and confirmed local checks below. Preserve unrelated Mail/D1 work.
- [ ] Deploy website/CRM code through the existing Render service. Its build command already runs `npm run db:migrate` before `npm run build`. Website PostgreSQL migration **0037_lead_introductions.sql** is required before this code serves requests. This is NOT Mail's D1 migration 0038 and requires no Cloudflare change.
- [ ] Keep `LEAD_INTRO_SMS_ENABLED=false` (or absent). Confirm normal leads, SMS, email, calls and the new settings page work after deployment.
- [ ] Review representative examples with Austin: website, website+SEO, AI agents, exploring, missing business details, and a lead with its question already answered. Mocked tests do not substitute for actual paid-model sample acceptance. Obtain approval before any live provider send; approve the receiving number and exact test text. No live test has happened yet.
- [ ] Select the exact Meta forms that request text contact, appropriate hours for their recipients, an approved business SMS number and a call owner with send access. Confirm daily allowance and monitoring responsibilities. Default pilot settings are for review, not activation authority.
- [ ] With explicit live activation approval, set `LEAD_INTRO_SMS_ENABLED=true` on the Render website service and redeploy. Leave other existing Twilio credentials/settings intact. Then the owner reviews/enables **Settings → AI introductions**. Both gates must pass. No credentials belong in this document.
- [ ] Confirm the existing scheduled worker URL/secret and recent successful runs. Look for `Lead introductions` in the cron summary; Settings shows its last worker check. If a lead was saved without an introduction, check Settings and `lead_introduction_enqueue_failed` logs. Do not dump lead data or credentials into logs.
- [ ] Use an approved test form/recipient to confirm one SMS, one call task, saved conversation/delivery status, a reply notification, and no automatic follow-up. Verify no duplicate on a repeated webhook. Test takeover before provider handoff. Record outcome and deployment revision here.
- [ ] If pausing, disable/save in Settings first to cancel pending jobs; set the server switch false as an additional stop. Do not delete intent rows or mint a new request ID to retry an uncertain message. Review Twilio delivery evidence instead.

## Verification

Local, synthetic-provider checks cover policy/DST hours, source freshness, duplicates, quotas, real Meta intake, optional enqueue failure isolation, generation fallback/interruption, changed/deleted/anonymized leads, customer replies, revoked grants, manual takeover, unknown send resolution and call task lifecycle. Existing SMS, Meta, Inbox, voice and conversation integration suites run against guarded disposable PostgreSQL databases on loopback port 55433. Real OpenAI/Twilio access is mocked.

```powershell
$env:TEST_LEAD_INTRO_DATABASE_URL='postgresql://ta_test@127.0.0.1:55433/ta_lead_intro_test'
npx vitest run lib/lead-intro
npx playwright test --config playwright.conversations.config.ts tests/conversations/lead-introductions.spec.ts --project desktop --project phone
npm run typecheck
npm run lint
npm run build
```

Final local checks (October 31):
- 200 tests passed across introduction policy/provider/integration, Meta, SMS, Inbox, voice, conversations and scheduled-worker suites. The 53-test conversations suite also passed after adding merge preservation.
- 2 Chromium browser flows passed (desktop and phone): disabled-by-default settings, saved values/feedback, takeover and completing the promised-call task. No real providers were contacted.
- TypeScript, lint, `git diff --check` and the optimized Next.js production build passed.

Production behavior, real AI output quality, carrier delivery and live timing remain unverified until the approved pilot test. Record the actual deployed revision and live acceptance here after approval; do not infer them from a push.

## Next phase, separately approved

Build reply suggestions from the full authorized conversation/client brief, then evaluate them against staff-written examples before allowing any automatic replies. Later autonomous multi-turn work needs explicit allowed actions, human handoff rules, quiet-hour/recipient-timezone handling, budgets, audit history and a kill switch. Connecting an AI model does not authorize it to negotiate, promise prices or keep texting independently.
