# Assistant supporting-page polish — November 11, 2026

Scope: knowledge library, guidance detail/editor, document detail, routines and Assistant notification/access settings (audit V21 and related V15). Preserve publishing confirmations, source versions, audience, expiry, access controls, spending limits and provider state.

Findings: secondary pages lack the main Assistant’s header and spacing; metadata runs together; guidance detail repeats the entire library below the record; routine cards mix schedules, budgets and access; settings overwhelm the first view with long policy/cost text.

Implemented: shared scoped page layout, readable metadata and text columns, deliberate control grouping, concise routine cards and saved notification summaries. All local checks and screenshots use synthetic data. No real messages, publishing, grants or paid AI calls are part of this visual pass.

Release check: the initial live Quick capture check showed the older, ungrouped fields. A final refresh displayed the previous b87d7c1 release's “Conversation context, ownership & introductions” disclosure. This verifies that specific previous-release surface; this Assistant pass has not yet been observed deployed.

Preview note: the production-mode loopback preview correctly rejects its HTTP Assistant origin. Use the existing local development preview for Assistant UI checks; keep the production HTTPS enforcement unchanged. A standalone production build remains a separate check. The synthetic session-bound grant is reattached to the current synthetic login after the prior viewer test; it has no real credentials or running worker.

## Changes

- Knowledge library has a workspace header, search panel, status/version cards and distinct empty states. A guidance detail no longer repeats the full library below the record.
- Guidance detail separates status, version, audience, topic and review dates from readable guidance and provenance. Editors group related fields and move keyboard focus to their heading when opened.
- Document detail leads with its filename and download action, groups privacy/version/retention facts, and provides a direct link for each source section. Sharing and exact deletion confirmation remain in their disclosure.
- Routines separate account access, schedule, spending ceilings and notification choices. Paused routines label their stored time as paused. Editors group schedule controls and retain all existing validation and activation choices.
- Settings provide section jump links, grouped access controls, a concise usage summary and expandable model/cost details. Notification summaries explicitly show saved choices rather than unsaved form edits.

API requests, publishing/version confirmation, audience and ownership checks, deletion gates, spending policy and provider flags remain unchanged. No schema or server changes. Styles are scoped to these Assistant surfaces.

## Local acceptance

- Visually inspected knowledge library/detail/editor, document detail, routine card/editor, access settings and notifications at 1440 × 1000 light and relevant 390 × 844 dark views. Final routine schedule controls were also inspected at 390 × 844 light.
- Document detail and sharing controls fit a 320px viewport (305px usable content width); inspected phone settings and routines likewise had no document-level horizontal overflow.
- Guidance editor opening focused its heading; cancel returned to the detail. A new synthetic private draft saved successfully, opened its record and showed Draft / Version 1 / Only you, with Publish guidance disabled until its existing confirmation.
- Routine editor opening focused its heading. Changing the title, canceling and reopening restored the original saved title. No routine was enabled or run.
- Document search returned the empty result for an unmatched query and the expected source section for “pilot.” Sharing expanded; Delete document remained disabled without its confirmation. No sharing or deletion was submitted.
- Notification/access/spending controls were inspected without saving new preferences, granting access or sending alerts. Preview theme and viewport overrides were restored and the preview server stopped.

Evidence directory (outside Git): `C:/Users/xenon/AppData/Local/Temp/ta-premium-pass-20261111/assistant-support-evidence/`. Screenshots contain synthetic records. This is browser-responsive acceptance, not physical-device acceptance or accessibility certification. Role enforcement was preserved in source; this pass did not repeat multi-user authorization testing.

## Verification and next work

TypeScript, lint, whitespace checks and the standalone production Turbopack build passed. All seven modified/new application files in the inspected preview matched repository source byte for byte. The existing knowledge browser spec now checks the structured metadata instead of the former combined sentence; its Playwright suite was not run. Functional browser checks above used CUA against the isolated development preview.

Continue with reporting/admin utility surfaces, followed by the separate Mail design/deployment work. Production acceptance of this Assistant release and physical-device checks remain separate from local verification.
