# From first conversation to ongoing partnership

Implemented November 10, 2026. This guide describes the relationship operating-model releases 2–5. Deployment acceptance is tracked separately in [the plan](RELATIONSHIP_OPERATING_MODEL_PLAN.md). Existing [overview and handoffs](RELATIONSHIP_WORKSPACE.md) remain the starting point for a connected customer record.

## How the team uses it

- **Devon:** use My day’s Appointment setting focus. Capture introductions and business conversations, arrange an actual appointment through Team calendar, and hand discovery to the appropriate teammate. An introducer, appointment setter and salesperson are distinct roles.
- **Austin and Jeffrey:** use Sales & relationships or Development & delivery. Review the relationship, record discovery, shape a solution brief, scope a pilot, and use the existing opportunity/project workflows for implementation.
- **Conner:** use Finance & partnerships. Configure the private referral rules and agreements before activation, review source-backed earnings, and record approved statements and externally completed settlements. Owner/admin finance access is inherited; other teammates require an explicit finance grant.

These are owner-supplied responsibilities, not automatic permission assignments. My day’s saved work focus changes presentation only. It never grants finance, mailbox, meeting or sending access.

## Finding your work

**Sales & prospects → Meetings & notes** brings recording intake and typed conversation capture into one place. Choose **Add recording** for audio, transcripts and AI findings, or **Quick capture** for notes saved to a new or existing prospect. Recording access and relationship-note access keep their existing permissions; these are two entry paths, not a merged data feed. You do not need to use both for the same conversation.

**Smart Cards**, **SEO manager** and **Sites** are under **Workspace**. **Clients**, **Projects** and **Services** remain under **Clients & delivery**. The page finder also recognizes the former Meeting Inbox and Capture conversation names.

Click any of the four sidebar section headings to collapse or expand its links. Each section works independently, including the one containing your current page. Choices are remembered for your account and workspace in this browser; all sections start expanded when no choice is saved. The current section stays highlighted, and **Find a page** searches every destination even when its section is collapsed. On phones, open **Menu** to use the same controls.

## Capture a conversation

1. Open **Sales & prospects → Meetings & notes → Quick capture**, or use the **Quick capture** shortcut in My day.
2. Save whatever is known: a person, contact detail, event or useful conversation context. No specific name, company, phone, email or website is mandatory.
3. If a phone/email is known, use **Check existing prospects**. A matching existing prospect requires an explicit choice: append to it or deliberately create a separate record. No name-based merge occurs.
4. Record the introducer and appointment setter separately. Choose the follow-up owner for a new prospect.
5. Saving opens the relationship overview. Use **Hand off next step**, **Team calendar**, or the existing prospect follow-up controls for the actual next commitment.

Appending an encounter does not replace existing contact details, owner, source or NFC/QR campaign context. It adds the conversation and any explicitly selected introduction. Manual capture does not trigger automatic lead-introduction SMS, email, booking or Website Builder work. Existing standard manual entry retains its phone-or-email requirement; this new encounter workflow supports contacts whose details are still incomplete.

## Discovery → solution design

The general sales-stage label is now **Solution design**; the stored `mockup` key and existing history are unchanged. Website preview requests remain available when the solution actually includes a website.

On the relationship overview, use **Shape the right solution** to create a brief containing:

- Confirmed workflow, systems/access, volumes and the current baseline.
- Desired outcome, assumptions and missing information.
- A bounded pilot, human checkpoints and acceptance criteria.
- Delivery responsibility and the agreed ongoing support scope.

Edits create an attributable version snapshot. Marking a brief Reviewed internally requires a pilot, acceptance criteria and delivery responsibility, but does not establish a contract, client acceptance, a delivery project or permission to build. Use existing opportunity conversion, projects, tasks and calendar controls for those steps.

**Draft with assistant** opens an editable request in the existing employee chat. Nothing is submitted automatically. The assistant can read permitted discovery and brief history, prepare a draft through the existing review/direct-action pipeline, and cite connected team sources. No new AI job, separate research allowance or website build is enabled. Normal employee-chat usage applies only when the employee sends the request.

Briefs are team-visible. Explicit source citations must point to connected discovery records or currently team-shared meetings. Private meetings cannot be cited until deliberately shared through Meetings & notes. Already published brief text is its own saved team record; changing a source’s later visibility does not retract that text. Do not copy private messages or recordings without the owner’s sharing direction.

## Ongoing client services

Open **Clients & delivery → Services**, or use the Services link for a client from its relationship overview.

1. Record the actual client, service type, responsible teammate, optional delivery/deployment reference, support scope, review cadence, next review date and optional renewal date.
2. Health starts as Unknown. Record a review with what was checked and evidence. These are team observations, not automated uptime probes.
3. Record incidents with an owner, next action and Eastern deadline. They appear in My day for the service owner and incident assignee. Closing the final incident resets health to Unknown until reviewed; it does not automatically claim recovery.
4. Record usage/outcomes with source IDs, dates, evidence and methodology. Actual activity and the previous-process baseline can each be Observed or Estimate. Any estimated input keeps the resulting comparison labeled as an estimate.

Time comparison is `document count × baseline seconds per document − actual total seconds`. Negative results are retained. No financial ROI is inferred from a sales amount. These measurements never create payable document counts in the referral ledger. Provider cost fields are readable only with finance access and writable only with finance-management access.

Due reviews, open incidents, degraded health and renewals within 14 days appear in My day and the assistant’s daily-priorities read. Existing opt-in routines can read these through their current grants. No notifications or schedules are activated by this release. Health review inputs have minute precision; same-minute reviews may update the recorded state, while older observations remain history without overwriting newer health evidence.

## Assistant capabilities

The existing native assistant and Operations MCP share these domain services:

- Reads: company operating guide, solution briefs, encounter matches/history, services and service history, permitted partners and statements, and expanded daily priorities.
- Changes: solution briefs, sparse encounter capture, service records/reviews/incidents/measurements, partner creation, agreement drafts, source earnings, correcting reversals and statement drafts.
- Existing relationship discovery, introductions, account managers and handoffs remain available.

Operations read/write scopes remain necessary. Finance access is separately enforced inside the services; knowing Conner’s role or selecting Finance focus grants no authority. Financial access grants, agreement activation and statement review/approval/payment recording stay in authenticated Partners controls. Assistant proposals are not completed writes, and a connection’s direct mode does not bypass domain authorization or revisions.

## Deployment and remaining activation

Website migrations `0064_relationship_operating_model.sql`, `0065_solution_design_and_encounters.sql` and `0066_client_services.sql` are additive and applied by the existing Render main-branch build. No Cloudflare Mail deployment, credentials, new provider, subscription or paid research activation is required.

Conner configures the actual rates and policies before any agreement is activated. [Referral ledger setup](REFERRAL_LEDGER.md) is the operating checklist. The public repository contains no owner-supplied commercial rates. Financial records are internal and authenticated; the public partnership page is unchanged.

After deployment, verify the exact commit, new sidebar entries, a relationship’s solution section, My day focus/exception views and finance boundaries using the actual staff accounts. Source/tests do not prove those live account journeys. Financial integrations, automatic money movement, automated uptime monitoring, external accounting imports and new notifications are outside this release.

## November 11 navigation update

Meetings & notes replaces the separate Meeting Inbox and Capture conversation sidebar entries. Existing recording and capture URLs continue to work, and Quick capture highlights the same Sales & prospects destination. Smart Cards, SEO manager and Sites now appear under Workspace, including their page headings. No migrations or permission changes are required.

Local verification used a separate checkout and disposable database with synthetic audio, AI and storage: four desktop/phone browser journeys passed, covering both entry paths, sidebar groups, old-name page search, upload/review and private access denial, and sparse-note capture through solution planning. Screenshots were visually reviewed; existing accessibility checks passed. Route type generation, TypeScript, lint and a production Webpack build passed. These are local results, not production acceptance or physical Omi verification.

Sidebar follow-up: all four headings now independently collapse, with account/workspace-specific browser preferences and a visible current-section highlight. TypeScript, lint, the production Webpack build and both existing desktop/phone page-finder tests passed. The isolated browser review confirmed keyboard toggling, hidden links disappearing from accessible navigation, persistence after reload and navigation, search while sections are closed, and the 390px mobile menu. The keyboard focus outline stays inside the scrollable sidebar. This verification used demonstration records only.
