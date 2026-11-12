# Final employee-software visual acceptance

November 11, 2026. Baseline: `0c7b420`, following the seven scoped polish releases. This pass completes the local route review and fixes the remaining defects found in that review. It does not certify every device, provider outcome or permission/data permutation, or establish production deployment.

## Changes from the acceptance pass

- **V28 — phone sign-in:** put the form before the brand introduction at narrow widths, retain the desktop two-column composition, compact the phone header and use 16px phone inputs. Update introductory copy to the current AI/automation direction. Authentication and access messages are unchanged.
- **V37 — Services:** wrap the three filters, identify the selected view with `aria-current` and a theme-aware underline/fill, apply the existing record/delivery spacing, and show readable review dates and singular/plural incident counts. The existing incident-first detail layout remains.
- **V38 — partner statements:** include the partner and organization, readable calendar dates and “1 source entry.” Partner context is fetched only after the existing statement/partner authorization checks. Exact-total confirmation, revision checks and the no-funds-transferred explanation remain unchanged. The earlier delivery pass improved framing; this pass completes the context/date/count work its summary implied was already finished.
- **V33 — search focus:** remove the inner duplicate outline from New conversation while retaining the outer focus indicator. Fix an additional observed keyboard defect: Escape in the page finder also closed the mobile menu underneath. The dialog now contains that key event and restores the original visible control, including when opened with Ctrl+K from a closed menu.

## Fresh route coverage

All **43 committed dashboard page templates** rendered and were visually inspected at a 1024 × 768 viewport with isolated synthetic data. This adds tablet coverage to the earlier desktop/mobile evidence. Each row below names a representative accepted screenshot. The initial ordinary sales-task ID returned the expected 404; the proper populated call-task fixture was subsequently inspected and is the entry below.

Screenshots and the measurement manifest are retained outside Git at `C:/Users/xenon/AppData/Local/Temp/ta-premium-pass-20261111/final-evidence/`. Earlier loading/stale frames are retained for chronology; use the accepted captures named here and below, not filenames alone, as evidence. No observed accepted route state had page-wide horizontal overflow. This is not an assertion about every possible long value or expanded state.

| Route | Representative screenshot (`.png`) |
| --- | --- |
| `/dashboard` | `finder-tablet-light` |
| `/dashboard/activity` | `activity-tablet-light` |
| `/dashboard/analytics` | `analytics-tablet-light` |
| `/dashboard/assistant` | `assistant-ready-tablet-light` |
| `/dashboard/assistant/documents/[id]` | `document-tablet-light` |
| `/dashboard/assistant/knowledge` | `knowledge-tablet-light` |
| `/dashboard/assistant/knowledge/[id]` | `guidance-tablet-light` |
| `/dashboard/assistant/routines` | `routines-loaded-tablet-light` |
| `/dashboard/calendar` | `calendar-tablet-light` |
| `/dashboard/capture` | `capture-tablet-light` |
| `/dashboard/clients` | `clients-tablet-light` |
| `/dashboard/clients/[id]` | `client-tablet-light` |
| `/dashboard/clients/[id]/contacts/[contactId]` | `contact-tablet-light` |
| `/dashboard/inbox` | `inbox-tablet-light` |
| `/dashboard/inbox/new` | `new-conversation-production-tablet` |
| `/dashboard/leads` | `prospects-tablet-light` |
| `/dashboard/leads/[id]` | `prospect-tablet-light` |
| `/dashboard/meetings` | `meetings-tablet-light` |
| `/dashboard/meetings/[id]` | `meeting-tablet-light` |
| `/dashboard/partners` | `partners-tablet-light` |
| `/dashboard/partners/[id]` | `partner-tablet-light` |
| `/dashboard/partners/statements/[id]` | `statement-production-tablet` |
| `/dashboard/projects` | `projects-tablet-light` |
| `/dashboard/projects/[id]` | `project-tablet-light` |
| `/dashboard/relationships/[kind]/[id]` | `relationship-tablet-light` |
| `/dashboard/sales` | `sales-tablet-light` |
| `/dashboard/sales/[id]` | `opportunity-tablet-light` |
| `/dashboard/sales/factory` | `builder-tablet-light` |
| `/dashboard/sales/factory/[id]` | `build-tablet-light` |
| `/dashboard/sales/factory/new` | `new-build-tablet-light` |
| `/dashboard/sales/factory/settings` | `builder-settings-tablet-light` |
| `/dashboard/sales/imports` | `imports-tablet-light` |
| `/dashboard/sales/mockups` | `mockups-tablet-light` |
| `/dashboard/sales/today` | `my-day-tablet-light` |
| `/dashboard/seo` | `seo-tablet-light` |
| `/dashboard/seo/changes/[id]` | `seo-change-tablet-light` |
| `/dashboard/services` | `services-production-tablet` |
| `/dashboard/services/[id]` | `service-tablet-light` |
| `/dashboard/settings` | `settings-tablet-light` |
| `/dashboard/sites` | `sites-tablet-light` |
| `/dashboard/sites/[id]` | `site-tablet-light` |
| `/dashboard/smart-cards` | `smart-cards-tablet-light` |
| `/dashboard/tasks/[id]` | `call-task-tablet-light` |

## Responsive and interaction acceptance

| Check | Observed result |
| --- | --- |
| Sign-in | Desktop composition retained at 1309 CSS px; narrow form-first layout at 320 CSS px in the final production build, and an additional 291px stress sample. The 127.0.0.1 host had existing 110% browser zoom; measured CSS widths, rather than the requested override, are reported. No credentials entered. |
| Services | 1440px desktop, 1024px tablet, 390px light and 320px dark. All services, My services and Needs attention selections visibly update; all short filters wrap within the viewport. Readable review date and “1 open incident.” Add-service disclosure and its first fields inspected at 320px; no record created. |
| Statement | 1024px light and 320px light/dark. Partner/context and singular count visible. Source entry date readable. Review note, unchecked exact-total confirmation and review button fit at 320px. No financial transition submitted. |
| New conversation | 1024px and 320px focused search. One outer focus indicator; computed inner input outline is `none`, also verified in the production build. |
| Page finder | 1024px and 320px; search initially focused, no-results presentation inspected. Escape from the mobile menu leaves that menu open and returns focus to Find a page. Ctrl+K with menu closed returns focus to Menu. Production build rechecked. |
| Calendar | 1024px light; hydrated 320px dark seven-column month, selected date and agenda. New appointment dialog opened; keyboard traversal reached the fully visible Save event footer. Dialog closed without saving. |
| Mobile navigation | 320px dark menu, selected route and finder inspected without Phone covering them. Local theme restored to Light; viewport override reset and own preview tab closed. |
| Loading/unavailable states | Assistant initial loading and settled provider-disabled state; routines loading then paused routine/access information; Analytics unavailable-provider banner; Builder setup-needed and synthetic research-failure states; normal 404. No real provider failure was induced. |
| Long data | Call-task title, client/project names, contact addresses and statement source key wrap in the observed tablet/narrow samples. |

Representative changed-screen captures: `sign-in-production-320.png`, `sign-in-desktop-settled.png`, `services-production-tablet.png`, `services-attention-phone-light.png`, `services-narrow-dark.png`, `statement-production-tablet.png`, `statement-review-visible-narrow-dark.png`, `new-conversation-production-tablet.png`, `finder-return-focus-fixed.png`, and `calendar-footer-narrow-dark.png`.

The 43-route sweep began against the preceding production build. Only affected screens and keyboard behavior were repeated after the small changes; the report does not claim a second full 43-route sweep of the final build. Assistant's interactive local checks used development mode because its production origin policy rejects plain loopback HTTP. The final changed-screen checks used the optimized production build and the isolated fixture database.

## Reconciliation with the original audit

| Audit area | Current implementation/evidence |
| --- | --- |
| Shared system, Overview, Prospects, shell and initial obstruction fixes (V01–05, V16, shared V18/V33) | [Foundation](SOFTWARE_VISUAL_POLISH_2026-11-11.md), later sidebar release, and fresh route/menu/finder checks here. |
| Daily work, conversation density, calendar and meetings (V07–09, V15, V17–18, V22–23, V27) | [Daily-work pass](SOFTWARE_DAILY_WORK_POLISH_2026-11-11.md), plus fresh tablet and narrow calendar checks. |
| Records, sales, empty/viewer presentation, forms, solutions and delivery (V06, V10, V19–20, V30–31, V34–38) | [Record pass](SOFTWARE_RECORD_POLISH_2026-11-11.md), [delivery pass](SOFTWARE_DELIVERY_POLISH_2026-11-11.md), and V37/V38 completion here. Earlier viewer checks retained as dated evidence; not a new all-role matrix. |
| Assistant supporting pages (V15, V21) | [Supporting-page pass](SOFTWARE_ASSISTANT_SUPPORT_POLISH_2026-11-11.md), plus fresh library/detail/document/routine tablet checks. |
| Reporting, administration and import/Builder utilities (V11–14, V26, V29–30, V39) | [Administration pass](SOFTWARE_ADMIN_POLISH_2026-11-11.md), plus fresh tablet views. Fresh post-polish CSV mapping/confirmation acceptance remains open because of the recorded file-picker limitation. |
| Mail and account/consent surfaces (V24–25, V32, V40–41) | [Mail/account pass](SOFTWARE_MAIL_POLISH_2026-11-11.md) remains the latest implementation and local visual evidence. Mail source was not changed or freshly re-reviewed in this pass. Separate deployment/live acceptance remains open. |
| Phone sign-in and search detail (V28, V33) | Completed and verified in this pass, including the additional nested Escape/focus correction. |

These scoped passes implement the audit's design direction; this is not a claim that every suggested optional layout idea was adopted verbatim. Dated evidence in earlier reports remains intact rather than being relabeled as a fresh test.

## Verification

- Website TypeScript and Oxlint passed.
- Existing Eastern/calendar date tests: **11 passed**.
- Existing operating-model integration suite: **15 passed**, using a separate local `ta_operating_test` database. Includes statement access boundaries, exact totals, transitions, external-payment reference requirements and service behavior. No production data used.
- Optimized Next.js Turbopack production build passed, including TypeScript and static generation.
- Built-screen verification: phone sign-in, Services, partner statement, New conversation focus and page-finder Escape/focus return.
- No schema migration, dependency, provider configuration, spending limit or permission change. No real message, call, paid AI request, import, publication or financial action.
- Pre-existing `next-env.d.ts` change is excluded from this release. Diff checks and final remote verification recorded at release time.

## Remaining acceptance gates and next step

1. **Partner-owned Cloudflare Mail release:** deploy the already-tested Mail source, apply migration 0039 if still pending, record the Worker version and repeat live Inbox/compose/settings checks. Cloudflare authentication is unavailable locally; pushing this repository does not deploy Mail. Follow [Mail deployment](../apps/mail/README.md) and [MCP acceptance](../apps/mail/MCP_SETUP.md).
2. **Actual iPhone/build acceptance:** keyboard opening, safe areas, rotation, microphone and push. Responsive Chrome is not physical-device evidence; native push also has the existing Apple account/signing gate.
3. **Post-polish CSV upload/mapping/confirmation:** inspect using a browser/native picker with working local-file access. The earlier automation limitation was not bypassed or treated as a successful upload. Parser checks and the pre-polish mapping review do not replace this visual step.
4. **Production smoke check:** after the website release is deployed, verify these five changed surfaces in the authenticated live workspace. This report records local acceptance and a repository release, not a confirmed Render deployment.

Recommend closing the visual implementation cycle here, then completing these concrete acceptance gates and collecting ordinary employee-use feedback. Avoid another broad redesign without an observed usability problem.
