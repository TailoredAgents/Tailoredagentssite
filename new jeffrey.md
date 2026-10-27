# Jeffrey — current status and remaining work

Updated October 27, 2026 for the ongoing Meta App Review test. Mail, SEO and Factory figures retain their recorded verification times below. This is the main status checklist for Jeffrey's Meta, shared Sales email and SEO work. Setup commands live in the linked guides. Older release records describe what was true on their recorded dates; completed setup does not need repeating.

## Current state

| Area | What is working | What is still unfinished |
| --- | --- | --- |
| Facebook / Instagram | The app is published, the Facebook Page is connected, and Jeffrey confirmed a Meta test-form submission appeared in CRM Leads. Austin previously confirmed website PageView and Lead tracking. | Resolve production permission/App Review requirements, then verify an ordinary public submission, Instagram delivery if used, duplicate/recovery behavior and teammate access. Decide who checks and assigns incoming leads. |
| Shared Sales inbox | Sales is live. Jeffrey sees it; sending to Gmail, receiving the reply and saving/opening the image from mail storage were verified. | Austin and Devon's own sign-ins, opening the image inside Team Inbox, Hotmail delivery and the remaining team workflow checks. |
| SEO monitoring | Free daily checks are enabled. All 14 registered pages were scanned successfully; scheduled background checks work. Google remains connected. | Observe the next day's complete scheduled scan. A scheduled check finding no work is different from completing a daily scan. |
| SEO recommendations | The spending controls, proposal/review tools and publishing safeguards are implemented. | Connect the dedicated OpenAI key, review business facts, complete the model pilot and approve paid operation. Paid AI is still paused. |

## Meta leads — connection and remaining checks

Austin assigned this connection to Jeffrey on October 23. The technical connection and initial test are complete: **Tailored Agents New** is published, the **Tailored Agents** Facebook Page is connected, and incoming-form imports are enabled. Production permission approval is still unconfirmed; publication and a successful test do not establish that App Review is complete or unnecessary. The existing Pixel **1785858192683666** remains in place. On October 24, Jeffrey submitted a Meta test lead and confirmed it appeared in the dashboard's Leads list. The existing five-minute worker also continues to complete successfully. [Verified connection details](docs/META_SETUP.md#verified-live-connection--october-24-2026).

Remaining work:

- [ ] **Jeffrey with Codex:** the `leads_retrieval` usage description and agreement are saved. The selected **Marketing API Access Tier** also requires API testing. A read-only batch is running against Tailored Agents' own advertising account, with a slower pace after one rate-limit response; [test details and pending verification](docs/META_SETUP.md#marketing-api-access-tier-testing--october-27-2026). After the batch finishes, confirm Meta credits the calls (its screen allows up to 24 hours), then complete the remaining descriptions, demonstrations and submission. [Review drafts](docs/META_SETUP.md#app-review-preparation) describe the actual app. Successful calls, publication and granted token permissions do not establish final approval.
- [ ] **Together:** submit an authorized ordinary public form and verify its saved answers. The successful Meta test-tool submission does not establish access to every customer or Instagram placement lead.
- [ ] **Austin and Devon:** use their own accounts to open the received lead and confirm the details are useful for follow-up.
- [ ] **Together:** check Instagram placement delivery and phone-only submissions if those are used.
- [ ] **Codex:** complete live duplicate/recovery checks: replay the same provider lead without creating another CRM record, resume interrupted imports and retry failed imports after fixing access. Existing automated coverage is separate from these production checks.
- [ ] **Jeffrey with Austin:** decide who checks and assigns new leads, and verify any chosen alert method. Imported Meta leads arrive unassigned and do **not** automatically email the team or contact the customer. Optional [team SMS alerts](docs/META_SETUP.md#team-sms-alerts-october-25-2026) are now implemented; verify the intended settings, recipients and delivery before relying on them. Older form submissions are not imported automatically.

Technical steps and interim alert options: [Meta setup](docs/META_SETUP.md). Website inquiry emails are a separate, working Resend feature; they do not prove Meta alerts work. No new paid alert service has been activated.

## Shared Sales inbox — remaining work

The setup is complete: **sales@tailoredagents.com** belongs to Jeffrey's existing Mail account, with explicit **read and send** permission for **jeffrey@tailoredagents.com**, **austin@tailoredagents.com** and **devon@tailoredagents.com**. Personal inboxes are outside that shared permission. Austin now has Mail management access; Jeffrey retains ownership. Devon has dashboard approval and remains a regular teammate. Passwords were not changed.

Remaining work:

- [ ] **Austin:** sign in with his own account, open Sales and confirm Mail's **Manage team** screen works.
- [ ] **Devon:** sign in with his own account and open Sales as a regular teammate.
- [ ] **Jeffrey:** open the Gmail reply in [Team Inbox](https://www.tailoredagents.com/dashboard/inbox) and confirm its logo attachment opens there. The saved file has already been downloaded and visually verified from private mail storage.
- [ ] **Jeffrey with Codex:** complete the authorized Hotmail send/reply check using the previously supplied test address.
- [ ] **Team with Codex:** finish the production checks for private drafts, internal notes, assignments, personal read states, denied/revoked access and safe retry behavior. These have automated coverage; the full live team workflow is still unconfirmed. Follow [email acceptance and recovery](docs/COMMUNICATIONS_SETUP.md#email-acceptance-and-recovery).

Use [the communications guide](docs/COMMUNICATIONS_SETUP.md) for setup/recovery and [Mail's guide](apps/mail/README.md) for mailbox operation. Team Inbox currently composes plain text and downloads incoming files. Rich formatting, signature banners and outgoing attachment uploads are available in the separate Mail app.

## SEO manager — remaining work

This release focuses on Tailored Agents' own website. The maximum is **$10 per UTC calendar month for SEO AI/data**, including tests, retries and unresolved charges. Up to **$5 of that same allowance** is reserved for the model pilot. Hosting, unrelated call analysis and taxes are separate. Recorded SEO AI spending is **$0** at the verification cutoff.

**DataForSEO and city-ranking measurements stay off.** Use the existing Search Console data and website scans. The five configured Georgia service areas are business context, not claims of offices or measured rankings in those cities. The existing background job is reused; no additional paid service was created.

Remaining work, in order:

1. [ ] **Jeffrey:** create/select the separate **Tailored Agents SEO** OpenAI project and enter its key privately. **Codex:** install it as `SEO_OPENAI_API_KEY` and verify the project spending control. Keep call-analysis credentials unchanged.
2. [ ] **Jeffrey:** review the services, prices, service areas and instructions in [SEO manager settings](https://www.tailoredagents.com/dashboard/seo#controls), then confirm the business facts are correct.
3. [ ] **Codex with owner/admin review:** compare Sol and Astra using the same real website evidence, run the five controlled safety cases and reconcile actual charges within the $5 pilot allowance. Sol is the proposed regular model; it has not yet passed the live pilot. Critical failures block activation.
4. [ ] **After approval:** enable weekly paid recommendations and observe genuine scheduled daily/weekly operation. The first weekly check can take up to seven days to observe.
5. [ ] **Owner/admin:** review the first justified title/description change. **Codex:** publish the approved wording and verify the actual public page. A valid “no change needed” result is acceptable, but does not prove live publishing.
6. [ ] **After publication:** wait for 28 complete Google reporting days, then review the result against the earlier period. Record limited evidence or no improvement honestly; a comparison alone does not prove the change caused the outcome.

The next complete daily scan also needs observation while paid AI remains paused. The [SEO setup and recovery guide](docs/SEO_MANAGER_SETUP.md) contains the commands, budget behavior, model-review requirements and rollback procedure.

## Release evidence

The Meta connection was verified separately after the earlier Sales/SEO release. Credentials, backups and private verification files remain outside Git.

- **Meta activation:** website source `91d6d55`, configuration deployment `dep-dbek4o7b9u1s73a0c830`, live October 24 at **23:42:58 UTC**. App publication, credentials, both webhook subscriptions and receiver verification were checked. Meta records the test submission at **23:56:36 UTC**; Jeffrey confirmed it appeared in CRM Leads. Scheduled runs completed successfully at **23:45:25**, **23:50:21** and **23:55:17 UTC**. See the [Meta evidence](docs/META_SETUP.md#verified-live-connection--october-24-2026) for scope and remaining checks.

The table and automated test totals below describe the **earlier October 24 Sales/SEO release, checked through 21:25 UTC**. They are historical evidence, not a claim that its application version or migration count is still the latest after collaborators' subsequent work.

| Item | Last verified result |
| --- | --- |
| Website and shared background job | Application source `3f32f50`. Website deployment `dep-dbei3do473hc7395njug` was live October 24 at 21:24:44 UTC; job deployment `dep-dbei3do473hc7395nku0` was live at 21:23:40 UTC. |
| Separate Mail deployment | Worker `df7992d5-4d35-4d59-bacb-9155610bec63`, from Mail source `d68637f`. Website pushes do not deploy Mail. |
| Database updates | Website migrations through `0018_affordable_seo.sql`; Mail through `0037_crm_mail.sql`. Matching CRM secrets and Sales grants are installed. |
| Mail delivery | Sales → Gmail delivered. Gmail → Sales reply arrived October 24 at 21:15 UTC. `Tailored-Agents-Google-Logo.png`, 9,186 bytes, was downloaded from private R2 and visually verified. |
| SEO scan | All 14 pages completed in production at 21:21:31 UTC, in a 31.31-second manual worker invocation. |
| Scheduled operation | At 21:25:27 UTC the real scheduled job checked both Reporting and SEO, with zero errors and no pending work. A repeated manual idle check took 0.451 seconds and created no additional scan. |
| Google connection | Active for `sc-domain:tailoredagents.com`; imported coverage reached October 21 at the last database check. |
| Availability | Public health, contact, sign-in and Mail pages responded successfully. Anonymous SEO access redirects to sign-in; an unsigned SEO worker request is rejected. |
| Recovery | Private Mail/database exports and the Mail recovery bookmark were saved. Temporary database access was removed and the original restriction restored. Populated test-database upgrade and restoration passed. |

Automated verification: **446 website tests**, followed by **nine targeted worker checks**; **406 Mail tests** and **12 Mail browser checks**; **10 Team Inbox browser checks**; **eight SEO desktop/phone browser checks** across light and dark appearances. Lint, strict types and production builds passed. These results establish tested behavior, not unperformed live acceptance.

The website dependency audit had no findings. Mail had no moderate/high/critical findings; three low dependency entries remain for two SvelteKit features this app does not use. See [the dependency assessment](apps/mail/README.md#october-24-shared-sales-acceptance-and-dependency-review).

During the first free scan, sampled website CPU stayed below 0.04 CPU, memory below 114 MB and reported 95th-percentile HTTP latency was about 0.213 seconds. This brief sample does not establish paid-AI performance or a monthly hosting bill. Extra active job runtime remains billable.

## Later work

New articles, broader automatic SEO repairs, city-ranking services, Google Business Profile work and client-site SEO are deferred. Meta Conversions API and qualified/won feedback are later features; team SMS alerts are implemented with live acceptance still to verify. Twilio/calling development and the wider agency roadmap remain separate from this checklist; see [the agency roadmap](docs/AGENCY_OS_ROADMAP.md).

Work stays directly on **main**, preserving collaborators' changes. Keep this file as the current status record; keep reusable technical instructions in their setup guides.

## Website Factory — research and planning setup (October 26, 2026)

This is a separate addition to the Mail, Meta and SEO work above. Milestone 1 adds lead research, proposed plans, pre-approval chat, version history and approval saved to a build queue. The website builder, preview hosting, image/file uploads, exports and editing copilot are still later milestones. Austin explicitly approved **$25/month for research and planning** on October 26, 2026. Live settings are saved and verified for a manual pilot, and Austin confirmed the first live research-to-plan result at 5:56 PM EDT. Actual cost, cron environment/log inspection, live chat revision and human approval remain unverified.

- [x] **Codex, October 26 at 21:28 UTC:** website implementation `0bb3a62` deployed successfully as Render `dep-dbfsb2h42hec739rm1t0`, including migrations `0029_website_factory.sql` and `0030_factory_costs.sql`. Austin's signed-in Website planning queue opened successfully with research paused, automatic intake off and $0 usage. Health passed; unsigned worker requests were rejected. No paid research was run. Cron configuration and live provider acceptance remain below.
- [ ] **Austin/Codex:** optionally configure a dedicated OpenAI project/key as `FACTORY_OPENAI_API_KEY` privately on the website service. Otherwise the existing `OPENAI_API_KEY` is supported. Preserve the key used by calls and Inbox drafting. No provider key belongs on the existing reporting/research cron service.
- [x] **Austin/Codex — Render, October 26:** inspected the existing `tailored-agents-search-console-sync` cron (`crn-dbaggnjncjis73dgadhg`): `npm run search-console:sync`, five-minute schedule, exact `FACTORY_WORKER_URL=https://www.tailoredagents.com/api/cron/factory`, and existing `SEARCH_CONSOLE_SYNC_SECRET` present. The 6:45 PM EDT scheduled run succeeded in 29.8 seconds; its 6:45:44 PM log reported “Website planning: 0 checked; 0 need review.” No existing cron settings or secrets were changed. This confirms idle scheduled routing, not additional research quality, paid usage or approval acceptance.
- [x] **Austin:** approved a separate **$25/month research and planning allowance** on October 26, 2026, followed by **$50/month and $5/site builder/image ceilings**. These ceilings are not expected prices. Building was disabled at this research checkpoint; its later all-Render activation is recorded below.
- [x] **Codex, October 26 about 5:51 PM EDT:** saved and read back the live **Sales → Website mockups → Website planning** settings under Austin Owner: research enabled, automatic intake off and monthly limit $25. The queue contained zero workspaces and $0 estimated/reserved usage; the paused banner was removed. Keep automatic intake off for the initial pilot. This confirms the settings, not a working cron or completed provider call.
- [x] **Austin, October 26 at 5:56 PM EDT:** confirmed the first live research and plan. His screenshot showed version 1 **Ready to review**, two research sources, and separate submitted details, possible matches and unknowns. This confirms the basic live provider workflow; it does not establish a measured charge, inspected cron logs, chat revision, human approval or a build.
- [ ] **Together:** continue the broader pilot with sparse leads and uncertain company matches; verify exact-version approval. Austin confirmed live planning chat works. The original research release only saved approvals to the queue; the all-Render builder is now enabled as recorded below, and an approval can start work. Compare actual provider usage with conservative app estimates before enabling automatic research for new leads.

The research milestone requires no new storage or builder service. The website-builder setup below is now all Render; the earlier Cloudflare proposal has been superseded. Exact configuration, recovery behavior, synthetic tests and pricing references are in [Website Factory setup](docs/WEBSITE_FACTORY_SETUP.md). The remaining implementation checklist is in [AI Website Factory build plan](docs/AI_WEBSITE_FACTORY_BUILD_PLAN.md).

## Website Factory — approved website builds (October 26, 2026)

**Current setup — ready for Austin's first plan approval:** the CRM, preview/storage service and reused builder are live from `e3acba848a7d77e81310aab96864ab976da0ef12`. Production storage/authentication/persistence, sandboxed Chromium and the resumed idle cron passed. Building is enabled and its $50/$5 settings verified after reload. **Jeffrey has no remaining Factory infrastructure task.** The first real-client plan still needs Austin's approval; no paid site has been generated. Unrelated Mail, Meta and SEO tasks above remain unchanged.

This extends working research/planning chat; **do not redo or disable the existing research setup**. Austin approved a separate **$50/month website-build/image allowance and $5/site ceiling**. Under $1 per initial preview is an unmeasured target, not a charge or guarantee. Hosting/storage remain separate. The builder is resumed and building enabled. Final CRM readback shows one plan ready for review, zero previews and $0.00 estimated/reserved builder usage; no real-client plan was approved by deployment checks. Actual site editing through chat remains the next milestone.

**Superseded Cloudflare proposal:** Jeffrey was previously assigned a private R2 bucket, scoped credentials, a preview Worker at `previews.tailoredagents.com` and private handoff. Do not perform those Factory tasks for this implementation. The R2/Worker code remains an optional fallback, and a custom domain can be considered later. The default HTTPS `onrender.com` address lets the current setup proceed without DNS changes.

- [x] Deploy the additive website code and migration `0031_factory_builds.sql` with **Enable website building** off. Source `1fb1d0f` was pushed to `main`; Render `dep-dbfta4vb9u1s73bugmkg` and GitHub deployment `7345235695` report success. Signed-in Owner readback showed research enabled/automatic intake off/$25, one plan visible, building disabled/$50 monthly/$5 per site and $0 estimated/reserved builder usage. The remaining configuration message is “Private website storage needs to be connected.” Health returned 200; anonymous source access and unsigned preview resolution returned 401. No paid build or new service was activated.
- [x] Standalone CLI startup correction verified: async startup and portable image imports pass ten focused tests, lint, type checks and a production build. The actual Dockerfile/default command starts offline as `pwuser` with only the expected sanitized missing-database error when credentials are absent. Follow-up source `2f4acb22b6531c4a530bb3fe3ff27afbd7e197c4` deployed successfully as Render `dep-dbftct95efls73ecjp1g` / GitHub deployment `7345338624`. Use that revision or newer verified main for the builder. This is website release evidence; no production builder service had been activated at that checkpoint. Subsequent provisioning is recorded below.
- [x] **Austin/Codex — Render, October 26 at 6:47:55 PM EDT:** created the separate `tailored-agents-website-builder` cron (`crn-dbfth6uk1f9s73amh7ig`) in TA / Production from main `f4be5ee241ac80f8fae0b3117a059b49423fa829`. It uses `deploy/factory-builder.Dockerfile`, repository-root context, `1c-2g` / 2 GB RAM and the five-minute schedule `*/5 * * * *`. Ohio matches the CRM database's private-network region. Existing database/provider credentials plus the intended bucket name and preview origin were saved privately. Deployment `dep-dbfth6uk1f9s73amh840` succeeded at 6:48:53 PM EDT.
- [x] **Austin/Codex — Render:** the isolated startup ran successfully from 6:49:08–6:50:04 PM EDT (Render duration 56.7 seconds), logging `status:'unconfigured',more:false`. Real CLI imports, CRM database connectivity/recovery and clean exit passed without provider calls; live Chromium, AI generation, storage and preview execution were not exercised. Render confirms **Manually suspended** after reload. The 6:50 PM scheduled run was canceled by suspension after 31.5 seconds, as expected. CRM readback still shows building disabled, $50/$5 ceilings, $0.00 builder usage and missing private storage; research remains enabled at $25 with automatic intake off. Website health returned 200.
- [x] **Austin/Codex — Render:** deployed `tailored-agents-site-previews` (`srv-dbfu0g2jnfac73elqll0`) at `https://tailored-agents-site-previews.onrender.com`, Ohio / `0.5c-512mb`, with a 5 GB disk at `/var/data/factory`. Deployment `dep-dbfu0gijnfac73elqmq0` started October 26 at 7:20:34 PM EDT and succeeded in 51.3 seconds. The service has only the two Factory secrets, resolver URL and storage-directory configuration; no database or AI keys. Local verification passed 10 service tests, 113 Factory tests across 12 files with all disposable test DBs, a production build, and non-root Docker checks on 512 MiB / 0.5 CPU.
- [x] **Austin/Codex — Render:** installed matching storage and preview configuration on all three services. Both client URLs use the actual preview-service origin; the two independent 32+ character secrets are private. CRM deployment `dep-dbfu0tajnfac73elruhg` started at 7:21:25 PM EDT and succeeded in 1 minute 59 seconds. Private synthetic upload/read, anonymous storage 401, bounded read 413 (`maxBytes=1` for a 64-byte artifact) and direct public artifact 404 passed. Bytes survived the 7:22 PM service restart, and exact-prefix cleanup then returned 404. Unknown public preview and authenticated CRM resolver both returned 404, confirming the resolver connection without creating a published site.
- [x] **Austin/Codex — Render:** updated and resumed existing builder `crn-dbfth6uk1f9s73amh7ig`; deployment `dep-dbfu1gifngtc7382tve0` succeeded in 35.4 seconds on `e3acba8`. The old builder R2 bucket variable was removed. No duplicate service was created; reporting/research remain separate.
- [x] **Austin/Codex — runtime/activation:** actual Render builder Chromium passed as UID 1001 with `chromiumSandbox:true`, sanitized environment and blocked network, producing an 8,957-byte screenshot from synthetic HTML. The resumed 7:25:06–7:25:53 PM EDT cron run succeeded and logged `status:'idle',more:false` at 7:25:37 PM. Building is enabled and verified after reload at $50/month and $5/site, with $0.00 estimated/reserved usage, zero previews and one plan ready for review. No real-client plan was approved. Docker runs `--drain`, exiting idle or stopping before another claim after 30 stages / 30 minutes.
- [ ] **Austin — next:** choose and approve the exact real-client plan in the CRM. Building is already enabled; that approval lets the worker generate the selected version. Hosting or budget authorization does not approve an unapproved plan. No repeated allowance approval is needed.
- [ ] **Austin/Codex:** verify one deliberate live build, desktop/mobile appearance, screenshots/source access, preview revocation/renewal and a clean ZIP export via `node build.mjs`. Record actual cost and runtime before broadening the pilot.

All three Render services are connected, the existing builder is resumed and building is enabled. A real website still requires Austin to approve its exact plan. Next we inspect that first paid output, its actual cost and the source export. No Cloudflare account or Jeffrey handoff is required.

Render's setup UI displayed **$7/month for the preview/storage service + $1.25/month for its disk = $8.25/month**, separate from AI usage and the existing cron's active-time billing. The cron has a **$1 monthly minimum**, not a flat $1 bill. [Render cron billing](https://render.com/docs/cronjobs#billing). These are displayed rates, not a measured invoice; no paid website generation has been run at this checkpoint. A local non-root, sandboxed Docker renderer check generated three pages and six screenshots in 14.85 seconds under 0.5 CPU / 512 MiB, peaking at 431 MiB. Keep the builder's 2-GB default until full workloads are measured; that test does not determine the separate preview service's capacity.

Hero upload currently accepts one PNG/JPEG/WebP up to 5 MB and supplies the main visual. Logo placement/multiple asset roles and visual planning-chat analysis remain future work. A preview is a demo until real forms, integrations, content and domain are finalized.

Exact per-service setup, recovery and acceptance are in [Website Factory setup](docs/WEBSITE_FACTORY_SETUP.md#milestone-2-private-storage-preview-hosting-and-build-worker). Keep this addition alongside the existing Mail, Meta and SEO tasks.
