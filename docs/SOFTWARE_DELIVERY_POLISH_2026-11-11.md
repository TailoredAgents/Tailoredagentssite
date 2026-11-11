# Sales and delivery polish — November 11, 2026

Scope: Sales board/table, Quick capture, Partners list/detail/statements, and Sites list/detail. This continues the [record pass](SOFTWARE_RECORD_POLISH_2026-11-11.md) and the [complete employee-software audit](SOFTWARE_VISUAL_AUDIT_2026-11-10.md).

## Changes

| Area | Implementation |
| --- | --- |
| Sales | Consistent metric/filter surfaces, quieter empty lanes, fixed-width scrollable columns, clearer card next actions and keyboard-focusable board/table. Table widths preserve readable columns; phone icons stay alongside their numbers. |
| Quick capture | Essential identity and conversation notes remain visible. Optional event, date, ownership and introduction fields are grouped in a native disclosure. Duplicate checking and the separate-record choice remain explicit. |
| Partners | Richer record headings, consistent partner cards, visible counts from the already-authorized record, and more usable nested forms. |
| Statements | Source-entry/review-history jump links, readable source evidence, better phone spacing and the unchanged exact-total confirmation. |
| Sites | Saved address, client, environment and notes appear before an explicit Edit site control. Cancel closes the editor; viewers see saved facts. First-use and filtered empty copy are distinct. |

All existing named form fields, server actions, validation, permissions, immutable agreement versions, source evidence and financial confirmations are preserved. No schema, provider, financial processing or notification changes. CSS is scoped to these pages. The shared opportunity component keeps the same links and record data.

## Visual findings and acceptance

- Reviewed all seven routes (eight views including Sales board/table) at 1440 × 1000 light and 390 × 844 dark against populated synthetic local records. Expanded Capture, Site, partnership draft and statement confirmation surfaces were inspected on phones.
- Checked all eight views at a 320px viewport: document width equaled viewport width. Board and table retain intentional contained horizontal scrolling. Partner detail was also inspected at 1024 × 768 and Sales table at 1366 × 768.
- Caught and corrected potential pipeline lane overlap by sizing the grid tracks with the lanes. Removed extra spacing between fields inside the two-column Capture metadata grid.
- Final review found an orphaned phone icon and overly tall narrow table rows. Grouped each phone icon/number and reserved a readable minimum width for the table and its research/value columns.
- Board/table keyboard scrolling and Board/Table switching worked. Filtering to Won showed the expected empty-result state. Site Cancel closed its editor.
- A synthetic sparse Quick capture saved successfully with no phone/email/company, retained the event entered in its disclosure, opened the relationship overview and displayed the saved notes and owner. No production record or customer communication was used.
- Viewer Site showed saved facts with no Edit site/form. The unshared viewer Partners list showed no private partner records and no finance-management controls. Permissions were not changed.

Final mobile Sales table recheck measured a 149px first row with a 1000px contained table. No browser console errors were observed in the inspected preview session. Temporary viewport/theme overrides were restored and the preview server was stopped.

Screenshots are outside Git at `C:/Users/xenon/AppData/Local/Temp/ta-premium-pass-20261111/delivery-evidence/`. They contain synthetic fixture records. This is responsive browser acceptance, not physical-iPhone/keyboard/safe-area acceptance or an accessibility certification.

## Verification and release boundary

Production Next.js build with Turbopack, TypeScript and lint passed. The existing operating-model browser spec was updated to open Capture's metadata disclosure; its Playwright suite was not run. Interaction checks above used CUA in the isolated local production preview, with real providers and background routines disabled.

The previous record release (`d428eec`) was observed live before this work: a real prospect showed Next step and Edit prospect, without a live edit. This pass's local verification does not establish deployment acceptance. Assistant supporting pages, reporting/admin utilities, separate Mail deployment and native-device acceptance remain separate follow-up work.
