# Software visual audit and premium-finish plan

Audit conducted November 10–11, 2026. Requested by Austin. **Employee web page review complete.** This document preserves the findings before implementation. The first implementation pass is tracked in [the November 11 release record](SOFTWARE_VISUAL_POLISH_2026-11-11.md). Inbox, Assistant chat, My day, Calendar and Meetings & notes are tracked in the [second implementation pass](SOFTWARE_DAILY_WORK_POLISH_2026-11-11.md).

Recommendation: keep the identity and refine the product around it. The greatest improvement will come from clearer surface contrast, less competing page chrome, consistent record/form patterns and deliberate mobile layouts. A wholesale rebrand is unnecessary. Fix the two observed obstruction/contrast issues first, establish shared foundations, then work through the pages in the order below.

## Brief and boundaries

Preserve the recognizable Tailored Agents workspace while making it feel more considered, rich and cohesive. Inspect rendered pages, content density, color, typography, spacing, alignment, responsive behavior, overlays and states. Deliver an actionable plan; this audit does not redesign application code or change business records.

Scope: the employee dashboard and its nested workspaces, sign-in, separate Mail, and browser-visible mobile behavior. The public marketing site and generated client websites are separate design products. Native iPhone chrome, keyboard and safe-area behavior require actual device acceptance; responsive Chrome alone cannot establish those results.

Evidence labels: **Live** = observed signed-in production UI; **Fixture** = observed isolated local UI with synthetic records; **Source** = code inspection only; **Open** = not yet visually verified. A page inventory is not proof that every state was inspected.

Source baselines: the initial review used `ecbe444` (`Add relationship overview and accountable team handoffs`). The continuation used `2832c7c` (`Add relationship capture, solution briefs, services and referral ledger`), including all six newly committed dashboard routes and the updated relationship workspace. Both previews were isolated copies. Production may lag these commits; live and fixture observations are distinguished below.

Screenshots containing live customer or employee information stay in local audit artifacts outside the repository. Findings describe layout without copying private contents. No live messages, calls, customer record edits, paid AI requests, customer builds, publications or permission changes were performed. Forms and confirmation screens were inspected without executing their business actions. Synthetic preview data and one local work-focus preference supplied otherwise unavailable states. Theme changes were confined to the isolated previews and restored; temporary viewport overrides were reset.

## Coverage ledger

All **20 current primary navigation workspaces** were visually inspected on desktop and mobile. **All 43 committed dashboard page templates** were rendered and inspected in production or isolated previews. The continuation closed the earlier populated call-task gap using synthetic voice configuration with real calling disabled. It also covered the six newly committed Capture, Partners, Statements and Services routes.

The table records actual coverage, not an assertion that every possible record, filter, permission, provider response or loading/error combination has been tested. Nested pages with the same route are represented by one or more observed records. `D` = desktop; `M` = mobile.

| Page / route after `/dashboard` | Evidence and states inspected | Main planned work |
| --- | --- | --- |
| Overview `/` | Live D/M; populated fixture dark D | V01–04, V18: clearer priority, aligned metric footers, current company copy |
| Inbox `/inbox` | Live D/M empty selection; Austin's existing test SMS thread, details, SMS composer; Call, Note and unlinked-email modes D | V27: compact messages and chrome; preserve channel/recipient/review clarity |
| New conversation `/inbox/new` | Live D populated contact picker and focused search | V03, V33: consistent header, search/focus treatment |
| Meeting Inbox `/meetings` | Live D/M empty library and upload form | V08: compact upload plus useful library entry point |
| Meeting `/meetings/[id]` | Fixture D/M populated transcript/findings, linked prospect; no real recording | V22: findings-first hierarchy; preserve evidence distinction |
| Calendar `/calendar` | Live D/M month and blank appointment; fixture populated month, dark D, 1024px tablet, 320px dialog and reachable footer | V09, V17, V23: mobile month treatment and selected-state contrast |
| My day `/sales/today` | Live D/M updates and task workspace; current fixture work-focus form and saved Development & delivery view D | V07, V18: tasks ahead of expanded update feed |
| Capture `/capture` | Fixture D/M blank conversation form, match options, footer | V34–35: field rhythm, usable mobile width |
| Call task `/tasks/[id]` | Fixture D/M actual populated call summary, task/relationship forms and reachable footer | V19, V34: apply shared record/form pattern |
| Assistant `/assistant` | Live D Chat/Work/Files/Activity/Settings; M Chat/Work/Files/Settings; fixture completed answer D/M, My work review D/M, stale inline review D/M, blocked run D | V15, V18, V27: reduce competing chrome and preserve usable review/message space |
| Routines `/assistant/routines` | Live D empty list and unsaved new-routine form; M empty list; fixture paused routine, access-renewal explanation and edit form D/M | V21: integrate with Assistant visual system |
| Knowledge `/assistant/knowledge` | Fixture D library and blank new-guidance form | V21: real library header, search, concise empty state |
| Guidance `/assistant/knowledge/[id]` | Fixture D/M draft detail, publishing controls visible but untouched | V21: reading width, metadata and review hierarchy |
| Document `/assistant/documents/[id]` | Fixture D/M ready extracted-text detail | V21: document title/metadata, search and source presentation |
| Prospects `/leads` | Live D/M populated list; fixture dark and viewer D | V05, V18, V31: compact rows, mobile filters, role-aware display |
| Prospect `/leads/[id]` | Fixture D/M populated detail | V19: summary, owner and next action before editing |
| Sales `/sales` | Live D/M empty board; fixture D populated board, table and new-opportunity form | V06, V18, V30: useful board density and cleaner data rows |
| Opportunity `/sales/[id]` | Fixture D/M detail; dark D details/activity/follow-up/handoff sections | V19–20: aligned sections, contact consolidation, purposeful editing |
| Imports `/sales/imports` | Fixture upload stage D, viewer M, synthetic CSV mapping/preview/confirmation D/M; native picker limitation documented below | V26, V39: shared upload pattern and compact mapping |
| Manual mockups `/sales/mockups` | Fixture D/M populated board | V26: reduce duplicate navigation and oversized preamble |
| Website Builder `/sales/factory` | Live D/M projects and update feed | V07: compact attention queue and useful project entry point |
| New build `/sales/factory/new` | Live D/M prospect picker | V03, V26: header/search consistency; keep sparse-lead support |
| Build detail `/sales/factory/[id]` | Live D/M existing plan ready for review; no paid request or approval | V03, V19: plan/chat hierarchy; exact-version review remains explicit |
| Builder settings `/sales/factory/settings` | Fixture D owner form; M viewer/paused state | V26, V31: shared settings layout and permission-aware display |
| Smart Cards `/smart-cards` | Live D overview/campaigns/profiles/print/reporting/settings; M overview | V11: separate daily-use links from long administration/reporting sections |
| Partners `/partners` | Fixture D/M populated list; add-partner and finance-access forms D | V03, V34: shared header and form rhythm |
| Partner `/partners/[id]` | Fixture D/M populated record; versioned agreement, source/earning, statement preparation and record-sharing forms | V34–35, V38: form width, hierarchy, readable dates |
| Statement `/partners/statements/[id]` | Fixture D/M draft with source entry; exact-total review and void forms opened M | V38: partner context, dates, counts and status emphasis |
| Clients `/clients` | Live D/M empty list | V10: purposeful first-use state and consistent panel corners |
| Client `/clients/[id]` | Fixture D/M populated record | V19: client summary, contacts and delivery before account editing |
| Contact `/clients/[id]/contacts/[contactId]` | Fixture D/M populated edit form | V19: shared form width, contact summary and field spacing |
| Projects `/projects` | Live D/M empty list | V10: distinguish initial empty state from filtered zero results |
| Project `/projects/[id]` | Fixture D/M populated milestones; viewer D | V19, V31: delivery-first detail and readable viewer presentation |
| Services `/services` | Fixture D/M populated list and filters; new-service form D | V34, V37: active-filter cue and incident priority |
| Service `/services/[id]` | Fixture D/M review/incident/outcome evidence; review, resolution, measurement and edit forms; dark detail/editor D and editor footer M | V34–35, V37: consistent fields, mobile width and next-action priority |
| Sites `/sites` | Live D/M populated list | V03, V18: shared list/filter/card rhythm |
| Site `/sites/[id]` | Fixture D/M populated record; observed desktop action collision | V16, V19: reserve footer space and standardize form |
| Relationship `/relationships/[kind]/[id]` | Fixture D/M prospect, next action, encounter, connected meeting, solution brief/editor/version history and handoff; client/business/opportunity/contact variants D | V19, V34–36: wider brief reading area, compact context and explicit handoff |
| SEO `/seo` | Live D overview/strategy/evidence; M overview | V12: scannable strategy, status and work priority |
| SEO change `/seo/changes/[id]` | Live D/M existing verified publication/history | V12, V29: readable evidence and safe responsive breadcrumbs |
| Analytics `/analytics` | Live D/M overview, D charts/tables; fixture dark D populated data | V12, V30: metric/definition hierarchy and independent table heights |
| Activity `/activity` | Live D/M populated log | V13: human-readable event names, grouping and date rhythm |
| Settings `/settings` | Live D/M overview/appearance; D connections, calling and SMS sections | V14: categories, compact status and consistent form footers |

### Mail and authentication coverage

All currently reachable Mail page families were inspected. The 22 `+page.svelte` files include four redirects/aliases and one disabled legacy onboarding route; those are accounted for below rather than presented as additional screens. This includes first-use and consent pages that do not appear in everyday navigation.

| Page / route | Evidence and states inspected |
| --- | --- |
| Inbox `/inbox` and Sent `/sent` | Live D/M list and existing sent thread; fixture incoming thread, hidden external-image notice and attachment entry D/M; dark thread and reply-all composer D/M |
| Drafts `/drafts`, Starred `/starred`, Archive `/archive`, Junk `/spam`, Trash `/trash` | Each folder rendered D in fixture; Trash M; empty-folder and empty-selection presentation |
| Compose `/compose` and message `/mail/[id]` | Source-confirmed redirects to the current Inbox composer/thread; rendered blank composer and thread D/M, including sender/recipient and action controls |
| General `/settings/general` | Live D/M; fixture signature/account form D |
| Appearance, Labels, Shortcuts `/settings/[section]` | Each active section D; light/dark preference change and restored light appearance observed in fixture |
| Connected assistants `/settings/connections` | Live D connection list and permissions |
| Deletion confirmation `/settings/connections/delete/[id]` | Fixture D/M populated confirmation for synthetic trashed mail; no deletion submitted |
| Team admin `/admin`, Unassigned mail `/admin/unassigned`, Mail status `/admin/status` | Live D, owner administration and operational status |
| Login `/login` | Fixture D/M |
| Initial owner setup `/setup` | Fixture D/M using a separate empty local database; no account created |
| Temporary-password setup `/account/setup` | Fixture D/M form; no credential entered or changed |
| Mail authorization `/oauth/authorize` | Fixture D/M populated account, callback and permission choices; no grant issued |
| Root `/` and `/settings` | Source-confirmed redirects to Inbox and General; destination pages visually inspected |
| `/onboarding`, `/settings/ai`, `/settings/notifications` | Source-confirmed disabled routes in `hooks.server.ts`; not current product screens |
| Dashboard sign-in `/sign-in` | Live D/M, including narrow-screen hero/form composition |
| Operations authorization `/oauth/operations/authorize` | Fixture D/M populated permission screen and reachable footer; no grant issued |

Folder variants share a list template; every individual message and every destructive action were not exercised. Mail's current layout is forced to the `zero` theme by its server hook; unreachable legacy `classic` templates are not counted as employee pages.

Shared checks included the mobile menu, page finder at 1366 × 768, closed/open phone panel, read-only employee banners, and the 404 fallback. Calendar's appointment dialog retained reachable Save controls at 320 × 568 after scrolling; that is a positive result, not an overlap finding.

### Evidence conditions

- Main live desktop viewport: **1440 × 1000 CSS px**. Main live mobile: **390 × 844 CSS px**.
- The localhost browser had an existing 110% zoom. Desktop fixture captures therefore use **1309 × 909 CSS px**; mobile/tablet overrides were adjusted and measured at **390 × 844**, **1024 × 768**, **1366 × 768** and **320 × 568**. Screenshot pixels alone were not treated as CSS dimensions.
- Dark theme was sampled across Overview, Prospects, Sales detail/forms, Analytics, Calendar and its appointment dialog, Services and Mail. This is representative theme coverage, not certification of every dark-mode state. The separate Mail preview used 1440 × 1000 and 390 × 844 CSS px at 100% zoom.
- Evidence folder: `C:/Users/xenon/AppData/Local/Temp/ta-visual-audit-20261110/evidence/`. `capture-manifest.json` has 133 original records; `capture-manifest-extended.json` has 111 continuation records, with measured viewports. These include loading/fallback experiments; the named evidence in findings is the accepted evidence set. Do not interpret transient/loading frames as product defects.
- A malformed initial synthetic document chunk was corrected before inspecting the ready document. The earlier voice-access fallback was resolved with synthetic configuration and the actual populated task inspected. A temporary development-chunk error during the continuation was followed by a successful loaded Assistant review. None is presented as a production defect.
- Chrome's file-upload permission prevented the native CSV picker. The isolated import component was initialized with two synthetic rows through its real CSV parser, allowing the mapping, preview and confirmation UI to render. This verifies their appearance, not the file chooser or a completed import. No application-source change from this harness is included in the repository.
- Assistant completed/review/blocked states came from synthetic database records, without an AI request or a running worker. The inline review fixture reached the stale-proposal state; its disabled approval is expected, not a product defect. Partner/statement amounts and terms were synthetic and are not company financial terms.
- Local PostgreSQL and Mail D1 fixtures used no production database or real provider keys. The original dashboard preview build and current Mail build passed; the expanded dashboard used a local development server. Owned preview processes/container were stopped after review. These checks do not establish production deployment or provider acceptance.

## Findings

Priority 1 is observed obstruction or unreadability; priority 2 is recurring hierarchy/consistency friction; priority 3 is finishing detail. P2/P3 items include design judgments, not claims of broken functionality. Source ownership and acceptance are consolidated after the findings.

### Pass 1 — live desktop, 1440 × 1000 CSS pixels

- **V01 · P2 · Shared palette:** the slate canvas, cards, input fills and secondary controls occupy a narrow tonal range. Borders are doing most of the separation. Keep the navy/blue identity; test a slightly quieter canvas, clearer raised surfaces, darker primary ink and selective saturated accents. Do not simply darken every surface. Ownership: `app/dashboard/theme.css`, `dashboard.css`, `polish.css`.
- **V02 · P2 · Shared shell:** the large logo, workspace badge, finder, appearance control and account footer leave a comparatively short independently scrolling navigation area. Lower workspaces require scrolling even at 1000px height. Reduce brand/header repetition and reserve more height for navigation; retain visible scroll affordance and keyboard access. Sidebar selection itself is clear and worth preserving.
- **V03 · P2 · Headers and controls:** Analytics has a marketing-style multi-line headline; Builder has a larger/lighter title; most CRUD pages have compact bold headings; Inbox omits the normal breadcrumb strip. Tab treatments also vary. Define a small set of intentional page templates, consistent title sizes and action alignment rather than flattening useful workspace differences.
- **V04 · P2 · Overview:** metric tiles, shortcut cards and list cards have similar visual weight. Links within metric tiles sit at different heights when copy wraps. Establish a stronger overview hierarchy, align tile footers, and replace residual website-centric overview copy with current company language. Live screenshot: `live-overview-desktop.jpg`.
- **V05 · P2 · Prospects:** large row heights show only a few records; dates use awkward wrapped monospaced text; inline status controls look like full form inputs. Retain direct status editing, but refine row density, metadata rhythm and the status control. Live screenshot: `live-prospects-desktop.jpg`.
- **V06 · P2 · Sales:** the empty board repeats the same explanation in each tall lane and pushes connected prospects below the fold. Use one intentional onboarding state, quieter lane empties and clear horizontal continuation. Keep board/table modes. Live screenshot: `live-sales-desktop.jpg`.
- **V07 · P2 · My day and Builder:** five expanded website-update rows consume nearly the whole first viewport before tasks or projects. Default to a compact, counted attention summary with clear expansion and separate task priority. Do not mark updates seen automatically. Screenshots: `live-my-day-desktop.jpg`, `live-builder-desktop.jpg`.
- **V08 · P2 · Meeting Inbox:** upload form dominates the first screen; large inter-row spacing, raw native file-button presentation and a stacked search button weaken the composition. Make the recording drop zone purposeful, tighten the form, align search, and bring recent meetings into view. Screenshot: `live-meetings-desktop.jpg`.
- **V09 · P3 · Calendar:** month view has clear ownership chips and a clean appointment modal. Preserve these. Improve the balance between toolbar, empty-state strip and calendar grid; consolidate repeated time-zone help in the dialog. No desktop dialog collision observed. Screenshots: `live-calendar-desktop.jpg`, `live-calendar-appointment-desktop.jpg`.
- **V10 · P2 · Client/project empty states:** table headers remain above a generic sparse empty area. Clients says “add ... below” although the action is in the page header. Bottom corners of the empty table panel appear square. Give first-use and no-filter-results distinct messages/actions and keep consistent corner clipping. Screenshots: `live-clients-desktop.jpg`, `live-projects-desktop.jpg`.
- **V11 · P2 · Smart Cards:** campaign blocks, teammate profiles, card links, engagement and settings form one very long page. Use a campaign/team switcher, compact link rows with QR thumbnails/previews and grouped metrics. Keep permanent URLs and existing routing unchanged. Screenshot: `live-smart-cards-desktop.jpg`.
- **V12 · P2 · Analytics/SEO:** definitions and connection/coverage explanations compete with the metrics; status, retry and settings actions have similar weight. Preserve truthful coverage/spend information but move supporting detail into well-labeled expandable help and group status/action priority. Screenshot: `live-analytics-desktop.jpg`, `live-seo-desktop.jpg`.
- **V13 · P2 · Activity:** raw event labels expose underscores such as `Note_added`, with the same generic icon repeated and an extremely long undifferentiated table. Use human-readable event names, date grouping and concise target links; retain the underlying audit data. Screenshot: `live-activity-desktop.jpg`.
- **V14 · P2 · Settings:** seven top-level jump buttons, repeated connection cards and long operational forms feel like multiple settings systems on one page. Plan categorized navigation, compact status summaries and consistent section form footers. Screenshot: `live-settings-desktop.jpg`.
- **V15 · P2 · Assistant:** the chat design is cohesive, but stacked page chrome, a large welcome treatment and tall composer leave quick-action cards partially below the inner scroll viewport at 1440 × 1000. Reduce welcome-state vertical demand and simplify composer chrome. Files currently presents dense explanatory paragraphs in a largely empty panel; replace with a concise upload/empty-state composition while preserving limits/privacy information. Screenshots: `live-assistant-ready-desktop.jpg`, `live-assistant-files-desktop.jpg`.

Positive foundations to retain: navy navigation, restrained blue, clear labels, generous readable type, coherent line icons, clear active navigation, reviewed-action boundaries and the appointment modal. Premium quality should come from better hierarchy and precision, not ornamental effects everywhere.

### Pass 2 — nested records, mobile and alternate states

- **V16 · P1 · Phone launcher collisions:** the fixture Site detail screenshot shows the floating Phone button covering part of `Save site`. On the live mobile Assistant, opening Menu leaves the floating Phone button over the right side of `Find a page`. Give floating tools an explicit reserved area, hide/reposition them under menus and dialogs, and keep action footers clear. Evidence: `fixture-site-detail-desktop.jpg`, `live-navigation-mobile.jpg`. Ownership: shared dashboard/voice shell and form footers.
- **V17 · P2 · Mobile calendar:** at 390px, only about three day columns fit. This is an intentional 840px minimum-width calendar inside an overflow container, not document-wide overflow (`calendar.css`). A premium mobile month view should fit seven compact day columns and open the selected day's agenda beneath; keep day/week modes. Toolbar, ownership chips and time-zone help also consume most of the initial viewport. Evidence: `live-calendar-mobile.jpg`.
- **V18 · P2 · Mobile hierarchy:** Prospects, Sales, Smart Cards, Analytics, My day and Builder all spend much of the initial viewport on descriptions, actions, stats or filters before showing records. Use shorter mobile descriptions, compact metric summaries and an explicit Filters disclosure with active count. Prioritize the main action over export. Do not make labels or touch targets smaller to solve the problem. Evidence: `live-prospects-mobile.jpg`, `live-sales-mobile.jpg`, `live-my-day-mobile.jpg`, `live-analytics-mobile.jpg`.
- **V19 · P2 · Record detail templates:** Client/Project/Prospect/Sales/Relationship pages combine large headers and jump links with permanently open edit forms. The useful relationship/context material competes with administration. Establish a compact read-first record summary; open editing deliberately, keep accountable owner/next action prominent, and place secondary fields in grouped disclosures. Preserve each page's distinct business purpose. Evidence: `fixture-client-detail-desktop.jpg`, `fixture-project-detail-desktop.jpg`, `fixture-lead-detail-desktop.jpg`, `fixture-relationship-desktop.jpg`.
- **V20 · P2 · Sales detail composition:** phone-number blocks abut the business card and lack the same heading inset as neighboring panels. Phone details repeat. Narrow two-column fields truncate owner names and opportunity titles. The activity, follow-up and conversion forms are all displayed at once far below the header. Consolidate contact summary, align panel padding and give each work section a clear entry point. Evidence: `fixture-sales-detail-desktop.jpg`, `fixture-sales-detail-dark-desktop.jpg`, `fixture-sales-followups-dark-desktop.jpg`.
- **V21 · P2 · Assistant secondary pages:** Company knowledge, guidance detail, new guidance, document detail and the disabled routines state look substantially less finished than the main Assistant. They begin in an edge-to-edge panel with small/plain headings, long ungrouped metadata, large text fields and default disclosure styling. Apply the Assistant workspace header, reading width, proper title/metadata hierarchy and consistent form sections. Evidence: `fixture-knowledge-library-desktop.jpg`, `fixture-knowledge-detail-desktop.jpg`, `fixture-knowledge-new-desktop.jpg`, `fixture-document-detail-desktop.jpg`, `fixture-routines-desktop.jpg`.
- **V22 · P2 · Meeting detail:** recording metadata and a wide recording card delay access to findings. Keep the process stepper, evidence quotes and stated/suggested distinction; compress recording metadata and make the summary the visual entry point. Evidence: `fixture-meeting-detail-desktop.jpg`. This fixture contains no actual audio, so its interrupted-upload help is not a production defect.
- **V23 · P1 · Dark calendar selected state:** `Everyone` uses foreground `rgb(228,235,245)` on background `rgb(216,229,255)` in the settled dark theme, leaving the label nearly invisible. Replace hard-coded light selected fills with theme-aware selected foreground/background tokens and check all active chips/tabs. Evidence: `fixture-calendar-dark-desktop.jpg` plus computed styles. The appointment modal itself adapts well in dark mode.
- **V24 · P2 · Mail cohesion:** Mail has a separate visual language: white canvas, smaller type, different navigation treatment and a nearly blank reading pane. Retain its useful message density while aligning brand, type, accent, controls and empty-state treatment with the dashboard. Evidence: `live-mail-inbox-desktop.jpg`, `live-mail-inbox-mobile.jpg`.
- **V25 · P2 · Mail composition/settings:** the blank compose window has two close affordances and desktop shortcut hints still appear on mobile (`esc`, `Ctrl`). Its sender context is not visible in the blank composition view inspected. Show the sending identity clearly, simplify closing, and adapt keyboard hints to device type. Settings has duplicated back navigation on desktop and narrow, deeply padded content on mobile. Evidence: `live-mail-compose-desktop.jpg`, `live-mail-compose-mobile.jpg`, `live-mail-settings-desktop.jpg`, `live-mail-settings-mobile.jpg`.
- **V26 · P2 · Import/Builder utilities:** CSV import has a useful three-step structure, but uses a raw file input and a tall explanation block. Manual mockups repeats two levels of navigation above metric cards; Builder settings uses very wide primary buttons and headings unlike the other settings pages. Reuse the shared upload, settings and subnavigation patterns. Evidence: `fixture-sales-import-desktop.jpg`, `fixture-mockups-desktop.jpg`, `fixture-builder-settings-desktop.jpg`.

### Pass 3 — deeper sections and interaction states

- **V27 · P2 · Conversation density:** the live test SMS thread uses large bordered message cards with repeated identity, channel, address and delivery rows for very short messages. On mobile, header/status controls plus separate message and composer scrollers leave little conversation visible. Preserve clear incoming/outgoing distinction, delivery state and exact sending identity, but reduce repeated metadata and provide a compact composer that expands deliberately. The Details tab is a useful mobile pattern to retain. Evidence: `live-inbox-own-thread-desktop.jpg`, `live-inbox-own-thread-mobile.jpg`, `live-inbox-details-mobile.jpg`, `live-inbox-call-desktop.jpg`.
- **V28 · P2 · Mobile sign-in:** the attractive brand introduction occupies most of the initial phone viewport; the password and Sign in action require scrolling. Put the form first after a compact mobile brand header. Keep the richer two-column desktop composition and the existing account-access explanation. Evidence: `fixture-sign-in-mobile.jpg`, `fixture-sign-in-mobile-form.jpg`.
- **V29 · P2 · Narrow breadcrumbs:** longer breadcrumbs and a trailing back link crowd the fixed-height top strip on mobile SEO change review; some breadcrumb text is clipped at the top. Builder detail also wraps its trailing action into a narrow column. Use a compact parent-back control and current-page label on small screens, with appropriate height/wrapping. Evidence: `live-seo-change-mobile.jpg`, `live-builder-detail-mobile.jpg`.
- **V30 · P2 · Reporting/table finishing:** paired Analytics tables stretch to equal height even when one has two rows and the other has eight, creating a large empty panel. Long full URLs wrap mid-domain. Sales table cells repeat multiple secondary lines and break phone icons away from numbers. Give tables independent natural heights, sensible column widths and readable URL labels with access to the full address. Preserve explicit date ranges, measurement caveats and source definitions. Evidence: `live-analytics-tables-desktop.jpg`, `fixture-sales-table-rows-desktop.jpg`.
- **V31 · P2 · Read-only roles:** Prospects correctly replaces editable status controls with badges, but Project detail retains a large disabled editing surface and disabled action buttons. Extend the read-only facts pattern to detail pages; keep the access explanation without making ordinary browsing feel like a form the employee cannot use. Evidence: `fixture-prospects-viewer-desktop.jpg`, `fixture-project-viewer-desktop.jpg`.
- **V32 · P2 · Mail settings consistency:** Light, Dark and Match my device all appear as equally prominent filled blue buttons, without an obvious selected option in the inspected appearance view. Connected assistants uses much plainer heading/action styling and raw permission names than nearby settings. Team admin puts account creation before the existing team list. Use a visible selected appearance control, readable permission labels, consistent page headings and an explicit Add account entry point. Retain access boundaries and confirmation behavior. Evidence: `live-mail-appearance-desktop.jpg`, `live-mail-connections-desktop.jpg`, `live-mail-admin-desktop.jpg`.
- **V33 · P3 · Focus and control detail:** the New conversation search shows both an outer focus outline and a separate inner input outline. The page finder opens with Close focused in the observed state. Use one clear focus treatment per control and focus the search field when opening the finder, while retaining a reachable close control and focus restoration. Evidence: `live-inbox-new-desktop.jpg`, `fixture-page-finder-short-desktop.jpg` and its accessibility state.

### Pass 4 — completed route inventory and current operating-model pages

- **V34 · P2 · Form rhythm:** Capture, service reviews and solution briefs place some labels directly against the preceding control, while the surrounding panels use generous spacing. Use one vertical field rhythm across standalone fields, grids, details and action footers. Evidence: `complete-capture-desktop.jpg`, `complete-service-review-desktop.jpg`, `complete-solution-fields-mobile.jpg`.
- **V35 · P2 · Nested mobile forms:** repeated panel → record → form padding leaves unnecessarily narrow fields, down to roughly 225 CSS pixels in the solution editor at a 390px viewport. Reduce nested padding in solution, partnership and service forms, use the available width and keep long labels/options readable. Preserve version, evidence and confirmation controls. Evidence: `complete-solution-fields-mobile.jpg`, `complete-partner-share-controls-mobile.jpg`, `complete-service-edit-dark-mobile.jpg`.
- **V36 · P2 · Relationship reading width:** the solution brief stays in the narrow left column after the right-hand handoff content ends, leaving substantial unused desktop space. Present long briefs in a wider reading/editing section or a dedicated panel while retaining relationship context. Evidence: `complete-solution-brief-desktop.jpg`, `complete-solution-version-history-desktop.jpg`.
- **V37 · P2 · Service navigation and priority:** the three service-filter links look equivalent, and “Needs attention” is partially offscreen in a horizontally scrolling strip on mobile. Make the active filter explicit and let these short filters wrap. On detail pages, bring an open incident and its next action ahead of historical reviews; mobile summary cards otherwise consume the first screen. Evidence: `complete-services-mobile.jpg`, `complete-service-detail-mobile.jpg`.
- **V38 · P2 · Statements:** the amount is clear, but the page title omits the partner’s name and uses raw ISO dates plus “1 source entries.” Add partner/context, readable dates, grammatical counts and stronger draft/reviewed/approved status presentation. Keep the exact-total confirmation and no-payment distinction. Evidence: `complete-statement-desktop.jpg`, `complete-statement-review-mobile.jpg`.
- **V39 · P2 · Import mapping density:** each CSV mapping uses a large repeated block, making a short file take substantial mobile scrolling before the data review and confirmation. Use compact source-column → destination rows and a concise mapped/unmapped summary. Keep the real record preview, warnings, assignment and explicit import checkbox. Evidence: `complete-import-mapping-desktop.jpg`, `complete-import-confirm-mobile.jpg`, `complete-import-confirm-footer-mobile.jpg`.
- **V40 · P2 · Mail empty-folder context:** empty folders repeat the same illustration/message in both desktop panes. On mobile the current folder name is not visible in the inspected empty view, and “Clear filters” appears even for an unfiltered empty folder. Give each folder a visible heading and a specific empty message; reserve filter-reset guidance for filtered results and use a quieter empty message pane. Evidence: `complete-mail-drafts-desktop.jpg`, `complete-mail-trash-mobile.jpg`.
- **V41 · P2 · Account, consent and destructive-action consistency:** Operations consent has a body-sized heading and minimally styled text-like actions; Mail account setup uses a different mark from Mail login/bootstrap; Mail deletion confirmation uses the ordinary blue primary action and a plain body-sized title. Apply the shared auth/confirmation frame, clear heading hierarchy, consistent branding and a distinct destructive action treatment. Keep account, callback, permission, expiration and irreversible-action details explicit. Evidence: `complete-operations-consent-desktop.jpg`, `complete-operations-consent-footer-mobile.jpg`, `complete-mail-account-setup-desktop.jpg`, `complete-mail-bootstrap-desktop.jpg`, `complete-mail-delete-confirm-desktop.jpg`.

The populated call-task route, import confirmation footer, service editor and partner-sharing footer remained reachable at the inspected mobile dimensions. Mail's dark thread/reply-all screen was readable in the inspected sample. These are positive observations; they do not remove V16's separately observed overlay collisions or establish native keyboard behavior.

## Recommended visual direction

Aim for a calm, precise operations product: a richer navy shell, clear blue actions, crisp light surfaces, strong text and a small number of meaningful accents. Keep the existing logo, font family, line icons and overall familiarity. The sign-in page already has attractive depth; use that restraint as a reference, without adding large marketing heroes to everyday work screens.

### Candidate shared tokens

These are starting values for an implementation comparison, not an applied or approved final palette. Review them on Overview, Prospects, Inbox, Assistant and a populated Project before propagating them. The current light palette uses canvas `#e2e8f0`, surface `#edf2f7` and soft surface `#dce5ef`; all three are fairly close and heavily blue-gray.

| Role | Candidate light | Candidate dark | Intended effect |
| --- | --- | --- | --- |
| Canvas | `#e9eef5` | `#0e1728` | Quiet background behind the work |
| Main surface | `#f8fafd` | `#172438` | Clearly separated cards and content panels |
| Field / secondary surface | `#f2f5fa` | `#203149` | Forms remain distinct without looking disabled |
| Navigation | `#101d31` | `#0c1524` | Richer navy anchor |
| Primary text | `#13213a` | `#edf3ff` | Confident readable headings and body text |
| Secondary text | `#53657e` | `#b1c0d5` | Softer hierarchy that still reads clearly |
| Primary action | `#315fd7` with white text | `#89adff` with `#101d31` text | Deliberate, consistent action emphasis |
| Surface border | `#cbd5e3` | `#354962` | Subtle panel definition; controls/focus may need stronger borders |
| Selected control | `#e1eaff` with `#234ca9` text | `#263d60` with `#e8f0ff` text | A paired foreground/background for every state |

Calculated solid-color contrast checks for these candidate pairs: light body **15.37:1**, light secondary **5.69:1**, light primary button **5.60:1**, dark body **14.02:1**, dark secondary **8.45:1**, dark primary button **7.64:1**, dark selected control **9.56:1**. These calculations do not validate opacity, gradients, hover states or the final rendered UI. The observed current Calendar `Everyone` pair is approximately **1.06:1**.

### Typography, spacing and components

- Keep one application font family. Use a small heading scale: approximately 28–30px page titles, 18–20px section titles, 14–16px working text and 12–13px secondary metadata. Avoid dropping essential controls to tiny text to fit a dense screen. Reserve monospaced type for technical identifiers; use tabular numerals for amounts/counts.
- Use a predictable 4/8px spacing rhythm. Start with 24–32px desktop page gutters, 16–20px mobile gutters, 20–24px panel padding and 12–16px form-row gaps. Compact repeated rows while keeping content readable; do not impose one fixed row height on multi-line records.
- Standardize three useful surface levels: page, panel and overlay. Use restrained shadow only where elevation communicates purpose. Keep 10–12px panel corners, approximately 8px controls and consistent clipping; avoid a card inside a card inside a card when a divider will do.
- Define a shared page header with title, one concise description and primary action. Use a separate compact header for document/record details. Keep full-screen communication and Assistant workspaces as intentional special cases.
- Define one button hierarchy, one segmented/tab pattern, one status family, one field/help/error pattern, one empty state and one upload pattern. Preserve semantic status labels and icons; color must not carry the meaning alone.
- Use richer accent color selectively: the primary action, active navigation, a small accent on an important metric, and meaningful success/warning states. Avoid placing a saturated primary button on every repeated row.
- Use short, purposeful transitions and reduced-motion support. No animated backgrounds, excessive blur or decorative charts that compete with operational information.

## Source ownership

| Work | Primary files / components |
| --- | --- |
| Palette, spacing, shell, shared surfaces | [theme.css](../app/dashboard/theme.css), [dashboard.css](../app/dashboard/dashboard.css), [polish.css](../app/dashboard/polish.css), [dashboard-navigation.tsx](../components/dashboard/dashboard-navigation.tsx) |
| Record/list/form patterns | Dashboard Clients/Projects/Sites/Prospects pages; [operation-form.tsx](../components/dashboard/operation-form.tsx), [manual-lead-form.tsx](../components/dashboard/manual-lead-form.tsx), [relationships.css](../app/dashboard/relationships.css) |
| Capture, solutions, services and private referral ledger | [operating-model.css](../app/dashboard/operating-model.css), [solution-panel.tsx](../components/relationships/solution-panel.tsx), [service-editor.tsx](../components/relationships/service-editor.tsx), [encounter-panel.tsx](../components/relationships/encounter-panel.tsx), [shared fields](../components/relationships/fields.tsx), Dashboard Capture/Partners/Services pages |
| Phone obstruction / conversation workspace | [voice.css](../app/dashboard/inbox/voice.css), [phone-panel.tsx](../components/voice/phone-panel.tsx), [conversations.css](../app/dashboard/inbox/conversations.css), [workspace.tsx](../components/conversations/workspace.tsx) |
| Calendar | [calendar.css](../app/dashboard/calendar/calendar.css) and Calendar components; replace theme-specific literals, then redesign the narrow month presentation |
| Assistant and secondary pages | [workspace.css](../app/dashboard/assistant/workspace.css), [assistant.css](../app/dashboard/assistant/assistant.css), [assistant-workspace.tsx](../components/assistant-workspace.tsx), [assistant-documents.tsx](../components/assistant-documents.tsx), [assistant-knowledge.tsx](../components/assistant-knowledge.tsx), [assistant-routines.tsx](../components/assistant-routines.tsx) |
| Meeting upload/review | [meetings.css](../app/dashboard/meetings.css), [client.tsx](../components/meetings/client.tsx) |
| Sales, imports, Builder | [sales.css](../app/dashboard/sales/sales.css), [workspace.tsx](../components/sales/workspace.tsx), [import-workspace.tsx](../components/sales/import-workspace.tsx), [factory.css](../app/dashboard/factory.css), [Factory navigation](../components/factory/navigation.tsx) |
| Reports, Smart Cards, settings | [reporting.css](../app/dashboard/analytics/reporting.css), [seo.css](../app/dashboard/seo/seo.css), [smart-cards.css](../app/dashboard/smart-cards/smart-cards.css), page-specific components |
| Separate Mail | [Zero tokens](../apps/mail/src/themes/zero/tokens.css), [ComposeDialog.svelte](../apps/mail/src/themes/zero/overlays/ComposeDialog.svelte), [ThreadPane.svelte](../apps/mail/src/themes/zero/mail/ThreadPane.svelte), [Mail layout](../apps/mail/src/routes/layout.css), [settings page](../apps/mail/src/routes/settings/[section]/+page.svelte) |
| Account and authorization frames | [Operations consent](../app/oauth/operations/authorize/page.tsx), [Mail consent](../apps/mail/src/routes/oauth/authorize/+page.svelte), [Mail account setup](../apps/mail/src/routes/account/setup/+page.svelte), [Mail deletion confirmation](../apps/mail/src/routes/settings/connections/delete/[id]/+page.svelte) |

## Implementation plan

Each phase should be a focused, reviewable change with before/after screenshots at the same dimensions. Source paths identify likely ownership, not permission to rewrite collaborators' work. Read the installed Next.js guides before implementation; reconcile the current branch and new pages before applying the baseline plan.

| Order | Scope and concrete deliverable | Completion check |
| --- | --- | --- |
| 1 · Remove visual defects | V16 Phone layering and reserved footer space; V23 Calendar selected contrast; V29 narrow breadcrumb handling | Save site is fully visible/clickable; Phone does not cover menu/search or modal actions; dark selected labels meet contrast; narrow headers retain all necessary navigation |
| 2 · Establish shared foundations | Candidate tokens, page headers, panels, type/spacing scale, buttons/tabs/statuses, field states and focus treatment (V01–03, V33) | Side-by-side review of Overview, Prospects, Inbox, Assistant and Project in light/dark; one token/component system rather than additional global override layers |
| 3 · Refine daily work | Overview, My day, Prospects, Inbox, Calendar, Meetings (V04–09, V15, V17–18, V22, V27) | Useful records/tasks visible near the top; mobile filters collapse with an active-count summary; readable month/day agenda; composer and calendar actions reachable |
| 4 · Unify records and sales | Client/contact/project/site/prospect/opportunity/relationship detail, Capture, solution briefs, Services, Partners/statements, Sales board/table, first-use and viewer states (V05–06, V10, V19–20, V30–31, V34–38) | Read-first summary; clear owner and next step; deliberate editing; no clipped names/actions; readable mobile forms; private terms, evidence, version and exact-total review preserved |
| 5 · Finish Assistant supporting work | Knowledge library/detail/editor, document detail, routines and notification/access settings (V15, V21) | Same quality as Chat; clear reading/editing/review hierarchy; private/shared/expiry/version information retained and readable; no extra activation or spending changes |
| 6 · Reporting and administration | Smart Cards, Analytics, SEO/history, Activity, Settings, Builder/import utilities (V11–14, V26, V30, V39) | Focused categories; smaller status summaries; readable tables, mapping and dates; definitions remain available; exact Builder/SEO approvals and budget information stay explicit |
| 7 · Bring Mail and account screens into the same family | Tokens, list/thread/compose, sender identity, settings/admin, auth/consent and confirmation hierarchy (V24–25, V32, V40–41) | Desktop and mobile remain efficient; current sending mailbox clear; touch controls usable; destructive actions distinct; access boundaries preserved; separate Mail build/deployment verified independently |
| 8 · Final visual acceptance | Full route/state/device matrix below, reconciled against the implementation commit | No open P1 visual defects; screenshots tied to exact release; outstanding device/provider states explicitly recorded |

Recommended first implementation slice: phases 1 and 2, demonstrated on Overview and Prospects. That will establish the premium finish without spreading inconsistent one-off styling across the software. Then apply the agreed patterns to the full workspace.

November 11 implementation update: the [record polish pass](SOFTWARE_RECORD_POLISH_2026-11-11.md) applies the pattern to prospect, opportunity, client, contact, project, service and relationship details. It addresses V19–20 and V31 on those records, the form-spacing/mobile-width portions of V34–35 there, V36 full-width solution planning, and the service-detail priority portion of V37. The broader phase-4 Sites, Capture, partner/statement, sales-board/table and first-use findings remain separate work; this does not close the whole audit.

### Page-level acceptance targets

| Family | What the finished page should demonstrate |
| --- | --- |
| Overview / My day | An obvious primary next action, meaningful task priority and consistent metric alignment. Update feeds are compact by default and retain unread/review state. |
| Lists and boards | Search and filters align; dense data remains scannable; status changes remain available to authorized staff; long names/addresses do not obscure controls. Empty board guidance is purposeful and not repeated in every lane. |
| Record details | Summary and ownership can be understood without scanning input fields. Editing opens with stable labels and explicit Save/Cancel behavior; no existing fields disappear from the workflow. |
| Capture / solution / services / partners | Forms use the available mobile width; long briefs have a comfortable reading measure; open incidents lead to a clear next action. Estimates remain labeled, private terms stay permissioned, and statement review retains its exact total. |
| Inbox / Assistant | Composing remains comfortable on a laptop and phone. The selected conversation, channel, recipient and action state are clear. Scrolling messages does not unintentionally trap the employee in a tiny form panel. |
| Calendar | A phone user can understand the selected month and reach every day's events without guessing that four weekdays are hidden. All day/week/month controls remain available. |
| Documents / knowledge / routines | The page has a proper title, concise metadata, clear primary action and a useful body. Publishing/sharing/scheduling remain explicit, with no loss of review, permission or provenance information. |
| Reports / SEO | Metrics lead, explanation supports. Data periods, freshness, pending/unknown outcomes and spending are truthful. Long strategy/evidence text is readable without dominating every overview. |
| Settings / Mail admin | Categories and current status are easy to find. Routine edits are visually separate from revoke/reset/delete actions. The current selected preference is obvious. |
| Smart Cards / Builder | Daily sharing/review tasks are easy to reach; long campaign/setup details do not dominate the first screen. Existing permanent links, approved plans and previews are preserved. |

November 11 follow-up: the [Sales and delivery pass](SOFTWARE_DELIVERY_POLISH_2026-11-11.md) refines Sales board/table (V06 and the Sales part of V30), Quick capture mobile grouping (V34–35), Partners/statements (V38), and Sites read-first/edit and viewer presentation (V16, V19, V31). This is scoped implementation evidence, not closure of the remaining Assistant, reporting, administration, Mail or physical-device work.

November 11 next follow-up: the [Assistant supporting-page pass](SOFTWARE_ASSISTANT_SUPPORT_POLISH_2026-11-11.md) addresses V21 and the settings portion of V15 with knowledge/document reading and editing layouts, routine cards/forms, grouped access controls and saved notification summaries. Local responsive and interaction evidence is recorded there; reporting/admin, separate Mail and physical-device work remain open.

November 11 reporting/admin follow-up: the [administration pass](SOFTWARE_ADMIN_POLISH_2026-11-11.md) implements the scoped phase-6 presentation improvements for Analytics, Activity, Settings, Smart Cards, SEO overview/review and Builder/import utilities (V11–14, V26, V29–30 and V39). Desktop/mobile evidence and unchanged interaction checks are recorded there. CSV file-picker/mapping acceptance, separate Mail, remaining state permutations and physical-device acceptance remain explicit gaps. The earlier Assistant knowledge layout was also observed live during this pass.

## Verification plan for implementation

This audit is a visual review, not an accessibility certification or a functional release test. For implementation, use these explicit gates:

1. Re-capture all primary pages and changed nested templates at 1440 × 1000, 1366 × 768, 1024 × 768, 390 × 844 and the relevant 320px narrow cases. Include one wide desktop pass. Test both themes, system-theme resolution, long names, long URLs, large counts, empty results and realistic populated records.
2. Check ordinary text at least 4.5:1 and qualifying large text at least 3:1, with actual rendered foreground/background pairs. Include placeholders, status pills and selected/hover/focus states; disabled controls have different requirements. See [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
3. Verify content reflows at 320 CSS px without lost information or unintended page-wide horizontal scrolling. Tables/calendars can have legitimate two-dimensional requirements, but any contained scrolling must be obvious and usable; V17 is a usability recommendation, not an automatic WCAG failure. See [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
4. Prefer 44px touch targets for primary phone actions. Audit smaller controls against the 24px minimum/spacing rules rather than assuming that every small icon fails. See [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
5. Use keyboard-only navigation for menus, finder, filters, status dropdowns, dialogs and forms. Verify one visible focus indicator, initial focus, focus containment where appropriate, Escape/Close behavior and restoration. Check 200% text enlargement and reduced motion independently of narrow viewport emulation.
6. Inspect loading, saving, success, field validation, provider unavailable, upload progress, expired document, stale review, read-only and send-outcome-unknown states using isolated fixtures. Do not create fake production conversions, send customer messages or spend AI money for screenshots.
7. Check overlay intersections and all bottom actions with the phone closed/open, menu open, composer expanded and dialog open. Reserve space for a phone keyboard and native safe areas during actual-device checks.
8. Run functional tests only where component/interaction behavior changes: status editing, modal focus, tabs, filtering, form submission, calendar selection and review preservation. Run the normal required build/type/lint checks. Cosmetic token changes need focused visual comparison, not implementation-mirroring test boilerplate.
9. Treat source, build, deployment and observed UI as separate evidence. Mail deploys separately from the website. Record exact commit, viewport and acceptance result; never call an unobserved state verified.

## Limits and implementation acceptance still required

There is no remaining uninspected current dashboard page template in the 43-route inventory. Mail's reachable page families, aliases and disabled legacy paths are accounted for above. Page coverage is complete for this employee web audit; exhaustive combinations of records, permissions, external outcomes and device states are a separate acceptance matrix.

- **Native/iPhone — source only:** the companion loads the same Mail and Dashboard web products in two native tabs. Its navigation/menu, keyboard-dismiss control, retry/error panel, notification settings, system dialogs, microphone, file picker and share/download presentation were inspected in source but not rendered on an iPhone. This environment and the connected remote machine are Windows; no Mac or iPhone was available. Physical keyboard, safe-area, rotation, push and embedded-browser acceptance remain explicit device checks.
- **Workflow permutations:** representative completed, paused, blocked and stale-review states were rendered. Every Assistant tool proposal/result/file type, every role/provider failure, every statement lifecycle status and long multi-attachment/multi-recipient thread still need controlled regression cases during implementation. The inspected reply-all sample had one recipient; no mail was sent.
- **Native CSV picker:** mapping and confirmation were rendered with synthetic parser input because browser file-upload permission was unavailable. Actual file selection, import submission and its resulting success/error are functional acceptance, not claimed here.
- **Separate design products:** public marketing pages, public smart-card/profile/booking journeys, generated client sites and customer portals require their own visual scope. This report covers employee software and its Mail companion.

## Audit handoff (before implementation)

The deliverable is this report and its ordered implementation plan: **43 dashboard route templates, 20 primary workspaces, Mail/authentication coverage and 41 prioritized findings**. Application design code has not been changed. The report was built incrementally, then reconciled against the current route inventory and accepted screenshots. Markdown/file links, finding IDs, referenced evidence and the scoped diff were checked. Application tests were not rerun for this documentation-only change; preview build evidence is recorded above. The final staged diff is limited to this audit document; collaborators' implementation changes remain separate.
