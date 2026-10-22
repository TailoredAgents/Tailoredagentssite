# Reviewed call follow-ups

October 22, 2026. This extends the owner's working recordings/transcripts workflow. Migration **0015_call_follow_up_tasks.sql** uses the existing CRM task queue for call follow-ups, including callers without a sales opportunity. No additional Twilio, OpenAI or Mail configuration is required.

## Staff workflow

1. In **Inbox**, open the call's **Transcript, summary & follow-ups**.
2. Review the suggestion and its transcript evidence. Edit the wording if needed, then choose **Create task**.
3. Confirm the task title, teammate and due date/time. Optional notes can hold the full scope. Choose **Save follow-up task**.
4. Open the saved task from the call, the conversation's **Next action**, or **My day**. Edit, reschedule or reassign it there; complete or cancel it with a saved outcome.

My day defaults to the signed-in teammate's work. **Team** shows work the viewer can access. The existing queue includes overdue work and work due within seven days, capped at 100 combined tasks. Later-dated tasks remain reachable through the conversation and saved task link. The conversation shows its earliest scheduled task; completing one can reveal the next task.

## Persistence and access

- Suggestions remain suggestions until a person saves a task with an explicit assignee and due time. This workflow sends no customer communication and performs no paid AI request.
- One recording/suggestion creates at most one task, including retries and concurrent saves. Reloading shows its saved task link and current status. Further edits happen on the task page.
- A task links to the durable call source, so combining conversations preserves its destination. No artificial sales opportunity or lead is created.
- Reading and editing require current workspace membership and read access to the original calling line. Viewers can read permitted tasks, but cannot create or change them. Assignees must be active teammates with call access; assignment does not grant access. My day's team view enforces the same call boundary.
- Explicitly saved human work survives recording/analysis deletion or the 90-day recording expiry. New conversions require an available recording, transcript, validated suggestion and matching transcript evidence. Existing prospect retention protects recent/future work and scrubs stale task text/outcomes when the related prospect is anonymized.
- The migration preserves the later Mail/SMS/Inbox retention wrappers and supports the older reporting helper layout. It leaves existing opportunity tasks attached to their original sales records.

## Verification and delivery

Verification: **353 code/PostgreSQL tests across 35 files**, including eight new task persistence/access/retention cases; **22 calling desktop/phone checks**, the new task workflow repeated in both dark-theme viewports, and **four shared Inbox history/draft/send checks** pass. The final scheduler also passes its focused light/dark browser checks, including native dialog dismissal/focus return, accessibility, duplicate-save protection through reload, assignment, My day visibility, editing and outcome persistence. Lint and strict TypeScript pass. All browser fixtures use synthetic staff, customers and call analysis, with no customer outreach or live provider requests. Clean local database migration checks pass; pre-existing test fixtures with an obsolete earlier sales schema were rebuilt before the complete suite passed.

The Next.js production build passes and includes the protected `/dashboard/tasks/[id]` route. Deployment evidence will be recorded after the release completes. Automated verification does not claim an independently created production task.

Previews: [schedule a task](previews/call-follow-up-schedule-desktop.png), [task detail](previews/call-follow-up-task-desktop.png), [phone task](previews/call-follow-up-task-phone.png), [My day](previews/call-follow-up-my-day-desktop.png), [dark task](previews/themes/dark/providers/call-follow-up-task-desktop.png).

The next Inbox increment is starting a missing email/text channel with the selected customer's saved details prefilled. Jeffrey's shared-email activation remains a separate handoff.
