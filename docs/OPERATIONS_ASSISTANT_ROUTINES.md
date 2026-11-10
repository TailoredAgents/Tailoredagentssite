# Employee routines and follow-up

November 10, 2026. Implementation uses the existing assistant worker and company allowance. Production activation is recorded separately in the release notes.

Employees open **Assistant → My work → routine templates and follow-up settings**. New routines are paused until the employee selects **Enable this routine**. Background access must be explicitly granted in Settings; it is renewable and expires after 30 days. No routines are silently created for the team.

| Template | Sources and result |
| --- | --- |
| Morning priorities | Assigned due tasks, upcoming meetings and owned blocked project work |
| Meeting preparation | Upcoming consultations and CRM appointments; current context and open questions |
| Unanswered follow-ups | Assigned, accessible conversations with an outbound message at least two days old and no later inbound reply |
| Weekly summary | Recent assigned tasks and owned project/milestone changes, bounded to the preceding seven days |
| Watch for changes | Selected new customer replies, overdue tasks, changed/upcoming meetings and blocked delivery work |
| Custom | An employee's existing instruction, within their current assistant permissions and review rules |

Templates prepare private recommendations and downloadable files. Their tool catalog cannot change customer records, send communications, create routines, change memory or publish guidance. Custom routines retain the existing permission model. The assistant's intervention/review notices already use the work feed and notification service.

Schedules use the selected IANA time zone, including daylight saving changes. Watches are eligible for scans about every five minutes, subject to worker availability. Each scan groups current eligible source versions into one bounded assignment (at most 20 sources). Transactional metadata records changes without copying message bodies. Deterministic source selection does not call the model. No eligible work means no AI charge.

The default editor allowance is $0.75 per run, with one run per local day. Employees can select $0.25–$25 per run and one to three runs per day; **all runs still share the $25 monthly company ceiling**. A routine with unfinished, paused, blocked, waiting-for-review or uncertain work cannot start overlapping work. A daily limit includes attempted runs, not just successes. Limits are ceilings, not prepaid spending.

Source versions, execution identity, worker claims and consumed watch events are saved. Replayed scans do not recreate the same work. An expired scan lease can recover. Before every step and external notification, the worker rechecks access, source revision and whether the condition is still relevant. A newer reply in another permitted channel cancels an obsolete unanswered-follow-up brief. Pausing or editing interrupts pending work and cancels old review requests. Paid requests and uncertain provider outcomes retain their receipts/reservations and are never blindly retried.

Generated routine files stay private and retain source access checks when listed, read or downloaded. Completed tasks can remain in historical briefs; reassignment, source removal, anonymization or revoked conversation access hides the affected file. Previously viewed chat history and already downloaded copies have their separate retention policy. Summaries select bounded priority records and must not be presented as exhaustive business reports.

External alerts are off by default for each new routine. Enabling them also requires the employee's existing verified channel preference, selected categories, quiet hours and daily limits. Completion alerts additionally require the employee's **Include completed work** preference. The in-app feed remains available. Routine alerts do not send customer booking notices or customer outreach.

`ASSISTANT_PROACTIVE_ENABLED=false` pauses template scans and execution; existing custom routines retain their separate controls. Production requires migration `0060_assistant_proactive.sql` and the existing worker invocation. New source triggers record metadata only; event history expires after seven days and consumed watch identities after 90 days.

Local acceptance includes database tests for concurrent scans, duplicate events, bounded batches, grant expiry, source ownership, cross-channel replies, cancellations, daily/cost limits, read-only template tools, historical file access and notification suppression. Browser and release verification results are recorded in the delivery plan. Actual SMS/APNs delivery and physical iPhone acceptance are separate activation checks.
