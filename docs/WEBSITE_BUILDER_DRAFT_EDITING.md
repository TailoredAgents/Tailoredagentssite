# Website Builder: saved draft editing

October 27, 2026. Implemented, locally verified and deployed. This release implements the first correction-workflow recommendations from [the comparison research](WEBSITE_BUILDER_COMPARISON_RESEARCH.md); broader design and benchmark work remains. Live editor access is verified below; a successful paid client revision is not established by these checks.

**Read-only live checkpoint before this release:** the CRM shows Cosmo website **v6**, approved plan **v8**, failed quality checks at **6:38 PM EDT on October 27** with **82 overall against the 85 target**. Findings concern repetitive Services/About copy, oversized text bands and nested Contact padding. Website v3 remains the previous working preview. Plan v8 is therefore already approved, not awaiting approval. The editing release has not yet been deployed at this checkpoint; no live edit or successful replacement preview is established here.

## Salesperson workflow

1. Open **Website Builder**, choose the project, and select its newest finished or failed website version.
2. If checks failed, expand **Failed quality checks & screenshots**. Select the affected page to see its recorded issues and desktop/mobile captures. These are private review images; the failed website has no public sharing link.
3. Expand **Edit this draft**, then choose **Page** and **Part of the page**. The page introduction is separate from its content sections.
4. Choose **Edit text & layout** to make changes directly, or **Ask AI to refine** to describe a change to that selected part. Manual edits show the saved wording beside the proposed wording. Apply or discard unsaved changes before switching parts.
5. Select **Apply changes & check**. A new website version enters the existing build queue. Its saved images are reused; the normal content, desktop/mobile, visual and publication checks run. Open/share controls appear only after success. The previous working preview remains available if the revision fails.

The initial website still requires exact human plan approval. An explicit in-scope edit uses that existing approval; it does not send the salesperson back through planning. Submitting an edit is not a guarantee that it passes the checks.

## What this editor supports

| Mode | Supported behavior |
| --- | --- |
| Manual introduction | Change that page's headline and description. If a Home headline no longer contains its previously emphasized phrase, the obsolete emphasis is removed. |
| Manual content section | Change the heading, description, existing supported layout and item wording. Unbound section details can be added/removed within existing schema limits. Items with action or image bindings must retain their count and order. |
| Scoped AI revision | Give a direction for one selected introduction or section. The model receives the approved plan, saved website data and bounded screenshots of the affected page. It returns a content patch; application code applies only the selected target. |
| Restore | **Undo the last saved revision → Restore previous draft** creates another version from the immediate parent's saved draft. It retains the same approval and reruns checks; it does not overwrite or delete either version. |

This is a structured section editor, not a visual drag-and-drop canvas or an arbitrary-code agent. It does not change page lists/routes, forms and field definitions, contact channels, action destinations, palette, typography, image placement, saved assets or image-generation prompts. Adding pages, changing the business facts/scope, replacing images or choosing a materially different direction still requires the appropriate revised-plan/asset workflow and human approval. The customer-facing chatbot and a broader project-chat copilot remain separate work.

## Costs, versions and review

- A direct manual edit makes no text-generation request. Its fresh visual assessment can still incur AI cost. An AI edit adds one bounded patch request before assessment; restore also reruns assessment.
- All versions derived from the **same approved build request** share the configured per-website ceiling. Existing settled, reserved and uncertain charges count together. The approved pilot settings remain $50/month for building/images and $5 per approved website; research remains separate at $25/month. These are ceilings, not prices or automatic additional charges.
- Existing image bytes are copied into the child version after scope and hash verification. This editing path does not generate replacement images. It preserves image identities, provenance and the approved upload snapshot.
- New revisions start with their own normal review accounting but share cumulative spending. They do not reset the parent's counters, erase charges, or gain a fresh $5 allowance. A revision is already an explicit correction and does not receive another automatic full-site repair.
- A saved AI patch response survives a validation failure. Retrying revalidates that response rather than silently buying another generation request. Retry is technical recovery; edit the draft when the content needs a different correction.
- Stale fingerprints, newer versions and active builds prevent conflicting edits. Duplicate request IDs return the already-created revision. A failed older parent cannot be retried after a newer version exists.
- Completed preview/source files and saved draft snapshots are immutable. Each successful child has its own URL and source ZIP. The version selector keeps earlier results accessible; restoring creates a new checked version rather than changing an existing link in place.

## Private failure evidence

New failed checks retain actual rendered-page screenshots, ordered with failure pages first. Storage is bounded to ten pages/twenty images, 10 MB per image and 60 MB total. Errors are saved before image uploads, so an individual storage interruption cannot erase the diagnosis. Missing screenshots are explicitly shown as unavailable.

The screenshot endpoint accepts only implemented page paths and exact build-scoped keys. It checks current workspace access and the active lead before and after reading private storage. Responses are private, uncached and marked noindex. Public preview resolution still requires a ready version. Diagnostic projection excludes raw provider responses and prompts.

Both automatic correction and explicit AI refinement now receive bounded desktop/mobile overviews and readable detail crops from local QA captures when available. The image context is included in the existing cost reservation; it is not an extra image-generation stage. It helps the agent see a problem but does not make unsupported renderer controls editable.

## Compatibility and rollout

- `0034_factory_draft_snapshots.sql` adds a private snapshot for future completed builds. Deploy the migration with the CRM and updated worker before relying on editing after completion.
- A failed build is editable only when its saved blueprint, approved inputs and all required image checkpoints are complete.
- **Older completed builds may have no snapshot:** earlier releases cleared their worker data on completion. Their previews and downloads keep working, but this release cannot reconstruct a complete editable draft from exported HTML or backfill missing data. The editor is hidden for those versions. No automatic paid rebuild is started.
- Older failed checks may have only Home screenshots; the UI explains that limitation. New page evidence appears after a subsequent legitimate check, not retroactively.
- The current UI edits only the newest eligible version. Broader editing, arbitrary historical restore selection, full visual side-by-side revision comparison, new images/pages, reference-based design calibration and deployed mobile performance measurement remain future work.

## Verification recorded here

- The real disposable PostgreSQL build suite passed **47 tests**, including six draft-specific scenarios: workspace/viewer/deleted-lead boundaries; scoped patches and exact approval; idempotency/stale/current-build protection; immutable parents, image reuse and restore; AI screenshot context and saved-response replay; shared spending including uncertain charges. After the old-parent retry guard was added, the six draft cases passed again.
- Private evidence/access/HTTP suites passed **17 focused tests**. They cover failure-first capture, byte/page limits, missing uploads, path allowlists, sanitized diagnostics, legacy Home access and authorization changes during storage reads.
- Broader release validation passed **269 Factory unit tests**, **six browser workflows**, **16 Contact layout/region checks**, type checking, lint and a production build. Counts overlap with focused suites above and should not be added as unique tests. Deployment evidence belongs in the final release log. These synthetic/local checks do not establish live design scores, prospect appeal, real provider cost or production latency.

Implementation: [draft service](../lib/factory/draft-service.ts), [scoped patch validation](../lib/factory/site/draft.ts), [AI patch provider](../lib/factory/site/draft-provider.ts), [worker](../lib/factory/build-worker.ts), [failure evidence](../lib/factory/build-failure-evidence.ts), [editor](../components/factory/draft-editor.tsx).

## Live release verification

- Code release **`c7fdc906a95c89c9e8bc1b83dc5cd7b77c31e81c`** is live on the [CRM deployment](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbgisleq1p3s73fqn09g) and [builder deployment](https://dashboard.render.com/cron/crn-dbfth6uk1f9s73amh7ig/deploys/dep-dbgislmq1p3s73fqn18g). Render recorded migration `0034_factory_draft_snapshots.sql` applied at 7:06 PM EDT and the CRM live at 7:08 PM EDT.
- Signed-in read-only verification opened **Edit this draft** on Cosmo website v6 and loaded all five saved pages, existing section text and supported layout choices. The UI showed **$4.50 remaining** in this approved website's shared allowance. No edit was submitted and no paid generation, retry or approval was triggered by verification.
- Cosmo v6 remains failed at the previously recorded 82/100; this software release does not change its saved content or publish it. The previous v3 sharing link remains available. Its existing Home-only evidence cannot acquire historical missing page screenshots retroactively.
- [Live editor screenshot](previews/factory-draft-editor-live-cosmos.png). The next product phase is stronger design compositions and visual-plan/reference calibration, followed by actual human-approved output/cost measurements.
