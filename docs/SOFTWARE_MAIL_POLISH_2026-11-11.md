# Mail and account polish — November 11, 2026

Scope: phase 7 of the visual audit (V24–25, V32 and V40–41). Mail list/thread/compose, settings/admin, login/setup, Mail consent/deletion, and Operations consent. Preserve authentication, scope defaults, recipients, draft/send handling, retention and exact confirmations.

The previous dashboard release (1998635) was observed live on Settings: new shortcuts, grouped alert sections and saved-state badges were present. This verifies that surface; it does not certify every dashboard route or deployment outcome.

## Implemented

- Richer slate/light and navy/dark surfaces, clearer active navigation, quieter reading-pane empty state and more readable message rows.
- Visible folder titles and folder-specific empty messages. Filter reset appears only for filtered results and preserves the current folder/label/category.
- One clearly named composer close control, a visible From address even with only one assigned mailbox, accessible CC/BCC expansion, larger mobile inputs and a reachable wrapping footer.
- Consistent settings headings and spacing, visible selected appearance preference, readable connection permission chips and a direct Connected assistants navigation entry.
- Existing team members appear before a native Add a team account disclosure. Form fields align and team actions wrap on narrow screens.
- Account setup shares the Mail sign-in identity. Mail consent and deletion confirmation have clearer hierarchy; permanent deletion uses a distinct red action. Operations consent has a matching branded frame and separated permission/action groups.

No changes to send/save logic, recipient construction, authentication, permission defaults, retention, migrations, provider configuration or spending. Operations read remains the sole preselected requested permission; direct actions remain unchecked. Mail read-only remains the default. No permission grant, password change or deletion was submitted.

## Local visual acceptance

Mail ran in a disposable source copy with synthetic accounts/messages, isolated local D1/R2 and no real provider credentials. Operations consent used an existing isolated local PostgreSQL fixture and a registered synthetic client. No customer message was sent.

| Surface | Observed evidence |
| --- | --- |
| Inbox and empty folders | Populated desktop light inbox; mobile light/dark folder views; unfiltered empty Trash; filtered empty results; Clear filters restored the synthetic Trash message without changing folders |
| Compose | Desktop light and 390px mobile with CC/BCC expanded; From shown with one assigned address; single close control; To initially focused; Escape returned focus to Compose |
| Thread/reply | Long subject wrapping, hidden external-image notice, attachment link and mobile dark Reply All with synthetic To/CC recipients and reachable footer |
| General/appearance | Mobile dark signature/password form and footer; Dark selection persisted across navigation; Match my device and Light visibly selected when clicked |
| Labels/shortcuts | Desktop dark Labels; narrow 320px shortcut help with stacked key/description pairs |
| Team/status/unassigned | Mobile dark team actions; expanded desktop account form after alignment correction; desktop dark status/recovery and empty Unassigned mail |
| Connections/deletion | Populated mobile dark connection with readable scope chips; valid synthetic deletion confirmation with unchanged exact DELETE requirement, not submitted |
| Mail consent/account setup | Valid read-only-default consent at 320px, including keyboard-reachable footer; account setup at 320px without entering credentials |
| Mail sign-in | Desktop light and 390px mobile light; local test account signed out after review |
| Operations consent | Valid synthetic client, desktop and 390px mobile including footer; checked read and unchecked write/send/direct-action controls retained |

The bootstrap owner-creation screen was source-reviewed through its shared auth classes; it was not freshly rendered against another empty database in this pass. Attachment upload/provider delivery, every role/data permutation, native keyboards, safe areas and physical-device behavior remain separate acceptance work. This does not close phase 8 of the original audit.

During the webpack development preview, repeated Fast Refresh requests eventually reached the existing consent GET rate limit. The valid screen and permission defaults were observed before that. The preview was stopped; the production build passed. This pass does not claim a production OAuth transaction or diagnose that development reload loop as a production defect.

Screenshots are retained outside Git in `C:/Users/xenon/AppData/Local/Temp/ta-premium-pass-20261111/mail-evidence/`. Representative files: `inbox-final-desktop-light.png`, `compose-mobile-light.png`, `reply-all-mobile-dark.png`, `team-form-final-desktop-light.png`, `connections-mobile-dark.png`, `delete-confirm-mobile-dark.png`, `operations-consent-mobile.png`, `operations-consent-footer-mobile.png`, `login-mobile-light.png`. The earlier file named `operations-consent-narrow.png` is actually the desktop capture; use the `mobile` file for narrow evidence.

Local theme restored to light, temporary viewport override reset, own tabs closed and preview processes stopped.

## Verification and release boundary

- Mail: 438 tests passed across 59 suites, no failures or skips.
- Mail Svelte checks: zero errors and zero warnings.
- Mail production build and Cloudflare worker wrapper passed.
- Website TypeScript, Oxlint and production Turbopack build passed.
- Diff/whitespace check passed; application files compared with the disposable preview source. Pre-existing `next-env.d.ts` changes excluded.

**Mail is not deployed by pushing the website repository.** `wrangler whoami` reported no authenticated Cloudflare session on this machine. The Mail source is ready for the partner who owns Cloudflare access to release using the existing [Mail deployment instructions](../apps/mail/README.md) and [MCP migration/acceptance runbook](../apps/mail/MCP_SETUP.md), including the previously pending migration 0039 where needed. This visual pass adds no migration. Record the deployed Worker version and repeat the live inbox/compose/settings checks after release. The new Operations consent styling also needs post-deployment visual acceptance.

Next: phase 8, reconcile the full route/state/device matrix against the final release, prioritizing unresolved upload, role and physical-device states. Preserve separate Mail, website and native-app activation gates.
