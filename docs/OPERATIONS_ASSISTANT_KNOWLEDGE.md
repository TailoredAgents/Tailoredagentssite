# Company knowledge

Employees can open **Assistant → Files → Company knowledge**, or ask chat to find published guidance or prepare a private draft from accessible documents. This is separate from private memory and saved chat history. No private chat is published automatically.

## Publishing and corrections

An active employee with write access creates a private draft, supplies its provenance, effective date and review date, then reviews and explicitly publishes the exact version. Publishing selects all employees in this workspace or named current employees. The author alone can publish, correct, withdraw or delete their series; this first release does not grant administrators access to another employee's private drafts.

Document sources cite immutable content hashes and specific extracted sections. Every source and ancestor must already cover the proposed audience. Publication never changes source sharing automatically. Files derived from another knowledge entry cannot be republished as independent source evidence. Human-confirmed guidance without a file must still explain who confirmed it and where it came from.

Corrections create a new numbered version. Publishing it supersedes the previous published version; an older unpublished draft cannot replace a newer published version. Historical versions remain visible to their author but are excluded from assistant company-knowledge retrieval. A source sharing change conservatively withdraws published entries citing it; review the audience and create a corrected version before republishing.

The assistant receives current accessible published versions, real links, review dates and an overlapping-topic warning. Past-due guidance remains visible with a review warning; the assistant is instructed to seek confirmation before treating it as current policy or pricing. Multiple published series with the same normalized topic are flagged for comparison. This detects overlapping topics, not every possible semantic contradiction. Facts that are absent remain unknown.

## Retention and withdrawal

Published entries and their explicit source files are retained until withdrawn/deleted. Source files still count toward the existing file quota. Withdrawal releases source retention: their original 90-day expiry applies again. No additional storage service or AI retrieval charge is introduced. Knowledge text is stored in the existing permissioned PostgreSQL database with indexed text search; there is no external vector store.

Source deletion removes extracted chunks and the copied text of all citing knowledge versions, including drafts and historical versions. Withdrawing or correcting guidance interrupts active assignments using it, cancels their pending review actions, resolves obsolete alerts, and deletes generated files derived from that guidance. Downloads and reads recheck membership and source access. Provider requests already issued retain their receipts and costs; withdrawal does not claim to reverse an external send.

Deleting a knowledge series clears every version's text, provenance and source references, retaining empty audit records. Text already emitted into a past chat, sent externally or downloaded is retained separately. Private preference corrections refresh the model's notes; a saved response generated before a correction is discarded before its tool action executes, while preserving its paid receipt and total assignment limit.

## Bounds and configuration

- Maximum 12,000 characters of guidance, 10 document-section references and 30 named recipients per version.
- Maximum 1,000 saved versions per workspace, including empty audit records. An administrator must review retention before increasing this limit.
- Indexed search returns up to 50 matches in the UI and 15 metadata matches per chat search; refine the query for older entries. Read a full source before relying on it.
- Migration: `0059_assistant_knowledge.sql`.
- `ASSISTANT_KNOWLEDGE_ENABLED=false` temporarily disables the knowledge API/tools. It does not delete saved guidance or release published source retention.
- Deterministic search, publication and correction make no AI request. Chat reasoning and file generation remain under the existing assignment and shared $25 allowance.

## Verification

Local isolated checks cover private drafts, explicit publication, role/workspace isolation, audience/source checks, immutable citations, source retention, source withdrawal/deletion, stale/overlapping topics, correction ordering, cached work invalidation, generated-result deletion and the absence of extra AI charges. Chat integration includes a corrected preference invalidating a cached tool response. All 58 focused knowledge/document/chat checks passed. Desktop/phone publication, correction and withdrawal passed; the phone layout was visually inspected. The isolated full suite passed 823 tests with 612 environment-dependent skips. Production build, typecheck, lint and capability inventory passed. These checks use synthetic employees; they are not a claim of production rollout or physical iPhone acceptance.
