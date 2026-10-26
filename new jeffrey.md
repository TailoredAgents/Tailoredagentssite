# Jeffrey — current status and remaining work

Updated after the October 24, 2026 live Meta form test. Mail and SEO figures retain their recorded verification times below. This is the main status checklist for Jeffrey's Meta, shared Sales email and SEO work. Setup commands live in the linked guides. Older release records describe what was true on their recorded dates; completed setup does not need repeating.

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

- [ ] **Jeffrey with Codex:** `leads_retrieval` shows **Ready for testing** in Meta's dashboard. Open **Review → App Review** to identify the remaining requirements for this own-business integration. Complete any required usage explanations, demonstrations and submissions; [a truthful review draft is prepared](docs/META_SETUP.md#app-review-preparation). Meta's MCP review fields conflict; no completed review appears in its history. Do not infer approval or exemption from publication, token scopes, “Requirements: 0” or the successful test.
- [ ] **Together:** submit an authorized ordinary public form and verify its saved answers. The successful Meta test-tool submission does not establish access to every customer or Instagram placement lead.
- [ ] **Austin and Devon:** use their own accounts to open the received lead and confirm the details are useful for follow-up.
- [ ] **Together:** check Instagram placement delivery and phone-only submissions if those are used.
- [ ] **Codex:** complete live duplicate/recovery checks: replay the same provider lead without creating another CRM record, resume interrupted imports and retry failed imports after fixing access. Existing automated coverage is separate from these production checks.
- [ ] **Jeffrey with Austin:** decide who checks and assigns new leads, and verify any chosen alert method. Imported Meta leads currently arrive unassigned and do **not** automatically email the team or contact the customer. Older form submissions are not imported automatically.

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

New articles, broader automatic SEO repairs, city-ranking services, Google Business Profile work and client-site SEO are deferred. Meta Conversions API, automated team alerts and qualified/won feedback are later features. Twilio/calling development and the wider agency roadmap remain separate from this checklist; see [the agency roadmap](docs/AGENCY_OS_ROADMAP.md).

Work stays directly on **main**, preserving collaborators' changes. Keep this file as the current status record; keep reusable technical instructions in their setup guides.

## Website Factory — research and planning setup (October 26, 2026)

This is a separate addition to the Mail, Meta and SEO work above. Milestone 1 adds lead research, proposed plans, pre-approval chat, version history and approval saved to a build queue. The website builder, preview hosting, image/file uploads, exports and editing copilot are still later milestones. No Factory budget has been activated or paid model call verified by the implementation tests.

- [x] **Codex, October 26 at 21:28 UTC:** website implementation `0bb3a62` deployed successfully as Render `dep-dbfsb2h42hec739rm1t0`, including migrations `0029_website_factory.sql` and `0030_factory_costs.sql`. Austin's signed-in Website planning queue opened successfully with research paused, automatic intake off and $0 usage. Health passed; unsigned worker requests were rejected. No paid research was run. Cron configuration and live provider acceptance remain below.
- [ ] **Jeffrey:** optionally create a dedicated OpenAI project/key and set `FACTORY_OPENAI_API_KEY` privately on the website service. Otherwise the existing `OPENAI_API_KEY` is supported. Preserve the key used by calls and Inbox drafting. No provider key belongs on the cron service.
- [ ] **Jeffrey:** confirm the existing `tailored-agents-search-console-sync` cron has `FACTORY_WORKER_URL=https://www.tailoredagents.com/api/cron/factory`. Its existing `SEARCH_CONSOLE_SYNC_SECRET` is the fallback on both website and cron. If choosing a separate `FACTORY_WORKER_SECRET`, install the same new value of at least 32 random characters on both services. Keep reporting and SEO configuration intact.
- [ ] **Austin/owner with Codex:** choose and approve a separate Factory monthly allowance in **Sales → Website mockups → Website planning** settings. Research defaults off; the displayed $25 is only a suggested value. Review deliberately queued leads before enabling research. Keep automatic intake off for the initial pilot.
- [ ] **Together:** verify a real, approved pilot with sparse leads, uncertain company matches, chat revisions and exact-version approval. Approval currently saves `awaiting_builder` and does not produce a preview. Compare actual provider usage with conservative app estimates before enabling automatic research for new leads.

No Cloudflare/R2 setup or new paid builder service is required yet. Exact configuration, recovery behavior, synthetic test commands and official model/pricing references are in [Website Factory setup](docs/WEBSITE_FACTORY_SETUP.md). The complete remaining implementation checklist is in [AI Website Factory build plan](docs/AI_WEBSITE_FACTORY_BUILD_PLAN.md).
