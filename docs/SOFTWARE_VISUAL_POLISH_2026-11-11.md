# Employee workspace visual polish — first implementation pass

November 11, 2026. Implements the approved first three steps from the [complete visual audit](SOFTWARE_VISUAL_AUDIT_2026-11-10.md): fix the two priority defects, strengthen the shared visual system, and polish Overview and Prospects as examples for the remaining workspaces.

This is a refinement of the existing identity. It is not completion of all 41 audit findings or a redesign of every audited page. The separate Mail service, public website, generated sites, and native iPhone shell are outside this release.

## What changed

| Area | Result | Audit findings |
| --- | --- | --- |
| Shared palette | White panels on a soft slate canvas in light mode; a deeper navy canvas and distinct card/field surfaces in dark mode. Existing semantic status colors remain. | V01 |
| Navigation | More compact brand/workspace chrome. Phone and Email share a desktop utility row. Phone has a dedicated mobile header control. | V02, V16, V18 |
| Phone | The closed launcher stays in navigation instead of covering page actions. Opening the mobile menu minimizes the phone panel without ending a call. Opening Phone closes the menu. The open panel focuses its minimize control; Escape minimizes it and returns focus to the visible launcher. | V16 |
| Calendar | Team-filter and mini-calendar selected states use paired theme tokens. The workweek selection also uses defined theme tokens. | V23 |
| Page finder | Opening it focuses search immediately. The search field uses one surrounding focus treatment. | V33 |
| Overview | Aligned metric footers, compact metrics, follow-ups and project deadlines before recent records and workspace shortcuts. Copy reflects relationships and AI/automation delivery. | V04, V18 |
| Prospects | Shorter introduction, one action row, compact list rows, date-only display with full timestamp in the title, and restrained inline status controls. Mobile filters can collapse; expanded fields use the full available width. Very narrow screens stack status beneath contact details. | V05, V18 |
| Shared controls | Consistent field surfaces, button hover colors, and topbars that can grow with their contents. | V03 (foundation only) |

Overview and Prospects use scoped CSS modules. Shared treatments remain in the existing dashboard stylesheets and central theme tokens, rather than another layer of global overrides. No schema, provider, lead-status mapping, permission, or customer-notification behavior was changed.

## Verification record

The preview is an isolated copy with synthetic records and a loopback-only database. Production credentials were not copied. Calling, SMS, paid AI, and proactive routines were disabled. The inline status check changed only the synthetic Morgan Taylor record from Qualified to Proposal and back to Qualified.

The initial before captures used source `8cbf34a`. The final preview incorporates the subsequently committed `74069ab` navigation/meeting changes plus this visual pass, so that collaborators' work remains intact. `next-env.d.ts` was already modified and is excluded from this change.

### Observed in the development preview

- Overview and Prospects rendered in both themes, with desktop and 390px mobile layouts inspected. The first prospect and its status are visible within the initial mobile screen.
- At 320px, Prospects has no horizontal page overflow; contact details and status stack without crowding. Expanded mobile filter fields use one column.
- Desktop search plus status filtering returned the expected synthetic prospect. Mobile status filtering returned the same record. Inline Proposal/Qualified saves completed, including the saving/saved feedback.
- The prospect entry form opens with business-name focus; its inputs fit the mobile panel. Closing it restores focus to Add prospect.
- Page finder opens with search focused. Phone opens with its minimize control focused; Escape closes it and restores launcher focus. Opening the mobile menu minimizes Phone. The navigation's search control is unobstructed.
- Calendar's selected **Everyone** text is `rgb(232, 240, 255)` on `rgb(38, 61, 96)` in dark mode: **9.56:1** measured text contrast (the original audit measured 1.06:1).
- On the site detail page, the closed Phone launcher and Save site button have non-intersecting rendered rectangles. The expanded phone remains a deliberate, minimizable overlay.

### Final checks

- **Passed:** `npm run lint` and `npm run typecheck` against the working repository.
- **Passed:** `npx vitest run lib/operations/validation.test.ts` — 3 tests.
- **Passed:** the normal Next.js 16.4.2 **Turbopack production build**, including TypeScript and all 35 static pages, in the isolated preview. The only preview configuration change was a separate output directory. Early setup attempts hit Windows dependency-path resolution and duplicate-directory type-check memory errors; moving the temporary dependency backups outside the project and using an actual dependency copy resolved them. No production build configuration was changed.
- **Passed in the compiled app:** Overview in both themes on desktop and mobile; Prospects list, search, empty results, clear filters, pagination, and the viewer layout. A viewer has no Add prospect button or inline status editor. The owner session and light preference were restored afterward.
- **Responsive checks:** 320, 390, 768, 1100 and 1309 CSS-pixel widths. Prospects has no horizontal page overflow at the checked sizes. At tablet widths, search occupies its own row and the two filters sit below it. At 320px, contact/status content stacks. Empty-state content is clipped to the table panel's rounded corners.
- **Shared-style smoke checks:** Inbox, Projects, Calendar and site detail. Lower Overview cards and mobile priorities were also inspected, beyond the initial viewport.
- **Assistant compatibility:** loaded desktop and mobile views were inspected in the development preview, with no horizontal overflow at 390px. The compiled HTTP preview correctly rejects the Assistant's production-only HTTPS origin requirement; that guard was preserved. No AI message was sent.
- Existing browser-test expectations were updated for theme colors, the relocated Phone launcher, search submission, and finder focus. The full Playwright suites were not run; interactions above were exercised through the controlled browser instead.
- All 15 implementation files were compared with the isolated preview. No live customer messages, calls, conversions, paid AI requests, or provider changes were used for verification.

## Evidence

Synthetic screenshots are stored locally, outside the repository:

`C:\Users\xenon\AppData\Local\Temp\ta-premium-pass-20261111\evidence`

Useful before captures: `before-prospects-desktop.png`, `before-prospects-mobile.png`, `before-overview-mobile.png`. Development evidence includes `after-calendar-dark.png`, `after-site-save-clearance.png`, `after-prospect-entry-mobile.png`, and `after-navigation-mobile.png`. Files named `first-pass`, `current`, or captured during a theme transition are intermediate evidence, not final acceptance screenshots.

Final compiled-page evidence:

- `production-overview-desktop-light.png`, `production-overview-desktop-dark.png`
- `production-overview-mobile-light.png`, `production-overview-mobile-dark.png`, `production-priorities-mobile-dark.png`, `production-overview-bottom.png`
- `production-prospects-desktop-light.png`, `production-prospects-mobile-light.png`, `production-prospects-tablet-final.png`, `production-prospects-small-desktop.png`
- `production-prospects-empty-final.png`, `production-prospects-viewer.png`
- `production-inbox-desktop-dark.png`, `production-projects-light.png`

Assistant development-preview evidence: `assistant-desktop-shared-styles.png`, `assistant-mobile-shared-styles.png`.

The `production-` filename prefix means **local production build**, not the hosted application.

## Remaining work

Continue the original audit's page-by-page implementation plan, applying these examples to record/detail forms, Inbox, Assistant, Sales, the remaining delivery workspaces, and the separately deployed Mail app. Page-specific depth, spacing, empty/error states, and dense record layouts still need their own implementation passes.

Native iPhone safe areas, software keyboard, rotation, microphone/call continuity, and push behavior still require a physical device. This pass does not claim real call delivery or device acceptance. Production deployment and observed production UI are separate from local build and preview acceptance.
