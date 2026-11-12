# Meeting Intelligence and relationship discovery

Implementation and release runbook · updated November 12, 2026

## What this adds

- **Meetings & notes** under **Sales & prospects** is the shared entry point for **Add recording** (audio/transcripts) and **Quick capture** (typed conversation notes saved to a new or existing prospect). Recordings do not need a prospect, business or customer beforehand. The recordings list contains audio meetings; quick-capture notes remain on the connected relationship.
- Optional structured discovery on prospect, opportunity, client and contact pages. Original notes remain unchanged. New entries preserve their author and history. Possible automations are explicitly ideas to explore.
- A referral partner directory and introduction history, separate from the existing sales owner. Client account managers are separate from project delivery owners. Existing canonical CRM links make discovery and introductions visible after conversion; no commission logic or agreement terms exist.
- Private, resumable recording uploads; authenticated playback; transcription; evidence-backed AI findings; review notes; explicit linking or sparse prospect creation; unrelated/unmatched classification; explicit team sharing; retention and permanent deletion.
- Per-person Omi connections and a bounded, authenticated raw-audio receiver.
- Permissioned meeting search, findings and paginated transcript tools in the existing employee assistant and Operations MCP.

## Everyday workflow

1. Open **Sales & prospects → Meetings & notes → Add recording**.
2. Enter a title, select audio, record permission/consent notes and choose retention. WAV, MP3, M4A/MP4 audio and WebM are supported; maximum 24 MB, mono/stereo and 60 minutes. Larger recordings need a smaller audio export or separate parts. File headers and parsed duration are checked; filenames are not trusted as the format.
3. An interrupted upload can resume by selecting the **same original file**. Each 1 MB part is hashed; replaying a saved part is harmless, but replacing it with different bytes is rejected. Identical uploads by the same user open the saved recording. Other users cannot use this to discover another person's recordings.
4. Listen, then click **Transcribe & analyze**. Processing continues in the background. The shared scheduled worker normally runs every five minutes; longer recordings and a queue may take multiple worker cycles. Status is shown live. A failed or uncertain provider request requires an explicit retry and retains its allowance reservation.
5. Start with **Conversation at a glance**, then **Findings & evidence**. Open **Full transcript** to read the complete transcript; **Recording & processing** keeps playback and processing controls available and starts collapsed once findings exist. Read the full transcript and findings. Exact quotes support findings marked **stated**. This means the words appeared in the transcript, not that an assertion is independently true. AI suggestions, missing information and the AI summary remain separate from human-recorded discovery.
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
- Consent notes are an accountable record of what the uploader states, not an automated legal determination. Each receiving window needs permission appropriate to the participants.
- Recorded speech and AI output are untrusted data. They cannot instruct the system to send messages, grant access, create records or execute tools.

## AI and cost controls

- Reuses `OPENAI_API_KEY`. No second assistant or separate OpenAI account is required.
- File transcription: `gpt-transcribe`. Analysis: `gpt-6-luna`, structured output, no hosted tools, no external web search, `store:false`, 6,000 maximum output tokens. Each part transcript is bounded to 160 KB. Ordered transcripts are combined without truncation. Analysis accepts up to 160 KB combined; a larger meeting keeps its full transcript and asks the owner to separate recordings before analysis, without reserving an unusable analysis request.
- **Austin approved $10/month on November 10, 2026.** Activation is recorded in the release status below. New workspaces default to $0. An owner/admin sets the company allowance in Meetings & notes → Processing allowance & Omi devices. This is separate from chat, website builds and SEO. No production allowance is assumed from an earlier unrelated budget.
- Reserves **$0.006 per recorded minute, rounded up per audio part**, plus **$0.25 for one combined analysis**. A 90-minute meeting in nine 10-minute parts reserves **$0.79**. The detail screen shows the remaining estimate before processing; already-transcribed parts are reused. This is our conservative allowance policy, not a provider invoice or a guarantee of current model pricing. Reservations are not reconciled downward. The previous flat $0.30-per-part reservation no longer applies to new requests; historical reservations remain unchanged.
- Workspace/month rows are locked so concurrent jobs cannot reserve past the selected allowance. The accounting month uses America/New_York. The provider project can additionally have account-level controls; local reservations are not a provider billing guarantee for malformed media or future price changes.
- Uncertain requests retain their reservations and are not automatically retried. At most three requested transcription attempts per immutable recording and three analysis attempts per meeting content version. Separating recordings invalidates findings and requires a deliberate new analysis, while reusing saved transcripts and retaining earlier charges. Already-sent provider requests may finish after a pause/deletion; results cannot resurrect a deleted record.
- `MEETING_PROCESSING_ENABLED=false` pauses new paid processing. Setting the dashboard allowance to 0 also blocks new reservations; uploads/playback remain available.
- Uploads: at most 100 new manual recordings per workspace/day and 2 GB of active meeting media reserved/received. Omi: at most 230.4 MB per device per rolling day plus the workspace cap. This is separate from actual disk-free space. The existing preview disk also holds website artifacts; watch disk usage before expanding intake.

## Omi setup — Austin and Jeffrey each do this

Software setup does **not** prove the two physical devices work. No production Omi credential is created by deployment.

1. Update the official Omi iPhone app and device firmware. Record exact versions for the acceptance checklist below. Sign into your own Omi account and retrieve your Omi user ID from the app/account information. If the installed app does not expose it, obtain it through Omi's supported account/developer tools; do not put a guessed ID in the CRM.
2. Sign into Tailored Agents as the owner of that device: Austin for Austin's device; Jeffrey for Jeffrey's.
3. Open **Sales & prospects → Meetings & notes → Processing allowance & Omi devices**. Enter the device label and exact Omi user ID. Click **Create private connection**.
4. Copy the private webhook URL shown once. It contains a revocable 256-bit bearer secret. Never paste it into chat, this file, tickets, screenshots, analytics or public webhook testing sites. Only its SHA-256 hash is saved by the CRM. Revoke and recreate if lost or disclosed.
5. In the official Omi app, open **Settings → Developer Settings / Developer Mode → Realtime audio bytes**. Enter `<your-private-URL>,10` for a 10-second delivery interval, save and enable the integration. Omi app settings own live listening, recording and Bluetooth; this is not a custom companion app. Labels may vary by installed app version.
6. Back in the CRM, choose **Always ready · until I pause** under **Receiving mode**, save a standing recording-permission acknowledgement, and select automatic transcription/analysis within the meeting allowance. This is opt-in; existing connections stay paused/timed until their owner changes them. Timed 30–120 minute windows remain available. Start/stop intentional recording in Omi; the CRM accepts every valid delivery and cannot verify the intent or permission behind it. **Pause receiving** prevents new audio from being stored here; it does not stop Omi recording. Change recording/microphone settings in the official Omi app. Revocation invalidates the private webhook credential.
7. Confirm **Last audio** updates, the correct person's Meetings & notes page receives one private meeting, and playback is intelligible. A receiving window groups ordered audio parts; long streams roll over at 19.2 MB (10 minutes at 16 kHz, 20 at 8 kHz). An interruption or sample-rate change starts a new part in the same meeting, not a new prospect. **Finish receiving & save meeting** closes the CRM window and saves remaining parts. For **Always ready**, three minutes without deliveries closes the current meeting while the connection stays ready for the next one. The worker finalizes it on its next cycle, normally within five minutes; processing can take further cycles. The next arriving delivery also checks this boundary if the worker has not run. Timed mode keeps its original window-based grouping. A network outage can split a meeting; stopping/restarting within three minutes may group recordings together. Analysis waits until receiving has ended and every part is saved.

### Long meetings and networking events

- The first recording retains the meeting URL and CRM identity. Further parts are grouped under it and hidden from the top-level inbox. Each has its own intact audio object and ordered playback control; the combined transcript labels part boundaries. Arrival-time gaps and sample-rate changes are visible. This is **not** automatic speaker or business identification.
- At an event, use **Next conversation** before speaking with another owner. The next received audio starts another private, unmatched meeting without changing the receiving mode or deadline. This is a boundary between webhook deliveries, not an instantaneous hardware cut; a delivery already in flight may contain a small overlap. Pause receiving instead when consent does not cover the next conversation.
- After saving, **Separate another conversation** moves a selected part and all following parts into a new private meeting. Whole audio files and cached part transcripts remain intact. Existing CRM links stay with the original meeting; the new meeting must be reviewed and linked separately. Both analyses are invalidated, never silently reused for different people.
- Separation deliberately does not trim speech within a part. For an already-recorded part containing several people, export/trim it in an audio editor and upload the separate recordings; use Next conversation during future events. No waveform editor, microphone control, inferred identity or new mobile app is introduced.
- A meeting holds at most 24 parts before the next delivery starts another meeting. Existing 230.4 MB/device/rolling-day and 2 GB/workspace limits remain: roughly 120 minutes/day at 16 kHz or 240 at 8 kHz before retained-intake limits apply. Opening another window does not remove those limits. Manual uploads remain limited to 24 MB / 60 minutes per file.

### Paused delivery behavior

- Authenticate the private URL token, exact Omi UID, active non-viewer membership and non-revoked connection; validate the binary content type, bounded even PCM bytes and 8/16 kHz rate **even while paused**.
- Recheck the receiving mode/deadline under the workspace database lock. Valid but paused/expired deliveries receive HTTP 200 with `accepted:false`, `discarded:true`, `reason:receiving_paused`. No audio, hash, meeting, AI request or delivery timestamp is stored for that payload. General rate-limit counters may still update.
- Wrong/revoked credentials or mismatched UID remain 401; malformed audio stays 400/413/415; intake/rate limits still reject. A database/storage failure is not falsely acknowledged as successful storage.
- Omi's current developer sender treats any 2xx as success. Its public source records non-2xx failures and currently disables after 100 failures (with separate retry/circuit-breaker behavior); this is an observed implementation detail, not a permanent API promise. Success acknowledgement prevents intentional CRM pauses from contributing delivery errors. An already-disabled integration still needs to be enabled again in Omi.

### Verified protocol and its limitations

- Official documentation specifies HTTP POST, `application/octet-stream`, signed 16-bit little-endian **mono** PCM, with `sample_rate` and `uid` query parameters. This implementation accepts the documented 8 kHz and 16 kHz rates and rejects unsupported formats/rates and oversized bodies.
- Omi's current open-source receiver/sender path appends `sample_rate` and `uid` while preserving other URL query parameters. That supports our private `token` query parameter without a custom iPhone app or custom Authorization header. We do not treat `uid` alone as authentication.
- The token is intentionally in the configured URL because the documented developer flow does not offer custom headers. **Hosting/edge access logs may record query URLs.** Restrict log access and redact query strings in any external request logging/APM. The application never logs these URLs. Deploying this feature does not broadly change Cloudflare security rules.
- Raw audio has no guaranteed delivery ID, sequence number or recording-end signal. Immediate identical non-silent retries are suppressed within 30 seconds; silent chunks are retained. This is best-effort replay handling, not exactly-once delivery, complete conversation detection, or reliable reconstruction of missing/offline audio. Identical repeated speech could be mistaken for a retry. The UI discloses that recordings may contain gaps/repeats.
- App source currently splits deliveries into short chunks. Device/app/version and backend behavior can differ. It may depend on Omi's backend even though our transcription uses OpenAI. Do not assume the raw webhook bypasses every Omi subscription restriction or prevents audio from traversing Omi infrastructure.
- Official Omi docs explicitly require a **live listening session** for raw-audio delivery; historical/store-and-forward uploads do **not** replay raw audio to this webhook. The documented free processing allowance and ability to export recordings do **not** establish unlimited webhook delivery or background reliability. Manual uploading remains the fallback; a paid Omi subscription is neither purchased nor promised unnecessary for every device setup.

### Physical acceptance checklist (not completed by synthetic tests)

- [ ] Austin's device/app/firmware versions: ______; Omi user ID verified privately.
- [ ] Jeffrey's device/app/firmware versions: ______; Omi user ID verified privately.
- [ ] Each produces intelligible playback at the correct speed, under its own account.
- [ ] Verify 10+ minutes, pauses, segment boundaries and distinct speakers. The transcript does not promise speaker diarization or verified speaker names.
- [ ] Lock the iPhone, background the app, change Wi-Fi/cellular, disconnect/reconnect Bluetooth; note missing audio and behavior.
- [ ] Test offline recording/export and recovery. Do not assume automatic sync.
- [ ] Test on the actual free plan, including behavior when its processing allowance is exhausted. Ask Omi support if the installed app cannot deliver raw audio without paid processing.
- [ ] Revocation and expired receiving windows stop intake. Confirm other teammates cannot read private recordings.
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

- Implementation committed and pushed to `main`: **`6942518e6c748182e4cfaf28de1a4537bd5f5548`**.
- A private PostgreSQL logical export was created in Render Recovery at **4:28 PM Eastern, November 10**; its download became available before pushing. It remains in Render; no dump or credentials were copied into the repository. Render also displayed a seven-day point-in-time recovery window.
- **Website deployed successfully at 4:33:16 PM Eastern**: Render `dep-dbpopmff3r2c73aqcg50`, GitHub deployment `7694814057`. The authenticated Meeting Inbox rendered under Austin's Owner account.
- **Private preview/storage service deployed the same commit**, with its live-commit link verified in Render (`srv-dbfu0g2jnfac73elqll0`). Existing Cosmo v9 preview still returned HTML 200.
- **Shared cron deployed the same commit**: `dep-dbpopmvf3r2c73aqch9g`, service `crn-dbaggnjncjis73dgadhg`. First scheduled execution reported **`Meetings: 0 checked; 0 need review.` at 4:35:37 PM Eastern** and the whole cron run finished successfully at **4:35:49 PM**. Reporting, SEO and Website planning also completed without review errors.
- **The approved $10/month meeting allowance is saved in production.** Authenticated UI readback showed `$0.00 reserved of $10.00`, Eastern monthly accounting, and no Omi connections. The existing OpenAI configuration was recognized; its key was not revealed or changed. No recording has been paid-processed as part of release verification.
- Public acceptance: website/storage health **200**; unauthenticated meeting list, private audio, meeting cron, Omi POST and private-storage GET all **401**. No Cloudflare bypass or security relaxation was needed.
- Still requires Austin/Jeffrey: create each own Omi connection using the actual Omi UID, test the real devices/free plan/background/offline behavior, and review a harmless consented live transcription. Each assistant user explicitly opts into meeting reads. No production device credential or new assistant grant was created during this release.


## Sources checked

- [Omi raw audio format and developer setup](https://docs.omi.me/doc/developer/apps/AudioStreaming)
- [Omi integration types](https://docs.omi.me/doc/developer/apps/Integrations)
- [Official Omi webhook implementation](https://github.com/BasedHardware/omi/blob/main/backend/utils/webhooks.py)
- [Omi subscription explanation](https://help.omi.me/en/articles/12058411-understanding-omi-subscriptions)
- [OpenAI file transcription](https://developers.openai.com/api/docs/guides/speech-to-text)
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)


## Final pre-device readiness pass — November 10, 2026

This section supersedes the original flat reservation and one-meeting-per-segment behavior above. It does not claim physical-device acceptance.

### Scope and migration

- Migration **0056_meeting_groups.sql** adds parent/part metadata, preserves existing recording IDs/storage keys/transcripts, and versions analysis reservations. No audio or usage history is removed and no budget is changed. Existing single-file uploads and old request rows remain valid. A transcript completed by the previous worker during rollout is reused.
- No Mail or employee-assistant source is changed. Existing permissioned meeting tools read the combined root transcript. No new OAuth grants, credentials, paid services, notifications or real customer recordings are created for testing.
- Use the existing Render web build (`npm ci && npm run db:migrate && npm run db:retention && npm run build`). Take a private Render PostgreSQL recovery export first. The same existing shared cron calls `/api/cron/meetings`; no new service or schedule is needed. The private audio storage service needs no code/config change.
- If rollout fails, stop new paid meeting processing with the existing flag if necessary; preserve the database, audio and usage rows. Do not reverse the additive migration or delete parts to roll back. Older app code remains schema-compatible but does not understand new grouped conversations: keep grouped intake paused until the new release is restored.

### Verification and release evidence

Local verification passed in a detached checkout based on `8a31ca0`, with only this release’s scoped files overlaid. The full Vitest suite passed **933 tests**; **445 were skipped** because their separate optional integration environments/features were not configured. The final focused meeting suite passes **40 checks**, including two 90-minute synthetic meetings (8/16 kHz) with byte-for-byte ordered audio verification, one analysis each, owner separation, paused HTTP acknowledgement, rejected malformed/unauthorized payloads, duplicate suppression, preserved silence, interruptions, explicit networking boundaries, split privacy, cached-transcript reuse, linked sparse prospects, oversized transcripts, and deletion/expiry safeguards. No real provider request or email/SMS was sent.

- **15/15** actual private-storage HTTP/security tests passed; unchanged storage still denies public meeting media and enforces path, size, concurrency and authentication boundaries.
- **4/4** Playwright meeting journeys passed across desktop and phone: manual fallback, private playback/ranges, safe paused intake, grouped recordings, separation, AI review, sparse prospect linking and deletion. No serious/critical axe violations or horizontal overflow in the tested detail views. Desktop/phone screenshots were inspected.
- Lint, TypeScript, `git diff --check`, and the production webpack build passed. After the final receiving-status copy and auto-processing preference fix, the focused 40-test suite, lint and TypeScript passed again; the final production build passed for those same files before push.
- A private Render PostgreSQL export was created **November 10 at 5:17 PM Eastern** and the download became available in Render Recovery. It was not downloaded or made public. Seven-day point-in-time recovery is also shown by Render.
- **Code commit `fe13ff97373d1625f9685556267acb405122e0e7` is pushed to `main` and deployed.** Render web deployment `dep-dbppig2jnfac739dm51g` / GitHub deployment `7695932889` reported success at **5:25:31 PM Eastern, November 10**. Build logs show `0056_meeting_groups.sql` applied at **5:23:25 PM**, then successful production compilation and TypeScript.
- Authenticated production readback as Austin showed the new grouped-meeting instructions, **$0.00 reserved of $10.00**, and the new duration-based estimate. There were no meetings or Omi connections in that account. No production device credential was created and no production recording was uploaded or processed.
- External checks after deployment: Meeting API, private audio, Omi webhook, meeting worker and private storage each returned **401 without credentials**. Storage health and the existing Cosmo’s public preview returned **200**; there was no Cloudflare access block on these checks.
- The shared Render cron reports commit `fe13ff9` as deployed and its five-minute schedule unchanged. Its **5:25:31 PM** log showed `Meetings: 0 checked; 0 need review.`; the run finished successfully at **5:25:36 PM**. This verifies the live worker connection with an empty queue, not physical-device processing or real OpenAI transcription.
- **10/10 additional CRM sales browser checks passed** on desktop and phone, including networking discovery, non-website client conversion, permissions, responsive layout, and existing import/opt-out behavior.
- Live verification screenshot: `test-results/meeting-readiness-live.png` (local, ignored by Git). This section records the deployed code above; its documentation-only follow-up commit does not change runtime behavior.

### Still requires the devices

- Test Austin and Jeffrey independently with the actual official iPhone app and firmware, a short harmless consented sample first, then a long conversation.
- Verify audible quality and rate, background/locked-phone Bluetooth and Wi-Fi/cellular transitions, missed/repeated audio, receiving-window expiry and re-enabling in Omi if a prior integration was disabled.
- Confirm actual Basic/free-plan behavior, especially after its documented processing allowance. The CRM tests do not establish unlimited raw-audio delivery on that plan.
- Review transcript accuracy, actual OpenAI usage, and the networking boundary across real deliveries. Manual export/upload remains the fallback. A passing deployment is not evidence of hardware or provider accuracy.

References for this pass: [Omi audio streaming](https://docs.omi.me/doc/developer/apps/AudioStreaming), [Omi integrations](https://docs.omi.me/doc/developer/apps/Integrations), [developer audio sender](https://github.com/BasedHardware/omi/blob/main/backend/utils/webhooks.py), [developer failure tracking](https://github.com/BasedHardware/omi/blob/main/backend/database/webhook_health.py), [Omi subscriptions](https://help.omi.me/en/articles/12058411-understanding-omi-subscriptions), [GPT-Transcribe model](https://developers.openai.com/api/docs/models/gpt-transcribe).

## Always-ready receiving — November 12, 2026

**Implementation:** migration 0068 adds an opt-in boolean on existing connections; it does not change webhook hashes, UIDs, owners, existing windows, sharing, retention or budgets. The receiver and worker serialize idle-session closure with intake using the same workspace lock. All receiving/processing guards recognize this mode. Pause disables it; revoke invalidates the connection; Finish receiving saves only the current meeting and leaves always-ready enabled. New audio starts another private meeting. Standing permission notes are explicitly labeled as an owner acknowledgement, not independent verification of each participant's consent.

**Limits unchanged:** 30-day default retention; 230.4 MB/device per rolling day (about two hours at 16 kHz), 2 GB retained workspace intake, 24 parts per meeting, and the separate owner-configured monthly AI allowance. Always ready is not unlimited intake. The $10 allowance blocks further paid work when exhausted; it does not buy Omi service or guarantee delivery. Failed/uncertain provider calls remain reviewable and are not silently retried.

**Official iPhone app:** use the same account as the existing connection, On-Device transcription with raw forwarding enabled, Audio Bytes enabled at 10 seconds, and **live recording / Transcribe Later off**. Keep the phone online and the app foregrounded for the first test. The official app supports phone-microphone recording before hardware arrives. Current open-source capture code sends phone PCM16 at 16 kHz through the live socket; on-device transcription can separately forward raw audio. This is source evidence, not proof of the installed App Store version or free-plan behavior. Omi still transports raw audio through its backend. Historical/offline recordings are not replayed to Audio Bytes. Check Last audio and CRM playback, not merely a transcript inside Omi.

**Deployment:** take a private Render PostgreSQL recovery export; push verified main; the website build applies 0068 via the existing migration command. The unchanged shared cron already calls the website's meeting worker every five minutes. No new worker, secret, storage service, mobile app or subscription is required by this code change. Confirm the new website version, migration log, authenticated settings, worker log, private storage health and unauthenticated denials. Then enable the existing owner's connection (do not recreate or rotate it) and automatic analysis. To roll back, pause that connection first and restore the previous web version; leave the additive column and all recordings/usage intact.

**Acceptance:** run a harmless 60–90 second recording on the phone, confirm Last audio updates and a private meeting appears, stop Omi, then verify saved playback and a completed transcript/findings after the idle boundary and worker cycles. Repeat to verify a separate meeting without rearming. Actual app delivery, paid processing, locked-phone behavior, free-plan exhaustion and hardware Bluetooth require live acceptance; local mocks do not establish them.

Sources: [official phone-first setup](https://www.omi.me/pages/learn-set-up-omi), [capture controller](https://github.com/BasedHardware/omi/blob/main/app/lib/services/capture/capture_controller.dart), [audio protocol](https://docs.omi.me/doc/developer/apps/AudioStreaming), [integration limitations](https://docs.omi.me/doc/developer/apps/Integrations).

### Local verification for always-ready receiving

November 12: **42/42** focused meeting unit/PostgreSQL checks and **4/4** desktop/phone browser journeys passed using isolated local databases and synthetic audio/providers. The browser journeys now save Always ready, reload to verify persistence, deliver PCM, and check grouped private playback. **9/9** storage-client checks passed. TypeScript, lint, production Webpack build and whitespace checks passed. No real customer audio or provider request was used in these local checks. Production activation and real iPhone delivery must be recorded separately below. The unrelated generated next-env.d.ts development-path change is excluded from this release.
