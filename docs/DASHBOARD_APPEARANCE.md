# Dashboard appearance

October 22, 2026. This release applies the owner's selected **Slate & blue** direction to the private CRM and adds **Midnight blue** with a saved **Light / Dark / System** preference. It follows the earlier [22-page layout and organization pass](DASHBOARD_DESIGN_AUDIT.md).

## Using it

Choose **Appearance** in the sidebar, or open **Settings → Appearance**. On a phone, the sidebar control is inside **Menu**. Light is the initial default. System follows the device's light/dark preference, including changes made while the dashboard is open. Explicit Light or Dark overrides that device setting.

The preference is saved in this browser for one year and applied during server rendering. It does not change the team's accounts or records. The native fields, dropdown menus, date controls, scrollbars and voicemail player follow the active color scheme. The current navigation item stays visible inside the scrolling desktop sidebar.

## Palette and scope

| Role | Light · Slate & blue | Dark · Midnight blue |
| --- | --- | --- |
| Main canvas | `#E2E8F0` | `#111827` |
| Panels, cards, dialogs | `#EDF2F7` | `#1B2638` |
| Secondary surfaces | `#DCE5EF` | `#243247` |
| Form fields | `#F5F7FA` | `#243247` |
| Main text | `#172334` | `#E4EBF5` |
| Supporting text | `#4E6078` | `#A8B6CB` |
| Primary action/link | `#2D5BD1` | `#7FA6FF` |
| Selected surface | `#D6E3FA` | `#243957` |
| Sidebar | `#142031` | `#0E1624` |

The custom palette follows the neutral/brand-role approach described by [Radix](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette) and [Atlassian](https://atlassian.design/foundations/color/). The specific shades are Tailored Agents design choices. Success, warning, error and mockup states each have paired foreground/surface colors in both themes; status meaning still has a text label. Chart lines and legends share the same theme-aware series colors.

Shared semantic tokens in `app/dashboard/theme.css` now supply the operations, sales, analytics, Inbox, email, SMS and phone styles. Existing layouts and business actions are retained. Creation drawers, the page finder, expanded Settings controls, composers, notes and protected voicemail playback use the same palette. The public marketing presentation and separately deployed Mail application retain their own appearance.

## Review

Open the [desktop/phone appearance gallery](previews/themes/index.html). Every one of the 22 page/view templates has a capture in each theme on desktop and phone. The gallery also links populated synthetic provider states. The previous white-background audit images remain preserved under `previews/design/`.

All screenshots and provider acceptance tests here use disposable local accounts and synthetic records. They do not demonstrate live email/SMS delivery or real audio acceptance.

## Implementation and reproduction

The theme provider wraps the existing persistent phone provider. Switching appearance changes styling without replacing form/composer state or the active call. The validated `ta-dashboard-theme` cookie carries only `light`, `dark` or `system`; unsupported values fall back to Light. It is host-only, uses SameSite=Lax, and is Secure on HTTPS. The browser writes it on an explicit preference change; the dashboard reads it through Next's asynchronous `cookies()` API. CSS handles System mode without a startup script or hydration-dependent palette change.

The palette uses the native [`light-dark()` CSS color function](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark), available across current browsers since May 2024. Current Chromium and the iPhone browser profile are covered by the checks below; physical-device/assistive-technology checks remain useful follow-up evidence.

```powershell
$env:TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:55433/ta_reporting_browser_test'
node scripts/seed-design-preview.mjs
npm run build
$env:DASHBOARD_TEST_THEME='light'
npm run test:design:browser -- --output=test-results/theme-light
$env:DASHBOARD_TEST_THEME='dark'
npm run test:design:browser -- --output=test-results/theme-dark
node scripts/theme-gallery.mjs
```

The seed resets only the guarded disposable database. Browser configs accept the same optional `DASHBOARD_TEST_THEME` to verify provider workflows and save their themed previews separately. Provider suites share `.next/dev` and run sequentially; isolated production-build checks use separate Playwright output directories. No dependency or database-schema changes are required.

## Verification

| Check | Result |
| --- | --- |
| Strict TypeScript, lint, production build | Passed |
| Website code/PostgreSQL tests | 327 passed in 34 files |
| Existing CRM/reporting workflows in Dark | 33 passed; one existing duplicate phone viewport sweep skipped |
| Unified Inbox / SMS / email / calling in Dark | 16 / 14 / 10 / 18 passed |
| Design and preference suite | 18 passed in Light and 18 in Dark |
| Page coverage | All 22 templates × desktop/phone × Light/Dark: 88 captures with no automated WCAG A/AA violations or page-level horizontal overflow |
| Additional populated Light checks | 4 combined-Inbox/draft, 4 SMS/settings, 2 email and 4 calling/voicemail checks passed |
| Saved preference behavior | Server-rendered cookie choice, reload/navigation, System changes, explicit override, malformed-value fallback and pre-JavaScript Dark rendering passed |
| State preservation | Unsaved page input, email drafts, active-call connection and mute state survived appearance changes |
| Public presentation | Navigating from a Dark dashboard back to the marketing site removed private theming and restored its original canvas |

Focused rechecks also passed after the final surface and phone-helper refinements. The review corrected a dark selected-label contrast shortfall, retained the chart/legend pairing, and kept neutral relationship panels separate from semantic success backgrounds. Keyboard focus on the dark sidebar has its own high-contrast indicator. Mobile appearance fields use 16px text.

Local tests verify source behavior with synthetic data and provider transports. They do not activate the owner's Twilio account or Jeffrey's separately deployed Mail service.
