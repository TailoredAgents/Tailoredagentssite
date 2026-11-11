# Assistant workspace

Updated November 10, 2026.

## Layout and behavior

- **Chat** is the default: searchable personal conversation history, starter prompts, readable responses, and a composer anchored below the conversation.
- **My work** puts exact approval requests first, followed by assignments, notifications, private goals, and recurring work. Assignment filters separate work needing attention from completed work; older notifications expand on request.
- **Files** provides the existing private document library, generated results, and the Company knowledge link. Selected files carry back into Chat.
- **Activity** contains action receipts and a collapsed technical access log.
- **Settings** contains access, allowance, notifications, private memory, and connection controls.

Switching sections preserves the current chat draft, selected files, and conversation. Switching conversations starts a separate draft. The URL records the selected section and conversation; browser Back works between sections. Existing action links open the appropriate review or activity section. Form submissions stay in their relevant section.

Desktop history can collapse. Mobile history uses a dismissible dialog; the Phone launcher moves away from the chat composer. Tabs support arrow keys, Home, and End. Ctrl/Cmd+Enter submits the composer. Starter cards only fill a draft.

Assistant replies render a small safe Markdown subset: paragraphs, headings, lists, bold, code, and HTTPS or internal dashboard links. Raw HTML is escaped; incomplete Markdown markers cannot stall rendering.

## Later model/settings release

The subsequent `99166c8` release moves spending controls into Settings → Models & usage, removes the new-message dollar selector and cost receipts from the composer, and adds adaptive Sol reasoning with bounded Astra escalation. Austin explicitly selected uncapped company spending after deployment. The unchanged-limits statement below applies to this earlier UI-only release; see [current model policy](ASSISTANT_MODEL_POLICY.md) and [release evidence](OPERATIONS_ASSISTANT_RELEASE.md).

## Scope

This redesign preserves the existing APIs, grants, exact approvals, account boundaries, cost limits, file processing, and sending behavior. It does not grant access, raise allowances, enable messaging, or send communications. Pending-review queries remain scoped to the signed-in user and workspace and are separate from paginated history.

The production build exposed a native document-parser dependency that Turbopack tried to bundle. `@napi-rs/canvas` now uses Next.js `serverExternalPackages`, alongside Twilio. Existing output tracing still includes the document worker and native dependencies.

## Verification

Verified in an isolated local checkout with disposable PostgreSQL data and the synthetic OpenAI provider. No live AI charges, emails, SMS, or calls were used.

- `npm run lint` and `npm run typecheck` passed.
- `npm run build` passed, including the separately committed document and Company knowledge features from `9fb910d`.
- Fourteen browser scenarios passed across desktop and phone: OAuth consent/control (eight), native chat and document workflows (four), and workspace navigation/accessibility/safe formatting (two).
- The workspace tests cover draft preservation, Back navigation, keyboard tabs, mobile dialog focus, no horizontal overflow, safe links/HTML, and axe WCAG A/AA checks on the chat workspace.
- Manual browser review covered Chat, My work, Files, Activity, and Settings, including the mobile composer. Temporary viewport overrides were reset.

Run the focused suites with an isolated local reporting test database using `npm run test:assistant:browser` and `npm run test:assistant-chat:browser`. Their provider fixtures intentionally refuse production mode. Build success is not a live deployment or a test of real provider delivery.

No database migration or environment-variable change is introduced by this UI release. Existing document/knowledge migrations remain the responsibility of those feature releases. Deploy through the repository's normal web-service release process, then verify the five workspace sections in an authenticated live account.
