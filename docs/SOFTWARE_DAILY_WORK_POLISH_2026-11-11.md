# Daily-work visual polish

November 11, 2026. Second implementation pass from the [complete visual audit](SOFTWARE_VISUAL_AUDIT_2026-11-10.md), following the [shared foundation, Overview and Prospects release](SOFTWARE_VISUAL_POLISH_2026-11-11.md).

## Scope and observations

- The previous release's updated Overview, navigation and Phone utility were observed on the hosted dashboard before starting this pass. Evidence: `live-previous-release.png`.
- Inbox: strengthen conversation hierarchy, reduce repeated message chrome, and preserve clear channel, sender, delivery state and reply controls (V27).
- Assistant main workspace: reduce stacked chrome, welcome and composer height; keep starter actions and message space useful on desktop and mobile (V15).
- My day: put scheduled commitments ahead of work-focus setup and website updates; collapse updates without acknowledging them (V07, V18).
- Calendar: fit the entire mobile month with a selected-day agenda, preserve desktop/day/week behavior and time-zone clarity (V09, V17).
- Meetings & notes: retain the recently unified intake, compact search and recording rows, and put processed findings ahead of recording administration (V08, V22).

Record/detail workspaces, Assistant secondary pages, reporting/settings and the separate Mail application remain later passes. No provider activation, paid requests or real customer communication is part of visual verification.

## Implemented

| Workspace | Changes | Observed local behavior |
| --- | --- | --- |
| Inbox | Theme-based conversation surfaces, compact messages and metadata, clearer outgoing color, more useful list width. Phone reply editor starts folded; narrow pane tabs fit. | Desktop and phone SMS history, incoming/outgoing delivery labels, reply expansion, draft preservation through hide/details/thread, customer details, Email/Call/Note states and 320px list navigation. No message or draft was submitted. |
| Assistant | Chat height follows available viewport; shorter header, welcome and composer; voice/files share a tools row. File privacy/retention guidance is disclosed on request. Singular review/activity labels corrected. | Desktop starter actions fit at 1309×909 and 1440×1000. Mobile starter/chat/composer, saved conversation, review state, voice disclosure, file selection/deselection and a scrollable expanded file panel. No AI request, recording or upload. |
| My day | Commitments and appointments precede preferences and website updates. Compact metrics, Mine/Team switch, Quick capture and calendar link. Native disclosures for website updates and work focus. | Desktop/phone in both themes, team scope, overdue/upcoming tasks, empty consultation/handoff panels and a synthetic website issue. Expanding/closing its disclosure leaves the notice open rather than marking it seen. |
| Calendar | Phone month uses all seven columns plus a selected-day agenda; compact ownership dropdown. Arrow-key date selection. New appointment/Block time use the selected date. One shared Eastern-time explanation in the editor. | Month/day/week, next month, Today, empty day, owner filter and all calendars; keyboard selection opens the correct agenda and appointment date. Dialog fields and footer remain reachable. Desktop FullCalendar behavior retained. |
| Meetings & notes | Compact intake, recording rows, search and empty-search state. Styled native file picker. Processed meeting opens with summary and evidence; recording controls and transcript are collapsible. | Desktop/phone library, expanded upload form, empty search, processed meeting, recording disclosure and full transcript in light/dark. Evidence labels, review controls and sharing boundaries remain visible. No recording was uploaded, processed or shared. |

This is a presentation pass. Existing endpoints, grants, review requirements, budgets, delivery controls and recording retention remain in place. No migration or provider activation is needed.

## Verification

Source baseline: `13afc67`, then synchronized with concurrent sidebar release `94f1ae8`. Its collapsible navigation is preserved. The isolated physical source copy uses synthetic PostgreSQL records and provider-disabled configuration. Localhost was used after an earlier shared loopback hostname caused development-preview authentication collisions.

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npx vitest run lib/booking/display.test.ts lib/time.test.ts`: 16 passed.
- `git diff --check`: passed; 101 relative documentation links resolve.
- Isolated `next build` (Next.js 16.4.2 / Turbopack): passed. All 18 implementation files match the built source byte-for-byte.
- Built-preview checks: processed meeting, desktop month, 320px month/date-to-editor handoff, My day and empty Inbox. The final browser console inspection returned no errors. Populated SMS and Assistant behavior were checked in development because production channel guards require HTTPS.
- Existing calendar browser specifications were updated for the phone month picker, owner select, keyboard/date prefill and viewer restrictions. The meeting specification now opens the transcript before checking it. Those Playwright suites were **not executed** in this pass; interaction verification used the permitted browser-control session.

Responsive checks used desktop 1440×1000 and 1309×909, phone 390×844 and narrow 320×800 viewports. Main edited workspaces were inspected in light and dark. Narrow Inbox, Assistant, Calendar and meeting layouts did not produce page-level horizontal overflow. Long history, transcript, expanded panels and editors retain their own intended scrolling. A short viewport can still require scrolling to reach all starter prompts; controls remain accessible.

Assistant interaction checks used the development preview: the production API deliberately requires HTTPS while this isolated preview is loopback HTTP. The guard was preserved. The disabled-provider banner shown in screenshots describes this local test configuration, not the hosted account.

The previous release's Overview/navigation was observed on the hosted site before implementation. That observation is separate from verification of this pass. Real SMS/email delivery, paid models, microphone permissions, physical iPhone keyboard/safe areas and native push were not exercised.

## Evidence

Artifacts remain outside the repository at `C:/Users/xenon/AppData/Local/Temp/ta-premium-pass-20261111/daily-work-evidence`. All `after-` images below show synthetic local records, not the hosted application.

- Inbox: `after-inbox-desktop-light.png`, `after-inbox-desktop-dark.png`, `after-inbox-mobile-light.png`, `after-inbox-mobile-dark.png`, `after-inbox-list-320-dark.png`, `after-inbox-reply-mobile-dark.png`, `after-inbox-details-mobile-dark.png`.
- Assistant: `after-assistant-desktop-light.png`, `after-assistant-conversation-desktop-dark.png`, `after-assistant-mobile-light.png`, `after-assistant-review-mobile-dark.png`, `after-assistant-files-mobile-light.png`, `after-assistant-320-light.png`.
- My day: `after-my-day-desktop-light.png`, `after-my-day-desktop-dark.png`, `after-my-day-mobile-light.png`, `after-my-day-mobile-dark.png`, `after-my-day-notice-mobile-light.png`.
- Calendar: `after-calendar-mobile-light.png`, `after-calendar-mobile-dark.png`, `after-calendar-editor-mobile-dark.png`, `after-calendar-day-desktop-light.png`. Built checks: `built-calendar-desktop-dark.png` and `built-calendar-320-light.png`. The earlier `after-calendar-320-dark.png` preceded the final narrow heading adjustment.
- Meetings: `after-meetings-desktop-light.png`, `after-meetings-mobile-dark.png`, `after-meetings-upload-mobile-light.png`, `after-meeting-review-desktop-dark.png`, `after-meeting-review-mobile-light.png`, `after-meeting-review-mobile-dark.png`.

Additional built-preview evidence: `built-my-day-320-light.png`, `built-inbox-empty-desktop-light.png`, `built-meeting-review-desktop-dark.png`. The `built-` prefix means the local production build, not hosted deployment.

Earlier screenshots are retained as iteration evidence. `before-meetings-mobile.png` captured sign-in, and `after-meetings-empty-320-dark.png` captured an unsettled resize; neither is accepted layout evidence.

## Remaining work

Continue with common record/detail and form patterns across prospects, clients, projects and sales, then remaining reporting/settings/administration and Assistant secondary workspaces. Separate Mail still needs its own design/deployment pass. The full original audit is preserved; completing these five workspaces does not close every audit finding or prove every possible state.
