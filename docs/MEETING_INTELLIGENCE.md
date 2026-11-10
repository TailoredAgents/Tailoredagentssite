# Meeting Intelligence and relationship discovery

Implementation and release runbook · November 10, 2026

## What this adds

- **Meeting Inbox** under Daily work. Recordings do not need a prospect, business or customer beforehand.
- Optional structured discovery on prospect, opportunity, client and contact pages. Original notes remain unchanged. New entries preserve their author and history. Possible automations are explicitly ideas to explore.
- A referral partner directory and introduction history, separate from the existing sales owner. Client account managers are separate from project delivery owners. Existing canonical CRM links make discovery and introductions visible after conversion; no commission logic or agreement terms exist.
- Private, resumable recording uploads; authenticated playback; transcription; evidence-backed AI findings; review notes; explicit linking or sparse prospect creation; unrelated/unmatched classification; explicit team sharing; retention and permanent deletion.
- Per-person Omi connections and a bounded, authenticated raw-audio receiver.
- Permissioned meeting search, findings and paginated transcript tools in the existing employee assistant and Operations MCP.

## Everyday workflow

1. Open **Daily work → Meeting Inbox → Add a recording**.
2. Enter a title, select audio, record permission/consent notes and choose retention. WAV, MP3, M4A/MP4 audio and WebM are supported; maximum 24 MB, mono/stereo and 60 minutes. Larger recordings need a smaller audio export or separate parts. File headers and parsed duration are checked; filenames are not trusted as the format.
3. An interrupted upload can resume by selecting the **same original file**. Each 1 MB part is hashed; replaying a saved part is harmless, but replacing it with different bytes is rejected. Identical uploads by the same user open the saved recording. Other users cannot use this to discover another person's recordings.
4. Listen, then click **Transcribe & analyze**. Processing continues in the background. The shared scheduled worker normally runs every five minutes; longer recordings and a queue may take multiple worker cycles. Status is shown live. A failed or uncertain provider request requires an explicit retry and retains its allowance reservation.
5. Read the full transcript and findings. Exact quotes support findings marked **stated**. This means the words appeared in the transcript, not that an assertion is independently true. AI suggestions, missing information and the AI summary remain separate from human-recorded discovery.
6. Link an existing prospect, company, contact, opportunity or client, deliberately create a prospect, or leave the meeting unmatched/unrelated. A new prospect requires a reviewed name; phone, email and company can stay blank. Existing matching names/phone/email prompt linking instead. Source is `manual`: this creation does not start automatic lead-introduction SMS.
7. Linked meetings appear on the relationship's discovery panel **only for people allowed to read them**. Linking does not broaden audio access. Record agreed findings in the structured discovery form; meeting AI never writes CRM facts automatically.
8. The owner can share with the active workspace team, change retention or permanently delete the recording. Sharing exposes the retained recording, transcript and findings, including existing content.

## Permissions, safety and retention

- Every route rechecks the authenticated dashboard user and current workspace membership. Mutations also check the persisted role inside a transaction. Viewers cannot upload, process, link, change or delete.
- Meetings start private to their uploader/device account. Even another workspace owner cannot read a private meeting just by guessing its ID. Team sharing is explicit; only the recording owner can edit its links, sharing or retention.
- API writes require the exact app origin. Omi is a separate machine endpoint with its own secret authentication; ordinary app authentication is not relaxed.
- Audio uses the existing private Render/R2 adapter under `meetings/<workspace>/<meeting>/audio/`. Public preview resolution still accepts only website manifests under `factory/.../preview/` and cannot serve meeting audio. Audio playback is proxied through an authenticated route with private/no-store headers and range support.
- Temporary upload/PCM chunks are in private PostgreSQL rows. Completed uploads delete those chunks after durable object storage succeeds. Partial manual uploads expire after 24 hours. Default recording/transcript/findings retention is 30 days, configurable from 1–180 days from creation.
- Expiration/deletion denies reads immediately. The worker removes audio and temporary chunks asynchronously; a storage outage leaves a deletion retry pending. It never restores content from a late AI result. Minimal non-content usage/audit records remain. Independently copied CRM notes and clients are not deleted with a recording.
- Application audit records contain action metadata, not audio, transcripts or secret tokens. Backups and provider-side retention follow their respective platform policies; deleting from this application does not delete already-retained backups or provider logs.
- Consent notes are an accountable record of what the uploader states, not an automated legal determination. Each recording window needs permission appropriate to the participants.
- Recorded speech and AI output are untrusted data. They cannot instruct the system to send messages, grant access, create records or execute tools.

## AI and cost controls

- Reuses `OPENAI_API_KEY`. No second assistant or separate OpenAI account is required.
- File transcription: `gpt-transcribe`. Analysis: `gpt-6-luna`, structured output, no hosted tools, no external web search, `store:false`, 6,000 maximum output tokens. The complete saved transcript is bounded to 160 KB; oversized/invalid outputs fail visibly instead of silently truncating.
- **Austin approved $10/month on November 10, 2026.** Activation is recorded in the release status below. New workspaces default to $0. An owner/admin sets the company allowance in Meeting Inbox → Processing allowance & Omi devices. This is separate from chat, website builds and SEO. No production allowance is assumed from an earlier unrelated budget.
- Reserves $0.30 for a transcription request and $0.25 for analysis, before a provider request. The $0.55 allowance is conservative, not an assertion of actual cost. Official file-transcription pricing checked November 10 was $0.0045/minute, so a normal 60-minute recording is approximately $0.27 for transcription. Analysis adds text-model usage. Reservations are not reconciled downward in this first version.
- Workspace/month rows are locked so concurrent jobs cannot reserve past the selected allowance. The accounting month uses America/New_York. The provider project can additionally have account-level controls; local reservations are not a provider billing guarantee for malformed media or future price changes.
- Uncertain requests retain their reservations and are not automatically retried. At most three requested attempts per stage per recording. Already-sent provider requests may finish after a pause/deletion; results cannot resurrect a deleted record.
- `MEETING_PROCESSING_ENABLED=false` pauses new paid processing. Setting the dashboard allowance to 0 also blocks new reservations; uploads/playback remain available.
- Uploads: at most 100 new manual recordings per workspace/day and 2 GB of active meeting media reserved/received. Omi: at most 230.4 MB per device per rolling day plus the workspace cap. This is separate from actual disk-free space. The existing preview disk also holds website artifacts; watch disk usage before expanding intake.

## Omi setup — Austin and Jeffrey each do this

Software setup does **not** prove the two physical devices work. No production Omi credential is created by deployment.

1. Update the official Omi iPhone app and device firmware. Record exact versions for the acceptance checklist below. Sign into your own Omi account and retrieve your Omi user ID from the app/account information. If the installed app does not expose it, obtain it through Omi's supported account/developer tools; do not put a guessed ID in the CRM.
2. Sign into Tailored Agents as the owner of that device: Austin for Austin's device; Jeffrey for Jeffrey's.
3. Open **Meeting Inbox → Processing allowance & Omi devices**. Enter the device label and exact Omi user ID. Click **Create private connection**.
4. Copy the private webhook URL shown once. It contains a revocable 256-bit bearer secret. Never paste it into chat, this file, tickets, screenshots, analytics or public webhook testing sites. Only its SHA-256 hash is saved by the CRM. Revoke and recreate if lost or disclosed.
5. In the official Omi app, open **Settings → Developer Settings / Developer Mode → Realtime audio bytes**. Paste that URL, use a 10-second interval, save and enable the integration. Labels may vary by installed app version.
6. Back in the CRM, open a capture window (30–120 minutes), document recording permission, and optionally enable automatic transcription/analysis within the meeting allowance. Capture is paused by default; this prevents all-day ambient recording from silently entering the company system. Pause with a zero-minute window or revoke the connection to stop it.
7. Confirm **Last audio** updates, the correct person's Meeting Inbox receives a private recording, and playback is intelligible. Stop delivery or use **Finish recording upload**. Automatic grouping closes after roughly three minutes without delivery; long streams split at 19.2 MB (10 minutes at 16 kHz, 20 at 8 kHz). These are transport segments, not a claim to detect complete conversations.

### Verified protocol and its limitations

- Official documentation specifies HTTP POST, `application/octet-stream`, signed 16-bit little-endian **mono** PCM, with `sample_rate` and `uid` query parameters. This implementation accepts the documented 8 kHz and 16 kHz rates and rejects unsupported formats/rates and oversized bodies.
- Omi's current open-source receiver/sender path appends `sample_rate` and `uid` while preserving other URL query parameters. That supports our private `token` query parameter without a custom iPhone app or custom Authorization header. We do not treat `uid` alone as authentication.
- The token is intentionally in the configured URL because the documented developer flow does not offer custom headers. **Hosting/edge access logs may record query URLs.** Restrict log access and redact query strings in any external request logging/APM. The application never logs these URLs. Deploying this feature does not broadly change Cloudflare security rules.
- Raw audio has no guaranteed delivery ID, sequence number or recording-end signal. Immediate identical non-silent retries are suppressed within 30 seconds; silent chunks are retained. This is best-effort replay handling, not exactly-once delivery, complete conversation detection, or reliable reconstruction of missing/offline audio. Identical repeated speech could be mistaken for a retry. The UI discloses that recordings may contain gaps/repeats.
- App source currently splits deliveries into short chunks. Device/app/version and backend behavior can differ. It may depend on Omi's backend even though our transcription uses OpenAI. Do not assume the raw webhook bypasses every Omi subscription restriction or prevents audio from traversing Omi infrastructure.
- The documented free processing allowance and ability to export recordings do **not** establish unlimited webhook delivery, background reliability or automatic offline replay. Manual uploading remains the fallback; a paid Omi subscription is neither purchased nor promised unnecessary for every device setup.

### Physical acceptance checklist (not completed by synthetic tests)

- [ ] Austin's device/app/firmware versions: ______; Omi user ID verified privately.
- [ ] Jeffrey's device/app/firmware versions: ______; Omi user ID verified privately.
- [ ] Each produces intelligible playback at the correct speed, under its own account.
- [ ] Verify 10+ minutes, pauses, segment boundaries and distinct speakers. The transcript does not promise speaker diarization or verified speaker names.
- [ ] Lock the iPhone, background the app, change Wi-Fi/cellular, disconnect/reconnect Bluetooth; note missing audio and behavior.
- [ ] Test offline recording/export and recovery. Do not assume automatic sync.
- [ ] Test on the actual free plan, including behavior when its processing allowance is exhausted. Ask Omi support if the installed app cannot deliver raw audio without paid processing.
- [ ] Revocation and expired capture windows stop intake. Confirm other teammates cannot read private recordings.
- [ ] With a small explicitly authorized processing allowance, test a harmless consented recording through OpenAI and review transcript accuracy and actual dashboard/provider costs.
- [ ] Export and manually upload a recording as a fallback. No customer conversation should be the first acceptance fixture.

## Existing assistant

Dashboard: **Assistant → Chat settings → Read my private meetings and team-shared meeting transcripts → Update my access**.

External Operations MCP: reconnect/consent to **`meetings:read`** explicitly. Existing grants are not upgraded. No meeting write scope or automatic creation permission is introduced.

Tools:

- `search_meetings`: title/transcript search, 20 results/page, only owned/team-shared unexpired records.
- `get_meeting`: findings, reviewed notes and CRM links, with full-transcript availability/length.
- `get_meeting_transcript`: 12,000-character pages, offsets, total length and explicit continuation. Reading is non-mutating.
- `get_business_discovery`: team-recorded discovery/referral history through existing `operations:read` access, not private recordings.

Example: “Review my meeting with Morgan. Explain the current workflow, identify possible automations, list missing information, and draft a solution brief. Do not change records or send anything.” Existing CRM and communication tools retain their current review/direct-action and send permissions. Sharing meeting reads does not grant communication permission.

## Deployment

1. Pull the verified commit on `main` without overwriting collaborators' work. Back up the production PostgreSQL database using the existing private backup process; never commit a dump.
2. Main website deploy runs `npm ci && npm run db:migrate && npm run db:retention && npm run build`. Additive migrations **0051_business_discovery.sql** and **0052_meeting_intelligence.sql** do not rewrite existing CRM records or revoke existing assistant grants.
3. Deploy the existing **tailored-agents-site-previews** service from the same commit. Its private storage allowlist adds the meeting-audio namespace. No new paid service, disk or Cloudflare resource is required. Until this storage deployment succeeds, finishing an upload fails safely and temporary chunks remain resumable.
4. The existing scheduled job deploy must also use the same commit. `scripts/scheduled-workers.mjs` calls the new authenticated `/api/cron/meetings` lane with the existing `SEARCH_CONSOLE_SYNC_SECRET`. It runs independently of reporting, SEO and website planning. `MEETING_WORKER_ENABLED=false` on the cron pauses that lane; keep it running for retention even if paid processing is paused.
5. Confirm the web service still has its existing `DATABASE_URL`, `OPENAI_API_KEY`, `FACTORY_STORAGE_URL` / `FACTORY_STORAGE_SECRET` (or private R2 settings), and `SEARCH_CONSOLE_SYNC_SECRET`. Do not copy these into documentation. No new production secrets need to be shared with Codex.
6. Check `/api/health`, authenticated `/dashboard/meetings`, unauthenticated denial of `/api/meetings`, `/api/meetings/<id>/audio` and `/api/cron/meetings`, and 401 for an unauthenticated Omi POST.
7. Confirm cron status/logs contain the Meetings lane, migrations are applied, and the storage service's private endpoints still reject unauthenticated requests. Verify public website previews still load. Do not put a real recording into a public preview manifest.
8. An owner sets the meeting allowance, each owner creates their Omi connection personally, and each assistant user opts into meeting reads. These are activation steps, separate from deployment success.

Rollback: disable paid processing and Omi capture first; restore prior app/service commit if needed. Leave additive tables/columns in place. Do not drop tables containing recordings. Keep retention/cleanup running or schedule the equivalent authorized cleanup.

## Verification record

Release candidate verified in an isolated checkout based on `9d84028`, with only the 51 meeting/discovery files added. Concurrent unfinished employee-notification changes in the shared checkout were excluded and preserved.

- **909 tests passed; 431 skipped** across 93 passing and 17 skipped files. Meeting, sales, Operations OAuth and native-chat PostgreSQL suites used their named disposable local databases. Skips are other opt-in database/integration suites whose separate fixtures were not configured, not passing checks.
- **4 meeting browser journeys passed** on desktop and Chromium phone, including the upload workflow, synthetic OpenAI review, sparse prospect creation, discovery/referral persistence, private cross-user denial, authenticated audio ranges, deletion, synthetic Omi mapping/capture/playback, accessibility and horizontal overflow checks. These tests use the real app/API/DB with a guarded synthetic provider/storage transport; no real customer audio or provider request was used.
- **15 private storage HTTP tests passed**, including actual bytes, unauthorized denial, meeting/public-preview isolation, path traversal, symlinks, atomic writes, deletion and bounded queues.
- Lint passed. Final production Webpack build and TypeScript passed. **10 existing Sales browser tests passed** against that production build, covering website and automation opportunities, conversion, imports, viewer denial and desktop/tablet/small-phone accessibility. Production dependency audit found **0 vulnerabilities**.
- The browser checks caught and fixed server-side date formatting; targeted checks also cover expired-upload recovery, stale review edits and unlinking without deleting CRM records.

Commands (substitute the dedicated local PostgreSQL port, never production):

```powershell
$env:TEST_MEETINGS_DATABASE_URL='postgresql://ta_test@127.0.0.1:<port>/ta_meetings_test'
$env:TEST_SALES_DATABASE_URL='postgresql://ta_test@127.0.0.1:<port>/ta_sales_test'
$env:ASSISTANT_TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:<port>/ta_assistant_test'
$env:ASSISTANT_CHAT_TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:<port>/ta_assistant_chat_test'
npm test -- --maxWorkers=4 --reporter=dot
node --test apps/factory-render/service.test.mjs
npm run lint
npm run typecheck
npm exec next build -- --webpack
$env:TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:<port>/ta_reporting_browser_test'
node scripts/seed-reporting-preview.mjs
$env:REPORTING_TEST_DATABASE_URL=$env:TEST_DATABASE_URL
$env:REPORTING_TEST_PORT='3192'
$env:DASHBOARD_TEST_THEME='light'
npm exec playwright test -- --config playwright.meetings.config.ts
# Reseed before the separate Sales journey; production build must exist.
node scripts/seed-reporting-preview.mjs
npm exec playwright test -- tests/reporting/sales.spec.ts --config playwright.config.ts
```

Synthetic tests do not prove live OpenAI accuracy, physical Omi behavior, free-plan availability or production deployment. No real emails, SMS, calls or paid AI requests were sent during testing.

### Release and activation status

Pending final commit, push, Render web/storage/cron checks and the approved $10 dashboard setting. This paragraph is replaced with observed deployment evidence during release; it is not a completion claim.

## Sources checked

- [Omi raw audio format and developer setup](https://docs.omi.me/doc/developer/apps/AudioStreaming)
- [Omi integration types](https://docs.omi.me/doc/developer/apps/Integrations)
- [Official Omi webhook implementation](https://github.com/BasedHardware/omi/blob/main/backend/utils/webhooks.py)
- [Omi subscription explanation](https://help.omi.me/en/articles/12058411-understanding-omi-subscriptions)
- [OpenAI file transcription](https://developers.openai.com/api/docs/guides/speech-to-text)
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
