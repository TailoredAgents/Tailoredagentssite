# Client-success operations

November 15, 2026 implementation checkpoint. Migration **0073** adds account-wide follow-through to the existing CRM. This release prepares the software; no real business calendar, client enrollment, employee alert or financial rule is activated by the migration.

## Where employees work

Open **Services → Client success**, or **Client → Client success**. The workspace shows managers, open/overdue work, calendar coverage and scheduling holds. Client pages show the plan and commitments; tasks also appear in **My day**, using the existing `/dashboard/tasks/[id]` route. Call follow-ups retain their existing flow.

- A person records an inbound request, substantive communication or agreed follow-up using its actual timestamp, unique source reference and a summary suitable for the shared CRM. This release does not inspect private mailboxes or automatically discover inbound messages. Until a separately reviewed integration is added, employees must record requests here.
- Response and communication-logging deadlines use the selected reviewed calendar. Agreed follow-ups have explicit deadlines. Scheduled check-ins and suitable-opportunity reviews use anchored calendar-month intervals; a short month does not permanently move a month-end anchor. “No suitable opportunity” is a valid review outcome.
- The current account manager or an owner/admin records the actual human outcome and next action. An automatic acknowledgement is recorded separately and leaves the obligation open. Completing a response or check-in creates a separate communication-logging task.
- Administrators may reschedule or excuse work with evidence. Original deadlines and original owners remain recorded. Actual work time and recording time are distinct; a late response remains late against the original deadline. An excuse never counts as a human response.
- Manager changes transfer open client tasks, resolve stale alerts and append assignment evidence. Completed history is retained. No task, response, missed deadline or assignment change automatically creates, revokes or pays a commission. Formal eligibility, leave protection and notice/cure decisions stay in the separate finance-authorized workflow.

Workspace and task reads require current active membership. Viewers cannot write; only the current account manager or owner/admin can record outcomes. Calendar, cadence, assignment, availability, pool and exception approvals require owner/admin authority. Assistant read tools `list_client_success`, `get_client_success` and `get_client_success_task` use those same access boundaries. New customer-send or finance-write tools are not added.

## Review settings before activation

No actual policy values or named manager roster are seeded. An owner/admin publishes an immutable calendar version with:

- Eastern working weekdays and opening/closing times;
- human-response allowance in business minutes;
- the exact next-working-date cutoff for closed-hours requests;
- logging allowance in business days;
- explicit calendar coverage and a reviewed holiday list, including an explicit empty list if none apply.

Dates outside coverage and ambiguous/nonexistent DST times hold scheduling for review. Logging deadlines are the close of the configured number of following working dates. Requests arriving before opening are due at that working date’s configured cutoff; requests at/after closing use the next working date. These conventions must be accepted against actual private agreements before enrollment. Minute-level timestamps round the remaining response allowance forward.

Configure each active client’s manager, calendar, first check-in/review dates, intervals, reminder lead time and evidence for any agreed cadence exception. Modes are **off**, **observe** (tasks only) and **remind** (eligible employee alerts). Changing a calendar or cadence affects new tasks; existing tasks require explicit exception review. Backdated anchors generate missed obligations instead of silently skipping them. Turning a plan off preserves existing open work and history.

The configurable manager pool lists specialties, active-client capacity, open work and least recent assignment first. Recorded unavailable periods exclude candidates and suppress alerts during those Eastern dates. An administrator still reviews service fit and makes the assignment. Current assignments are never automatically moved, and leave is not treated as forfeiture. Availability evidence is append-only; carefully review dates before recording. An incorrect period currently requires an engineering-reviewed correction that preserves its original evidence; no destructive UI edit is provided in this checkpoint.

## Independent background scheduling and alerts

`runClientSuccessWorker` runs in the existing authenticated `/api/cron/search-console` job before reporting maintenance and separately from paid assistant work. The repository’s existing schedule is every five minutes; verify the actual hosting schedule during acceptance. The optional `npm run clients:worker` command runs one bounded pass using injected server environment variables. Do not create a second schedule unnecessarily.

- `CLIENT_SUCCESS_WORKER_ENABLED=false` by default. When enabled, it processes up to 25 clients per pass, generates work due within seven days and catches up at most 12 occurrences per cadence per client/pass. Row locks, source uniqueness and committed cursors prevent duplicate work under concurrent/repeated passes. A failed client transaction preserves its cursor and saves a visible hold. The next pass retries; other clients continue.
- `CLIENT_SUCCESS_REMINDERS_ENABLED=false` by default. Alerts also require worker enabled, a client plan in **remind**, and the employee’s **Include client follow-up reminders** preference under **Assistant → My work → notification settings**. No OAuth grant, paid model request or chat session is required for deadline computation or these task alerts.
- Existing verified-phone consent, SMS opt-out, native-device verification, push preference/fallback, quiet hours, cooldowns and employee/workspace caps still apply. Native iPhone delivery retains the existing paid-Apple-signing/device activation gates. This release does not activate native push.
- Alerts contain generic work-feed wording, never customer message bodies. The private work feed links to the task. Before sending, delivery rechecks current membership, workspace/client state, current manager, open task/revision, plan mode, employee opt-in, global switches and availability. A provider request already in flight cannot be recalled.
- There is at most one notification per task revision/current owner, not a daily repeated escalation. Alerts expire after seven days; the task remains in the CRM. Employee delivery may coalesce multiple pending items into one generic work-feed alert. Review open/overdue tasks in My day regardless of delivery.

Client status changes to inactive/archived stop new scheduled work and invalidate alerts; existing obligations remain available for review. Membership loss, missing managers and expired calendars produce holds rather than inferred replacements. Neither worker writes financial eligibility or provider billing records.

## Acceptance and rollback

1. Deploy migration 0073 with its source changes; do not run older writers against new source types. Verify Services, client/task pages and viewer permissions using an authorized employee account.
2. Review the actual calendar/cutoffs, holidays, cadence exceptions, approved manager pool and availability. Keep those business terms private. Start with an approved **observe** cohort.
3. Enable only `CLIENT_SUCCESS_WORKER_ENABLED`; confirm the existing cron actually runs, tasks appear in My day, retries do not duplicate them and holds are visible. Review original/changed deadlines and a manager handoff.
4. Separately approve an employee-only delivery pilot, verify each employee’s channel, opt in, set only the selected plans to **remind**, then enable the reminder switch. Confirm quiet hours, opting out, completion and reassignment suppression. No customer is contacted by this feature.
5. Pause reminders immediately by setting their switch false. Pause new scheduling with the worker switch or an individual plan’s off mode. Preserve tables/history; do not roll back by deleting evidence. Existing tasks remain reviewable.

Local verification is recorded in the release result: calendar and database scenarios cover business-time boundaries, DST/holidays, original deadlines, duplicate/replayed actions, concurrent workers, holds, human versus automatic responses, logging tasks, tenant/role checks, transfer/availability and generic mocked employee delivery. Existing finance and notification regression suites are also run. Desktop/phone browser journeys exercise real server actions, read-only access, accessibility and overflow. Provider delivery and authenticated production acceptance are separate and are not claimed by local tests.

Remaining pre-Stripe work: reviewed assistant billing actions, remaining documented financial lifecycle/credit/settlement exceptions, private-policy acceptance and the final provider-backed checklist in [Jeffrey’s handoff](JEFFREY_STRIPE_SETUP.md).

## Verified local release evidence — November 15, 2026

- 151 distinct unit/integration cases passed: 117 across client-success, recurring commissions, billing, commercial preparation and relationship operations; 30 existing employee SMS/native-push cases; four shared-worker cases, including scheduling before a reporting failure.
- Four desktop/phone browser journeys passed against an isolated PostgreSQL database and production build. They publish a calendar, enroll a synthetic client, create a response task, record an automatic acknowledgement, complete a human response and verify the logging follow-up. Viewer controls, WCAG A/AA checks and page-width assertions pass. Outcome and client screenshots were visually inspected.
- Production build (including TypeScript), standalone typecheck, lint, disabled worker-command check and whitespace checks passed. All 100 local links in affected runbooks/current summaries resolve.
- All fixtures are synthetic. SMS/APNs calls are mocked. No customer communication, real employee alert, provider billing operation or payable financial entry was created. Existing `next-env.d.ts` local development imports are preserved outside this commit.

This is source/local evidence, not confirmation of an authenticated production rollout, an active scheduler or real device delivery.
