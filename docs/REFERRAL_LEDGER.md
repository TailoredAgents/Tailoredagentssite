# Private referral agreements and earnings ledger

November 10, 2026: Austin chose **“Let Conner configure the rules before activation.”** The software is implemented; no real agreement, policy, earning, access grant or payment was created during development. This repository is public: never commit actual commercial rates, private agreements, customer exports or settlement references.

## Owner and Conner checklist

1. After the website release, open **Partners**. Owners/admins already have finance access. If Conner is a member, an owner/admin must open **Finance access**, select his actual account, and grant **Manage agreements and statements**. Do not infer or grant access from a person’s name.
2. Use an existing introducer identity or add the partner. Record introductions on the actual relationship before recording earnings; a campaign owner or shared QR link is not proof of introducer credit.
3. Draft a version with the privately agreed rates, effective dates, revenue basis, eligible documents/services, payment timing, duration, refunds/credits and multiple-introducer rules. The public plan intentionally omits the actual rates; get the protected agreement from Austin.
4. Review the complete version and activate it explicitly. Drafts earn nothing. Overlapping active periods for the same partner are rejected. Retire an old version when replacing it; historical earnings retain the original version and rate calculation.
5. Record an eligible source against the actual client and that partner’s connected introduction. Supply the original source ID, evidence/reference, date, basis, agreed allocation and why it qualifies. Confirm eligibility from the agreement; policy text is not automatically interpreted by AI.
6. Prepare a statement for a date period, inspect every source entry and exact total, mark reviewed, then approve it. These are separate state transitions with current revision/total checks.
7. Only after an external payment or credit settlement actually occurs, record its reference and outcome. No command in this ledger moves money or sends a notification.
8. To let Devon or another teammate view their own partnership, use **Share this partner record**. This grants only that partner’s active/retired agreements and approved/paid statements. It does not grant all finance records, draft earnings, other partners, margins or mail access.

Conner still needs to decide and enter the commercial rules. No sample/test policy is a company default. If a required control is beyond the supported workflow—for example automatic payment-provider reconciliation, a specific multi-person approval requirement, arbitrary split waterfalls or tax treatment—do not claim the text field implements it. Agree and implement that extension before relying on it.

## Supported accounting behavior

- USD only in this first ledger. Rates use integer cents per document or basis points for non-document revenue. Browser inputs accept dollars and percentages with at most two decimal places.
- A source contains **either** eligible document count **or** non-document revenue. The percentage is never applied to document entries. Operators must keep document revenue out of separately entered non-document sources.
- Allocation is an explicit share of that source, at most 100% across introducers. Each partner’s agreement rate is then applied. Integer half-up rounding occurs once per allocated earning; rounding is shown through the stored source facts and amount.
- A stable original source ID identifies one set of facts in the workspace. Reusing it with different client, category, amount/count, date, basis or evidence is rejected. The same partner cannot earn twice from that source, including under another agreement version.
- Request IDs deduplicate retry/concurrent submissions for the same actor and exact input. They do not replace the original-source uniqueness checks across actors.
- Eligibility language, refund policy and payment timing are reviewed by the finance operator. The implementation enforces permissions, active agreement/version, effective dates, source basis, canonical client introduction, bucket separation, amounts and allocation limits. It does not independently verify a payment receipt or infer eligibility from CRM notes.
- Pipeline values, AI estimates, service measurements and introductions are never automatically converted into payables. External accounting/document imports remain a separate authorized integration.

## Corrections, statements and audit

Original earning facts are not edited. A full correcting reversal creates a negative entry tied to the original and cannot be repeated. For a partial refund, reverse the original, then record the evidenced corrected net activity under a distinct correction source ID with a clear link/reference to the original. Do not invent a new source ID merely to evade duplicate checks.

A statement captures up to 1,000 unassigned entries in an inclusive date period. Its item amounts are immutable snapshots. Concurrent statement creation cannot claim the same entry twice. Draft/reviewed statements can be voided with a reason; their snapshots remain, and entries become available for a new statement. Approved/paid statements cannot be rewritten or voided: corrections enter a later statement. Negative balances represent a credit requiring the agreed settlement process, not an automatic debit.

Review/approval and externally completed settlement recording each require the current revision and exact total, with an attributable note. Access checks are repeated in the mutation transaction. Financial audit events retain actor/action/record identifiers without copying private rates or customer message bodies into the general activity feed.

An assistant may prepare drafts and record explicitly authorized finance activity only with both its Operations write scope and the current user’s finance-management access. Partner-only reads never imply write access. Connecting an assistant does not authorize autonomous bookkeeping, payout approval or invented external payments.

## Data lifecycle and limits

Partner names already exist as shared relationship attribution; financial terms and ledger details require finance or bounded partner access. Owners/admins retain finance access through their workspace role even if an explicit finance grant is removed. Revoke their role if that broader authority must change, using existing account controls.

Financial history uses restrictive foreign keys for agreements, sources and statements. If a linked client/introduction is removed through its supported lifecycle, the historical source relationship can become unavailable while the financial evidence remains. This is not a wholesale customer-erasure workflow; review applicable retention needs before introducing permanent financial deletion.

Partner list: first 200. Agreements/statements: latest 100 per partner. Earnings: latest 200. Choice lists: first 500. A statement’s own detail view returns all its captured entries, up to 1,000. For larger finance volumes, add paginated/searchable reconciliation before relying on the dashboard as a complete export.

## Verification and release

Use the dedicated local databases and the env-free browser/build checkout described in [the operating-model plan](RELATIONSHIP_OPERATING_MODEL_PLAN.md). Do not point fixture seeders at production. Coverage includes finance/viewer/cross-workspace denial, explicit grants/revocation, draft/overlap rules, source duplicates, split limits, statement claims/revisions/voiding, immutable history, correcting refunds and bounded partner visibility.

The existing Render website build applies migration `0064`; subsequent operating-model migrations add solution/capture/service tables. Preserve normal database backup/recovery arrangements. A website push does not deploy Cloudflare Mail. Live staff acceptance and real finance configuration are separate from local test success.
