# Relationship overview and team handoffs

Implemented November 10, 2026 as release 1 of [the operating-model plan](RELATIONSHIP_OPERATING_MODEL_PLAN.md). This extends existing CRM records; it does not create another customer database or activate revenue sharing.

The subsequent [operating-model releases](OPERATING_MODEL_GUIDE.md) add solution briefs, sparse encounter capture, finance-protected partner records and ongoing service reviews. This document remains the overview/handoff guide.

## Employee workflow

1. Open a prospect, sales opportunity, client or client contact. In Relationships & discovery, select **Open relationship overview**.
2. Review the connected people, acquisition source, introducers, sales/account owners, discovery, prospect next actions, appointments and delivery projects. **Open conversations** uses the existing Inbox permission checks. Linked meetings retain their private/team visibility.
3. Choose **Hand off next step**. Enter a clear action, an active teammate, due time and optional context. Times use US Eastern regardless of the device timezone.
4. The handoff appears in **My day → Relationship handoffs** for the sender and recipient; Team shows shared handoffs. It stays **Awaiting acceptance** until the recipient accepts it.
5. The recipient completes accepted work with a factual outcome. The sender, recipient or owner/admin can cancel with a reason. A cancellation does not cancel a calendar appointment or recall a message. Completed/cancelled history remains on the relationship.

Handoffs do not send notifications, reserve time, change sales/project/account ownership, create clients or establish referral payment terms. Multiple actions can be recorded for different opportunities; each keeps its exact source record. Assignment is not acceptance. Inactive assignees need a teammate/administrator to cancel and create a replacement handoff; there is no silent reassignment.

## Data and access

- Migration `0063_relationship_handoffs.sql` adds handoffs and attributable transition events. Existing records and grants are unchanged. Deletion of the linked source record cascades its handoff history, consistent with that record's lifecycle.
- Overview traversal uses canonical CRM links, never inferred identity from matching names or phone numbers. Discovery and introduction history remain visible through conversion. Account manager updates can check the client's current revision.
- Reads require active workspace membership. Viewers can read but cannot change handoffs. Recipient membership is checked before creation; only the assigned current teammate can accept/complete. Cancellation authorization and revisions are checked again inside the transaction.
- One stable request UUID deduplicates repeated/concurrent creation; reuse with different content is rejected. Terminal handoffs cannot be reopened. Stale transitions require a fresh read. Audit events identify the actor without copying message bodies.
- The overview contains no email/SMS/call bodies or private assistant conversations. UI meeting links require the existing owner/team visibility and retention checks. Assistant overview additionally requires `meetings:read` before returning any meeting metadata.
- Lists are bounded: 100 handoffs/discovery notes/introductions, 50 projects/tasks/prospect next actions/bookings and 20 permitted meeting links. These are not unbounded financial or communication exports.

## Assistant coverage

The native assistant and Operations MCP share the same domain services and existing grant/review/receipt pipeline:

- Reads: `get_relationship_overview`, `list_relationship_handoffs`, `get_relationship_handoff`; existing `get_business_discovery` supplies partner choices.
- Changes: `save_business_discovery`, `record_introduction`, `set_account_manager`, `request_relationship_handoff`, `update_relationship_handoff`.

Read-only tokens cannot write. Review-mode connections prepare a proposal; explicitly authorized direct-mode connections can perform permitted internal actions. A new tool does not upgrade a token's scopes or let one employee accept another's work. Review context resolves real record/teammate identities and is rechecked before execution. Discovery and handoff context are team-visible; ask for explicit sharing direction before copying private-source content into them.

The assistant's business guidance now acknowledges Austin's and Jeffrey's development/sales responsibilities, Devon's introduction/appointment-setting focus and Conner's finance/structuring focus. This guidance grants no access or authority over agreements or payouts.

## Verification and deployment

Use a dedicated local PostgreSQL database with no production credentials:

```powershell
$env:TEST_RELATIONSHIPS_DATABASE_URL='postgresql://ta_test@127.0.0.1:55443/ta_relationships_test'
npx vitest run lib/relationships/handoffs.integration.test.ts
$env:ASSISTANT_TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:55443/ta_assistant_test'
npx vitest run lib/assistant/service.integration.test.ts
# Seed only the disposable browser database, then build in an env-free checkout.
$env:TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:55443/ta_reporting_browser_test'
node scripts/seed-reporting-preview.mjs
$env:REPORTING_TEST_DATABASE_URL=$env:TEST_DATABASE_URL
$env:REPORTING_TEST_PORT='3192'
npx playwright test tests/reporting/relationships.spec.ts --config playwright.config.ts
```

Deploy through the existing Render main-branch build, which applies pending website migrations. No Cloudflare Mail deployment, new credentials, provider flag, paid AI request or notification activation is required for this release. Verify the exact deployed commit and authenticated overview/My day after deployment; a successful build alone is not live acceptance. Existing separate Mail/background and device gates remain in `OPERATIONS_ASSISTANT_RELEASE.md`.

For recovery, preserve existing handoff records and events. Correct application code forward; do not roll back the additive schema or replay unknown assistant actions with new identifiers.

Recorded November 10: 40 focused PostgreSQL/Operations cases passed; six desktop/phone journeys plus two dark-mode journeys passed. Browser checks cover creation, Eastern deadlines on a Pacific-time device, recipient acceptance, completion/history, viewer and unauthenticated denial, keyboard-accessible forms, axe checks and horizontal overflow. Desktop/phone screenshots were inspected. The desktop test was corrected to await the relationship URL before entering data into the similarly named prospect form field.

Full website suite: 833 passed, 658 environment-dependent skipped; focused database cases were run separately. Lint, TypeScript, production build, capability inventory and whitespace checks passed. Builds/browser checks used a separate checkout with no production environment files. No real messages, AI charges, account changes or financial activation were performed. Production authenticated acceptance is not claimed here yet.
