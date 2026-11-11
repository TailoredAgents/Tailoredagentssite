# Employee assistant release and remaining activation

November 10, 2026. Recommendations 1–5 are implemented in the repository and locally verified. Production activation is partial: independent sign-out-surviving access and enhanced email require the separately deployed Mail service. Native push requires Apple enrollment/signing/device acceptance. Do not mark those gates complete based on the website deploy.

## Shipped code

| Area | Commit | Evidence and current limit |
| --- | --- | --- |
| Work feed and opted-in employee SMS | `a0d779d` | Private feed, verified number, quiet hours, capped/coalesced alerts, signed provider receipts; real employee receipt pending |
| Background delegation | `967e84b` | Explicit scoped 30-day authority, revocation and Mail authentication; website flag stays off pending partner's Mail release |
| Durable assignments | `2cb6b61`, `8a31ca0` | Saved plans/checkpoints, input and exact review, pause/resume/stop, assignment ceilings within shared allowance |
| iPhone push preparation | `714274e` | Server/device binding, token rotation and SMS fallback tests; new Swift has not been built/tested on macOS or a signed device |
| Documents | `cbd33f8` | Bounded uploads, private extraction, citations, downloadable PDF/DOCX/CSV/XLSX; source access/deletion invalidation |
| Company knowledge | `9fb910d` | Versioned drafts, deliberate publication, permissioned retrieval, correction/withdrawal |
| Proactive work | `99a8502` | Opt-in templates, current-source checks, quiet notifications, deduplicated bounded runs |
| Chat communication | `768a08b` | Reply/reply-all, generated attachments, edit/reapproval, receipt checks, short editable voice dictation |

The collaborator's `ac9a8c3` workspace redesign is preserved. The company allowance remains $25/month, separate from Website Builder and SMS/call charges. External applications and custom client system/workflow programming remain deferred.

## Live observations

- Render web service `srv-db6hod8473hc739q2uo0` was observed live at `99a850270cb334cbfb45fc16747c92e218c3e998` during the initial audit. Website migrations through 0060 were installed; the document routine-source column was present.
- The production database contained a $25 allowance, no assistant usage rows, no assignments and no routines at that audit. No customer content or secret values were read for the audit.
- OpenAI, CRM Mail, Twilio and shared cron credentials were present. Twilio SMS was enabled. Independent background and APNs flags were unset, meaning those features were not activated. Ordinary notification SMS remained available only after each employee's own phone verification and opt-in.
- Render cron `crn-dbaggnjncjis73dgadhg` was at `99a8502`, scheduled every five minutes. Its scheduled 7:25 PM Eastern run succeeded. It invokes the shared reporting route that advances assistant work; that success alone did not previously prove the assistant subworker succeeded. This release adds explicit assistant log counts and propagates assistant failure to the scheduled job's outcome.
- Austin's live Assistant settings loaded with the shared allowance, existing reviewed access, employee phone verification and the explicit notice that native push is not activated. No preferences, permissions or real messages were changed during this check.
- After the communication push, the live website displayed **Voice note** in Chat. Public health returned HTTP 200; the new private dictation and review routes returned HTTP 401 with `private, no-store` without authentication. These are deployment/authentication smoke checks, not paid-provider or Mail delivery acceptance.
- The connected Operations plugin requested reauthentication. Cloudflare CLI and browser were signed out; Austin confirmed only his partner has the login. No Cloudflare release/version or real provider delivery is claimed.

## Partner handoff: Mail

From a clean checkout of current `main`, with the partner's existing Cloudflare account that owns `tailored-mail-production`:

```sh
git pull --ff-only origin main
cd apps/mail
npm ci
npx wrangler login
npx wrangler whoami
npx wrangler d1 migrations list DB --env production --remote
npx wrangler d1 migrations apply DB --env production --remote
npm run check
npm test
npm run deploy:production
```

Confirm the selected account owns the existing production Worker/database before applying migrations. Migration `0039_assistant_background_grants.sql` is additive. Preserve all existing secrets, domains, mailbox grants and sender configuration. Record the resulting Worker version and UTC deployment time. A successful Git push does not deploy this separate Mail Worker.

After the Mail release, verify version-2 compose capabilities using an authenticated permitted mailbox, then a designated employee-to-employee reply-all with a generated file and exact approval. Verify visible recipients, reply headers, file hash and provider receipt; an uncertain outcome must be checked without resending. Do not use a customer as a test destination.

Then enable `ASSISTANT_BACKGROUND_ENABLED=true` on the Render website. Each employee selects their own capabilities and explicitly authorizes 30-day background access. Verify a bounded assignment after sign-out, then pause/revoke and confirm further reads/actions stop. The server flag alone does not opt anyone in.

## Employee rollout

1. Open Dashboard → Assistant → Settings. Confirm reviewed/direct mode and choose only needed capabilities. The allowance is shared, not $25 per employee.
2. Verify the employee's own mobile number and explicitly opt into attention/review alerts; completion texts are optional. Check a designated employee alert, its authenticated deep link, delivery receipt, quiet hours and STOP behavior. No live SMS acceptance test has been performed in this release.
3. In Chat, upload a private source, ask for a cited brief and download it. In Files, deliberately publish selected guidance only if it should be shared. Confirm another employee cannot see private uploads/chats.
4. In My work, enable only wanted routines with the displayed schedule, scope, per-run/daily limit and notification preference. Templates default paused; no routine was enabled for Austin, Devon or Jeffrey by this release.
5. Review a proposed email inline and test short voice dictation on the actual employee devices. Browser acceptance used synthetic providers and desktop/phone Chromium. Safari/WKWebView microphone behavior still needs physical-device validation.

## Native push gate

The free Apple account remains supported by the normal app build with push disabled. Follow [iPhone push activation](../apps/ios/README.md#optional-assistant-push-not-activated) after paid enrollment: macOS build/policy tests, correct entitlement/APNs environment, signed device receipt and account-bound navigation, sign-out/rotation and fallback checks. SMS remains the practical channel meanwhile. No Apple purchase or automatic enrollment was performed.

## Verification and recovery

Website regression: 826 passed, 638 environment-dependent cases skipped. Separately configured database suites exercised the permission, cost, document, communication, notification and recovery contracts described in the milestone guides. Mail: all 438 tests passed, Svelte check found no errors/warnings and production build passed. Ten desktop/phone journeys passed. The final monitoring correction adds two scheduler cases and verifies uncertain work is reported; all 42 focused chat/scheduler cases pass. Website build, typecheck, lint and capability inventory pass.

Turn off individual feature flags to stop new work. Pause/revoke employee grants rather than deleting receipts. Preserve uncertain model charges/sends and reconcile their existing identifiers; never replay with a new key. Do not roll back applied migrations or force-push shared history. Remaining external activation gates are intentional and must stay visible in the plan.
