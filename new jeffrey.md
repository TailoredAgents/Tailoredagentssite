# Jeffrey — current status and remaining work

Updated October 24, 2026. Production evidence below was last checked at **21:25 UTC**. This is the main status checklist for Jeffrey's Meta, shared Sales email and SEO work. Setup commands live in the linked guides. Older release records describe what was true on their recorded dates; completed setup does not need repeating.

## Current state

| Area | What is working | What is still unfinished |
| --- | --- | --- |
| Facebook / Instagram | Austin confirmed website PageView and Lead tracking. The form-import code is deployed. | Connect the business Page to the CRM and prove real advertising-form submissions arrive. Website tracking alone does not import those forms. |
| Shared Sales inbox | Sales is live. Jeffrey sees it; sending to Gmail, receiving the reply and saving/opening the image from mail storage were verified. | Austin and Devon's own sign-ins, opening the image inside Team Inbox, Hotmail delivery and the remaining team workflow checks. |
| SEO monitoring | Free daily checks are enabled. All 14 registered pages were scanned successfully; scheduled background checks work. Google remains connected. | Observe the next day's complete scheduled scan. A scheduled check finding no work is different from completing a daily scan. |
| SEO recommendations | The spending controls, proposal/review tools and publishing safeguards are implemented. | Connect the dedicated OpenAI key, review business facts, complete the model pilot and approve paid operation. Paid AI is still paused. |

## Meta leads — remaining connection assigned to Jeffrey

Austin assigned this connection to Jeffrey on October 23. Coordinate business-account access with Austin. Reuse the existing business portfolio, Facebook Page, ad account and Pixel **1785858192683666**; do not install another tracking snippet.

Remaining work:

- [ ] **Jeffrey with Austin:** identify the correct Facebook Page and arrange access to its Meta developer app and leads.
- [ ] **Jeffrey with Codex:** securely connect the app/Page credentials and incoming-form notifications to the existing website. Complete any permissions or publishing requirements shown in Meta.
- [ ] **Together:** submit a test form, then an authorized ordinary public form. Verify one CRM lead with the correct details, no duplicates and access for Austin/Devon. Check Instagram too if it is used.
- [ ] **Codex:** verify interrupted imports resume and failed imports can be retried after fixing access.
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

These are recorded results, not a new production test performed during this documentation cleanup. Credentials, backups and private verification files remain outside Git.

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
