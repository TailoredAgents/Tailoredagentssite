# Connected-call recordings, transcripts and summaries

**Owner confirmation, October 22, 2026:** following deployment and the activation instructions, the owner reports that the recording/analysis setup is verified. Treat initial OpenAI activation and the basic live recording/analysis check as completed by the owner. This is owner-reported acceptance; it does not claim independent production testing of every deletion, retention or access-control scenario. The setup instructions below remain a reference for future configuration.

October 22, 2026. The owner reports live calling and two-way SMS are working. This increment adds automatic connected-call recordings and optional OpenAI analysis to that existing Inbox. New recording/transcript acceptance is separate from that earlier calling confirmation.

## Behavior

- New answered incoming and outgoing calls are recorded automatically in dual-channel audio. As explicitly requested by the owner, the recording announcement defaults **off**. Owners/admins can change automatic recording, announcement and automatic analysis in **Settings → Calling → Recordings & transcripts**. Changes apply to subsequent calls; a call snapshots its recording settings before dialing. Calls already in progress at deployment are not retroactively recorded.
- Incoming calls that immediately go to voicemail retain the separate voicemail recording path. Connected-call capture starts at answer, rather than recording ringing. The existing one-hour call limit remains. A pending card does not claim the provider has delivered audio.
- The call's timeline entry contains an authenticated audio player and an expandable transcript/summary section. Summaries contain highlights and suggested follow-ups with expandable verbatim transcript evidence. Suggested follow-ups can be edited and copied into a task/reply; they do not create tasks, update CRM fields or send messages automatically. Edits here are temporary until copied/saved elsewhere.
- Call read grants cover the recording and analysis. The existing recording-management grant (`can_manage_voicemail` in storage) permits deleting both voicemail and connected-call audio. The updated Settings labels explain this. A viewer remains read-only. Current membership, workspace, line/account and grants are checked again on each protected request, including after provider audio retrieval.
- Signed recording callbacks are tied to the chosen call and independently verified against Twilio's account, parent call, source, channel count and duration. Duplicate callbacks cannot requeue finished analysis, replace an established recording identity or resurrect deleted content. A bounded worker poll recovers missed callbacks; provider outages are not classified as proof that no recording exists.
- Audio, transcript and summary share a **90-day** expiry. Reads immediately hide expired/deleting/deleted content. Deletion immediately erases local transcript/summary and hides playback, then removes provider audio. Failed provider deletions retry in the scheduled worker, at most ten attempts; inspect exhausted failures. Twilio storage charges can continue until provider deletion succeeds.

## Enable analysis in Render

Recording uses the existing Twilio connection and requires **no new number webhook or TwiML App changes**. The application includes its signed recording callback in the generated TwiML.

1. Deploy website migration **0014_call_recordings.sql** and this source. The existing Render build applies migrations automatically. Existing verified lines default to recording on, announcement off, automatic analysis on, matching the owner's instructions. Existing call history is preserved.
2. In the **tailored-agents-web** service's **Environment**, add `OPENAI_API_KEY` using the owner's API key. Keep it server-only. Add `CALL_ANALYSIS_ENABLED=true`. Save and redeploy. Keep existing Twilio, Mail and worker secrets unchanged; never put keys in chat, source or screenshots.
3. Check **Settings → Calling → Recordings & transcripts** for the three preferences. Recording works independently of the OpenAI switch. Automatic analysis begins for new ready recordings when its configuration is enabled. Earlier ready recordings can be queued using **Generate transcript & summary**.
4. Confirm the existing **tailored-agents-search-console-sync** cron service is running. Its repository schedule is every five minutes and its existing shared secret authenticates `/api/cron/search-console`. This endpoint now runs bounded recording maintenance and analysis stages alongside reporting; the script continues while due work remains, within its existing 210-second invocation budget. No OpenAI key belongs on the cron service: processing happens in the web service.
5. Place one short owner-authorized test call, hang up, and refresh the conversation. Verify playback first. After a worker run, expand **Transcript, summary & follow-ups** and verify the transcript, summary and evidence. Check **Trigger Run** on the existing cron service if waiting for its next schedule. A summary failure retains a successful transcript; an explicit retry resumes the missing stage.

The implementation does not inspect or set the production key, run a real OpenAI request, place a real call, or independently confirm the new recording workflow. Those are the owner acceptance steps above. Jeffrey's shared-email handoff stays separate.

## Processing and limits

The existing authenticated worker leases one eligible recording stage at a time using a unique token. Each provider attempt is recorded before I/O; completion requires the same lease, ready audio and unexpired retention. Two worker invocations cannot claim the same stage. A deleted or expired recording cannot have transcript/summary restored by an in-flight result. A stale lease becomes a visible failure requiring review rather than silently repeating a paid request.

Transcription is checkpointed before summarization. Each stage permits at most three attempts, including explicit retries. Summaries are schema-validated; every evidence quote must occur verbatim in the transcript. Call content is untrusted model input, no tools are supplied, and no external or CRM actions are executed by a model. Model output is rendered as plain text.

The adapter uses [GPT-Transcribe](https://developers.openai.com/api/docs/guides/speech-to-text) at `/v1/audio/transcriptions` and [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) with [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) at `/v1/responses`, with `store:false` on summaries. No deprecated Whisper model was copied from the reference project. The first version provides full transcript text and verbatim evidence, not speaker identities or invented timestamps.

Audio playback is bounded to 64 MiB; the first transcription version accepts at most 24 MiB and 150,000 transcript characters. Oversized/empty audio, unavailable models/credentials, timeouts, refusals, invalid summaries and unsupported evidence become visible failures. Long-audio chunking, timestamped/speaker-labeled transcripts and task creation directly from a suggestion remain refinements. Playback can remain available when analysis fails. API calls have fixed official origins, redirect refusal, response-size bounds and timeouts; provider credentials and recording URLs never enter the browser.

Reference reviewed: StonegateOS's [call-analysis adapter](https://github.com/TailoredAgents/StonegateOS/blob/main/apps/api/src/lib/call-analysis.ts), [recording persistence](https://github.com/TailoredAgents/StonegateOS/blob/main/apps/api/src/lib/call-recording-persistence.ts) and [outbox recovery](https://github.com/TailoredAgents/StonegateOS/blob/main/apps/api/src/lib/call-recording-outbox.ts). Reused the design principles of durable attempts, separate stages, bounded retry and cleanup; no Stonegate records, accounts or home-service fields were imported.

## Verification

Verification: 345 code/PostgreSQL tests across 35 files, all 20 existing/new calling desktop/phone scenarios, the new recording flow in both light/dark palettes, and four shared Inbox history/draft/send regression checks passed. Lint, TypeScript and the production build passed. Synthetic browser fixtures generate fake dual-channel audio references and preseed analysis for UI checks; code/database tests exercise the actual lease/checkpoint/retry/deletion flow with mocked providers. These checks make no live Twilio/OpenAI requests. Deployment and new owner acceptance remain separate from these automated results.

Previews: [desktop](previews/call-recording-desktop.png), [phone](previews/call-recording-phone.png), [dark desktop](previews/themes/dark/providers/call-recording-desktop.png), [dark phone](previews/themes/dark/providers/call-recording-phone.png).

## Website delivery

Source **423106aa7ebd5bf777de2c83c6a6a8b8a9561ff9** was pushed to `main`. Render reported success on **October 22, 2026 at 2:26:16 p.m. EDT** (18:26:16 UTC), GitHub deployment **7260177290**, [Render deployment](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbd59mgu01pc73bn9d4g). Health and sign-in returned 200; anonymous Inbox/connected-recording media requests redirected to sign-in (307); recording and customer-answer callbacks rejected GET (405). The workspace was clean after pushing. No live recording, transcription or summary was independently generated in this release check; the owner still adds the OpenAI key/switch and performs the short acceptance call.
