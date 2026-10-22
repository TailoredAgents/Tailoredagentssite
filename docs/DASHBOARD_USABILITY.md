# Dashboard readability and everyday workflows

Historical October 21 release record. The October 22 [22-page design audit and implementation](DASHBOARD_DESIGN_AUDIT.md) supersedes the presentation and create-form layout described here; creation now uses focused drawers. The verification and deployment evidence below belongs to the earlier release.

October 21, 2026. Work is on `main`, as Jeffrey requested. This release covers the existing internal workspace. The separate Google authorization and live-import acceptance checks remain open.

## What changed

- All eight dashboard tabs share readable navigation, 16px body/form text and labels of at least 14px. Headings, spacing, focus indicators, contrast and button sizes are consistent.
- Overview now shows real open inquiries, due follow-ups, project deadlines and recent activity. Counts and links come from the signed-in workspace. Won, lost and archived leads are excluded from the open count. Follow-ups and deadlines include overdue work and the next seven days, with five entries per section.
- Desktop lists display complete wrapped names, addresses and next actions. Phone lists become labeled cards. Create forms move below the list when space is limited; Add buttons jump directly to them.
- Phone navigation uses a visible Menu button. Escape closes it and returns keyboard focus. All current tabs remain available. The unused workspace dropdown and future-feature navigation have been removed; the roadmap stays in the product documentation.
- Forms show pending states and save/error messages. View-only teammates see an explanation and disabled editing controls. Milestone changes now report success or failure instead of failing silently. Server-side permissions remain in force.
- Search fields have accessible names. An empty client search explains that no records matched. The lead CSV button explicitly says it exports all leads, matching the existing export behavior.
- Settings explains shared Mail credentials and checks the saved Google connection instead of treating configured client credentials as a completed connection. Email notification configuration is shown separately. There is a direct link to Mail.
- Operational timestamps identify UTC. Reporting retains Pacific report-day boundaries and its existing local update-time display.

## Verification

All automated record changes use disposable local PostgreSQL databases and synthetic accounts. The preview contains demonstration records only.

| Check | Result |
| --- | --- |
| Lint, strict TypeScript, production build | Passed |
| Unit and PostgreSQL integration tests | 74 passed |
| Browser tests | 19 passed; one duplicate phone viewport sweep intentionally skipped |
| All tabs and record screens | 13 routes checked on desktop and phone |
| Accessibility | No automated WCAG A/AA violations on those screens; visible text >=14px; operation fields >=16px |
| Layout widths | All 13 routes fit at 320, 390, 768, 1024, 1280, 1440 and 1920px |
| Real form workflows | Lead edit and reload, note creation, milestone update and reload, contact edit and client view |
| Access restrictions | Read-only form controls, protected reports/exports and management routes; workspace isolation for new overview queries |
| Existing Analytics | Date filters, search, sort, pagination, export, keyboard use and disconnect confirmation passed |
| Dependency audit | Zero reported vulnerabilities |

Automated accessibility checks do not replace every assistive-technology or real-device check. Production records are not modified by these tests. No schema, dependency, hosting, billing, public-page design or Mail code changes are required.

## Preview and review

These screenshots show **synthetic local data**, not production accounts or Google connection evidence:

- [Desktop overview](previews/dashboard-overview-desktop.png)
- [Phone client list and form](previews/dashboard-clients-phone.png)

For Austin or Jeffrey: open each dashboard tab, open a client/project/lead, try the phone Menu, and confirm that your actual longest names and addresses remain readable. Set a lead's next action date or a project's deadline to see it appear on Overview. Follow the existing Google activation checklist separately.

To reproduce locally, use the disposable PostgreSQL databases documented in `SEARCH_CONSOLE_READINESS.md`, build the website, start `npm run reporting:preview`, then run `npm run test:browser`. The seed command refuses a non-local or incorrectly named database. Browser test credentials are fixture-only.

## Deployment and rollback

Push the verified commit on `main`; the existing Render service deploys automatically. Verify the exact commit is live, website/health responses, anonymous redirects for protected pages, and Mail availability. Jeffrey confirmed his own shared Mail/dashboard sign-in works before this design update.

There are no migrations in this release. If a display regression appears, redeploy the prior compatible website release through Render. Keep the current database and Mail service intact. Do not reset the database or roll back the shared-sign-in migrations. Record the resulting deployment in this document after verification.

### Live deployment evidence

- Commit `beb1ae78456780b62ac9cbafe9aae905bc4c1889` is live on the existing Render website service. Deployment `dep-dbcf78gu01pc73bn35s0` finished October 21 at 17:18:54 UTC.
- The deployed dashboard CSS returns 200 and contains the new phone menu, view-only banner and task-list styles.
- After deployment, website, sign-in and health return 200; all eight dashboard tabs redirect anonymous requests to sign-in with private/no-store responses; report export returns 401. Mail login returns 200. The apex redirect preserves the path and query on www.
- Authenticated design and record-change checks used the built application with isolated test accounts. Jeffrey’s production data and personal session were not used for automated tests.
