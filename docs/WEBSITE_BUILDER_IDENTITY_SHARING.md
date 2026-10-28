# Website Builder identity and sharing

Implemented October 27, 2026 (evaluation records use October 28 UTC). This is the P0/P1 and automated P2 slice of the [quality plan](WEBSITE_BUILDER_QUALITY_PLAN.md). Deployment evidence will be appended after release.

## Behavior

New builds derive three PNG icons (32/64-pixel favicon and 180-pixel touch icon) and a 1200-by-630 JPEG sharing card from the approved site identity, palette, bundled font and existing approved imagery. A usable supplied logo keeps its proportions; otherwise the system makes a readable initial mark. Long names are fitted. These are deterministic local assets: no new provider request or subscription.

Every page receives its own title, description and absolute Open Graph page URL, plus the shared branded card and large-image Twitter metadata. Metadata uses the configured preview version URL. Relative icon paths work on inner pages. Identity files are in the immutable checked manifest; image signatures, dimensions, full decoding, byte limits and exact metadata boundaries are validated before publishing. The social card is not preloaded as page imagery. Icons are counted in page delivery budgets.

The salesperson still reviews the plan, approves its exact version and opens/copies the completed link. There is no new icon, card or hosting setup step. Existing published previews are not modified, and saved old bundles remain supported. An explicit new approved build or checked revision uses the new identity path.

## Final verification

Private verification still checks the hosted artifact manifest. Once approved content has passed QA and private verification, the resolver opens a maximum five-minute anonymous check window tied to that exact manifest and active worker lease. Only then does the worker fetch the branded short link with no authentication, cookies or resolver secret. It allows only the expected redirect and checks every HTML page and all four identity assets for HTTP status, MIME, size, exact hash, noindex headers and correct version metadata.

The CRM does not announce READY or expose the new sales link until the fresh public receipt is saved. Failure, replacement/expiry of the lease, paused building, preview revocation/expiry or unavailable lead/workspace closes the temporary window. A failed public check retains the checked pages/images and gives a recovery message; an explicit final-verification retry rechecks saved artifacts without generation charges. A previous ready version remains available. This is bounded verification, not an anonymous bypass for unapproved or unchecked drafts.

Read-only production crawler-policy observation on October 28, 2026 UTC: the preview host root `/robots.txt` returned 404; the main website root allowed `/` and disallowed `/api/`. The existing branded preview link returned 307 with `X-Robots-Tag: noindex, nofollow, noarchive`. Per-page preview metadata and response headers retain index protection. No robots policy was weakened. An absent root robots file does not demonstrate what a particular messaging platform will cache/display.

## Independent exports

The ZIP keeps local icons/cards and removes renderer-owned preview-host URL metadata from portable HTML. `site-identity.json` records only local page/asset bindings. The dependency-free `node build.mjs` uses an explicit `SITE_PUBLIC_URL` such as `https://www.customer.com` or `https://www.customer.com/demo/` to generate the independent page/card URLs.

Without that setting, the site runs with its local assets and omits the absolute sharing URL tags. Changing/removing the setting and rebuilding is reversible. `manifest.json` hashes portable source, `preview-manifest.json` records the checked original preview and `dist-manifest.json` hashes built output. Production exports do not depend on preview expiry or Factory access. Demo forms and noindex defaults remain until deliberate customer launch finishing. Credentials/chatbot/live forms are separate integrations.

## Evidence and limits

- [Frozen cohort and exact provenance](quality/README.md): five original fixtures passed; the expanded ten-case baseline and identity comparison each retained eight passes and two deliberate thin-content findings. Cases cover multiple industries, sparse inputs, long names and approved/missing logos. This is synthetic renderer coverage, not ten real generated websites.
- Identity tests decode real PNG/JPEG bytes, cover long names, supplied logos, escaped titles, all font themes, invalid assets/metadata and legacy behavior. Linux Docker smoke ran with networking disabled and decoded every asset across four font themes.
- Export tests run the standalone build at independent root/subdirectory URLs, unset/changed settings and malformed settings, with manifest, symlink and legacy regression checks.
- Workflow tests exercise READY gating, failed-public-check retry without new charges, no premature notifications, stale receipts, pause/revocation during verification, and ordinary salesperson approval/build/export flow.
- Validation completed before release: full local suite 615 passed (385 environment-gated skipped), dedicated local database build/journey plus public-verification suite 94 passed, then nine focused publication checks passed after the stale-receipt guard. Final identity/export tests passed 19 cases including the additional photo-free helper branch. TypeScript, lint and production build passed. The full-suite skip count is not claimed as tested database coverage; the named local database suites ran separately.
- Human visual appeal ratings remain empty. [Sample synthetic cards](previews/builder-identity/trades-sharing.jpg) demonstrate asset formatting, not a real customer's final image. A newly approved live build and actual phone messaging composer/social-inspector observation are still required. No messages were sent, paid generations run, or customer plans approved on behalf of a salesperson for this release.

Next: P3 design decisions, P4 reliability/performance and P5/P6 independent salesperson/real-build acceptance remain open in the quality plan. Successful fixture tests and an AI score do not establish consistently excellent sales websites.
