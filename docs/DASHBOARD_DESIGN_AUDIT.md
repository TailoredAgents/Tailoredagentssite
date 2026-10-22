# Dashboard design audit and implementation plan

Reviewed October 22, 2026. Baseline: `6ed169e`. All 13 navigation destinations, six record templates, the sales table alternative and the two provider workspaces were captured at 1440×1000 and 390×844 using synthetic local records. The populated communications states are also reviewed through the existing Mail/SMS/conversation/voice fixtures. No customer data is used in the previews.

The later [appearance release](DASHBOARD_APPEARANCE.md) replaces this layout pass's bright surfaces with Slate & blue, adds Midnight blue and a saved Light/Dark/System choice, and provides a separate current-theme gallery. This document preserves the original layout scorecard and screenshots.

Scores are a design assessment against a consistent rubric: visual hierarchy (20), shared visual language (20), organization and task focus (20), typography/spacing (20), and responsive/accessibility polish (20). A 100 represents an exceptional, thoroughly validated product; the implementation target is 94–96, with remaining tradeoffs documented rather than claiming perfection.

## Page ranking and original plan

| Page/view | Before /100 | After /100 | Target | Work needed |
| --- | ---: | ---: | ---: | --- |
| Settings | 60 | 95 | 95 | Replace the long status list with service cards; separate account, messaging and calling controls; retain direct section links. |
| Project record | 64 | 94 | 95 | Add a clear summary, distinguish saved work from entry forms, improve milestone layout and section navigation. |
| Activity | 65 | 94 | 94 | Give events, actors and times a clearer hierarchy; polish the sparse state and mobile rows. |
| Projects | 66 | 95 | 95 | Give the list the full page; move creation into a focused drawer; improve filters and density. |
| Clients | 67 | 95 | 95 | Full-width relationship directory and a deliberate create flow; readable rows and contextual actions. |
| Sites | 67 | 95 | 95 | Full-width inventory, URL hierarchy, consistent status chips and a focused create drawer. |
| Client record | 68 | 94 | 95 | Put the relationship summary first, separate contact creation, group sites/projects and account controls. |
| Calling lists/imports | 69 | 94 | 94 | Clear import step hierarchy, quieter guidance and stronger separation of import work from list performance. |
| Site record | 70 | 94 | 94 | Clear site identity, environment/status facts and an orderly configuration form. |
| Contact record | 71 | 94 | 94 | Consistent record heading, form spacing, grouped fields and action placement. |
| Mockups | 72 | 94 | 95 | Consistent queue cards, status colors, restrained metrics and clear handoff actions. |
| Overview | 73 | 96 | 96 | Show the business summary before navigation cards; prioritize daily work and reduce competing visual blocks. |
| Sales record | 73 | 94 | 95 | Consistent record identity, context/control distinction, hierarchy and forms. |
| SMS workspace | 73 | 94 | 94 | Match the shared shell, buttons, sender controls, message surfaces and setup states. |
| Lead record | 74 | 95 | 95 | Improve record summary, contact facts, notes, follow-up controls and notification metadata hierarchy. |
| Email workspace | 74 | 94 | 94 | Match the shared shell, typography, composer, setup and access states. |
| Leads | 75 | 95 | 95 | Compact filters and table hierarchy; retain fast manual entry and make the top of the page less repetitive. |
| My day | 76 | 96 | 96 | Bring commitments forward, tighten summary metrics, and organize queues and owners. |
| Sales table | 77 | 95 | 95 | Align with other directories; improve status/owner/value scanning and filter organization. |
| Analytics | 78 | 95 | 95 | Bring report surfaces, heading scale and controls into the common system while retaining evidence and date explanations. |
| Sales board | 79 | 95 | 95 | Unify metrics and tabs; polish stage lanes, card typography, owners and horizontal browsing. |
| Unified Inbox | 82 | 96 | 96 | Preserve its useful three-pane organization; refine queue density, history, composer, focus and phone controls. |

The final review averages **71.5 → 94.7/100**. The After column reflects the implemented desktop/phone review, rather than a promise of a perfect score.

## Implementation sequence

1. Establish dashboard-scoped tokens for ink, neutral surfaces, brand blue, semantic states, spacing, radius, focus and motion. Apply them to every existing component family without changing the public website.
2. Refine the shared navigation, account identity and page headings. Organize work into daily work, sales, delivery and workspace groups. Add a keyboard-accessible page finder for existing destinations.
3. Make list pages about browsing and filtering. Move client/project/site creation into shared accessible drawers, preserving existing actions, form values, viewer permissions and hash links.
4. Reorder Overview and Settings around common tasks; add useful record summaries and section links; keep disclosures explicit and reversible.
5. Bring sales, reporting, email, SMS, shared conversations and browser calling into the same component vocabulary. Preserve channel permissions, drafts, callbacks and active-call behavior.
6. Capture every page again, inspect desktop and phone comparisons, check narrow/tablet widths, run accessibility and workflow regressions, build, then commit and deploy on `main`.

## Wholesale reference

Reviewed the actual [workspace shell](https://github.com/TailoredAgents/Wholesale/blob/main/apps/web/src/app/os/os-shell.tsx), [navigation](https://github.com/TailoredAgents/Wholesale/blob/main/apps/web/src/app/os/os-nav.tsx), [theme tokens](https://github.com/TailoredAgents/Wholesale/blob/main/apps/web/src/app/os/os-theme.module.css), [page contracts](https://github.com/TailoredAgents/Wholesale/blob/main/apps/web/src/app/os/_components/page-contracts.tsx), and [shared controls](https://github.com/TailoredAgents/Wholesale/blob/main/apps/web/src/app/os/_components/design-system.tsx). The useful patterns are consistent queue/record/list layouts, clear task groups, contextual forms, controlled density and shared interaction states. Tailored Agents keeps its own blue identity and agency workflows.

## Review artifacts

Open [the visual comparison gallery](previews/design/index.html) for each page on desktop and phone. Original screenshots are preserved in `previews/design/before/`; revised screenshots and automated findings are recorded separately in `previews/design/after/`.

The provider setup states in the gallery are supplemented by populated fixture captures: [shared Inbox desktop](previews/conversations-desktop.png) / [phone](previews/conversations-phone.png), [email desktop](previews/inbox-desktop.png) / [phone](previews/inbox-phone.png), [SMS desktop](previews/sms-desktop.png) / [phone](previews/sms-phone.png), and [active calling desktop](previews/voice-active-desktop.png) / [phone](previews/voice-active-phone.png). These also contain synthetic local accounts and messages.

## Implemented result

- Shared typography, neutral surfaces, blue actions, semantic status colors, spacing, form controls, focus rings and reduced-motion behavior now span operations, sales, reporting, email, SMS, the unified Inbox and persistent phone. The public marketing presentation is outside this change.
- The sidebar groups Daily work, Sales & prospects, Clients & delivery, and Workspace. **Ctrl/Cmd+K** finds existing dashboard pages; it deliberately describes page search rather than implying a customer-record search.
- Client, project and site directories use the full content width. Their create controls open keyboard-accessible native modal drawers; Escape/close restores focus and cancelled values remain when reopened. Existing create hash links remain supported, and contextual client links preselect the correct client. Viewer accounts receive no create drawer.
- Overview leads with real business metrics and quick actions, followed by the sales, conversation and delivery workspaces. Settings presents account identity and nine accurately derived service statuses, with separate expandable SMS and calling controls. Existing `#sms` and `#calling` links reveal those controls.
- Lead/client/project summaries surface the owner, dates or relationship facts before the working record. Client/project/sales section links help reach saved work and settings. Dense tables, stage lanes, empty states and record forms follow the same styling.

All six implementation steps above are complete in source. The small gap from the original targets on complex record pages reflects the continuing density of multiple editable forms and the need to validate their grouping during daily team use. No score is an objective guarantee of visual perfection.

## Verification

All data mutations and provider exchanges used disposable local PostgreSQL databases, synthetic accounts and local provider fixtures. Live customer records, email deliveries, SMS sends and calls were not used for this review.

| Check | Result |
| --- | --- |
| Strict TypeScript, lint, production build | Passed |
| Website unit/PostgreSQL tests | 327 passed in 34 files |
| Existing CRM/reporting browser suite | 33 passed; one duplicate phone viewport sweep intentionally skipped |
| Unified Inbox / SMS / email / voice browser suites | 16 / 14 / 10 / 18 passed |
| New visual and interaction suite | 10 passed; 22 pages on each of desktop and phone |
| Automated WCAG A/AA checks | No reported violations across the 44 revised page captures or new finder/drawer controls; populated provider fixtures also passed their existing accessibility checks |
| Responsive layout | Existing 320–1920px sweeps passed; no page-level horizontal overflow in the 44 revised captures |
| Interaction coverage | Page finder, Escape and focus return, preserved cancelled drawer input, contextual client selection, Settings deep links, record section links, existing manual leads/imports/conversion/forms, channel permissions, messaging and active-call navigation |

The tests exposed and resolved muted-text contrast, the manual-lead Cancel background, a narrow Settings profile, and an absolutely positioned screen-reader hint escaping the phone shortcut scroller. Final captures follow those fixes. Native table/board/section scrolling remains deliberate inside its container.

## Refinements toward 100

The next design evidence should come from Devon, Jeffrey and Austin using their real longest records and queues. Check the actual iPhone companion and a physical phone, keyboard-only use and a screen reader; refine record-form grouping if the team still has to hunt for common actions. Browser emulation and automated accessibility checks do not replace those observations. At shorter desktop heights the sidebar scrolls to keep all destinations available.

Provider activation, outgoing attachments/CC/BCC, signatures/templates, recordings/transcripts and billing are separate functional roadmap work. They are not required to apply this visual system and are not represented as finished by these scores.

## Reproducing the review

Use the existing disposable PostgreSQL fixture on port **55433**. The new design seed refuses any other host/port/database name.

```powershell
$env:TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:55433/ta_reporting_browser_test'
node scripts/seed-design-preview.mjs
npm run build
npm run test:design:browser
node scripts/design-gallery.mjs after
```

The seed resets this disposable database. It is not a production import command. The suite runs the production build on local port 3170, writes revised screenshots/findings separately, and preserves the original `before` images. Run browser suites sequentially or use separate Playwright output directories; the provider suites also share Next's development output and must run one at a time.

Implementation lives in `app/dashboard/polish.css` and the shared components in `components/dashboard/`; existing page styles retain layout responsibilities. There are no dependency changes, schema migrations or provider-configuration changes in this release.

## Website delivery

Source **43bb46642f9cb13801ee458068419d1097a274b3** was pushed to `main`. Render reported successful deployment on **October 22, 2026 at 10:43:40 a.m. EDT** (**14:43:40 UTC**). GitHub deployment **7255189660**; [Render deployment](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbd21d6k1f9s73b8adlg).

Post-deployment checks completed at **10:44:38 a.m. EDT**: website, sign-in, health and Mail login returned 200; all 13 dashboard destinations and a protected voicemail request redirected anonymous requests to sign-in; all seven voice callbacks rejected GET with 405. Dashboard responses retained private/no-store caching, private microphone permission and the exact production Twilio CSP hosts without the local fixture host. The public microphone policy remained restrictive.

Authenticated visual and workflow verification used the production build with isolated local accounts. Production acceptance here verifies deployment and anonymous boundaries; it does not use a teammate's private session or establish live Mail/Twilio delivery. No production provider configuration or customer records were changed.
