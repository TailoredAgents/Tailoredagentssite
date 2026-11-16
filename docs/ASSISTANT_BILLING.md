# Assistant billing proposals

November 15, 2026. This release implements the local proposal step of the billing rollout. Stripe connection remains Jeffrey’s final activation step.

Finance-authorized employees can ask the assistant to prepare a customer invoice with an exact client, billing email, USD amounts in integer cents, classified lines, covered recurring service dates, due date and notes. Unknown commercial terms must be clarified, not invented. The new `draft_customer_invoice` tool always creates an Assistant approval request, including on direct-action connections.

The approval contains the server-resolved customer identity, any previous invoice version/revision, exact line items and total, recipient and due date. It explicitly states that collection is disabled. Approving saves a new **draft** in Finance. It does not create a Stripe invoice, send a customer message, authorize a recurring schedule, sign an agreement, mark the draft financially reviewed, charge money or post commissions. Those remain separate decisions and capabilities.

Revisions require both the latest document ID and its current revision. Source changes invalidate the pending proposal; the save also rechecks the revision and latest version under the existing document lock. Current finance-management access is required both during preparation and execution. The standard Assistant approval ownership, expiry, scope, exact-content hash and stale-context checks apply. Request IDs preserve exact retry behavior; changed content needs a new request.

`ASSISTANT_BILLING_DRAFTS_ENABLED=false` pauses assistant preparation/saving without disabling the manual Finance workspace. Default is true because this is a human-reviewed local draft feature, not provider billing activation. No migration or Stripe credential is required.

Additional read tools expose the existing permissioned recurring records: `list_recurring_commissions`, `get_recurring_commission` and `get_recurring_statement`. They inherit finance/recipient authorization and bounded source views. Statements are recorded accounting evidence, not proof that this assistant sent money. No approval, posting, grant, refund or settlement mutation tool is added.

## Verification and remaining work

Local commercial integration cases cover finance revocation, tenant boundaries, precise totals, invalid line periods, pinned revisions, newer versions, pause behavior and concurrent replay. OAuth/action cases cover mandatory human review despite direct mode, wrong approval hashes, stale customer identity and single-save replay. Production build and lint are also checked. No live AI request, invoice, payment or customer notification is used for these checks.

Next implementation stages remain permissioned provider draft creation, separately reviewed issue/send/subscription capabilities, documented credit/dispute/lifecycle/settlement exceptions and the provider-backed acceptance script. Provider writes must stay disabled until their exact approval contracts and sandbox acceptance exist. See [Jeffrey’s handoff](JEFFREY_STRIPE_SETUP.md), [billing reconciliation](BILLING_RECONCILIATION.md) and [recurring commissions](RECURRING_COMMISSIONS.md).

Local release evidence: 27 commercial integration cases and 42 Assistant OAuth/execution/security cases passed (69 total), including seven new invoice-proposal scenarios. The production build, TypeScript checks within that build, lint and whitespace checks passed. These are isolated local checks; production deployment, paid assistant quality and Stripe sandbox/live acceptance are not claimed.
