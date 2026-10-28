# Hosted Website Builder performance lab

October 28, 2026. This is a read-only measurement tool for already-published static previews. It adds reproducible hosted observations to the artifact byte budgets and unthrottled browser checks described in the [quality plan](WEBSITE_BUILDER_QUALITY_PLAN.md). It does not change publication gates, generate sites, run paid providers, submit forms or alter existing previews.

## Run it

From the repository root:

```powershell
node --import tsx scripts/measure-factory-hosted-performance.ts
```

The default measures the public Cosmo v9 branded Home shortlink, Services and Contact. Each route receives three independent cold/warm pairs. Results are written to a new timestamped directory under the operating system's temporary directory; the command prints its absolute location. `report.json` retains individual observations and `report.md` presents route/cache medians. These local public-site reports are not committed to the repository.

For another explicitly authorized published preview:

```powershell
node --import tsx scripts/measure-factory-hosted-performance.ts --url https://tailored-agents-site-previews.onrender.com/p/approved-preview/ --runs 3 --output C:\Users\xenon\AppData\Local\Temp\preview-performance-example
```

Repeat `--url` for up to six routes. `--preview-origin` permits an additional public HTTPS preview origin; the URL must still identify a `/p/` page. Private IPs, local/internal origins, credentials, query strings, fragments, CRM dashboard/API paths and arbitrary resource URLs are rejected. The only allowed CRM route is the branded `/preview/<slug>` shortlink. Output directories must be new, so a repeated invocation cannot overwrite an earlier report. Use `--help` for the bounded options.

## Fixed measurement profile

| Setting | Value |
| --- | --- |
| Browser | Existing Playwright Chromium, headless; exact package, browser, protocol and JavaScript versions recorded |
| Viewport | 390 × 844 CSS pixels, device scale factor 2, mobile/touch enabled |
| CPU | 4× slowdown relative to the recorded execution host |
| Network | 150 ms minimum request-to-response-header latency; 200,000 bytes/s download and 93,750 bytes/s upload (1.6 Mbps / 750 Kbps) |
| Cache | Cold: fresh isolated context and cleared browser HTTP cache. Warm: new page in that same context, with HTTP cache retained and enabled |
| Navigation | Real public navigation and redirects; wait for the load event, then observe another 5 seconds |
| Repetitions | Three cold/warm pairs by default; configurable between three and seven |
| Interaction | No scrolling, clicking or form submission; service workers blocked and bypassed |
| Request scope | CDP permits preview paths and the branded shortlink; other network paths are blocked and reported as failures |

This is a named custom profile, not a calibrated physical Pixel, a Lighthouse preset or an estimate of every customer's connection. Chromium's CPU factor is relative to the host CPU. The runner records CPU model, OS, architecture, memory and tool/source versions so later comparisons can explain environmental changes.

The implementation uses [Playwright CDP sessions](https://playwright.dev/docs/api/class-cdpsession) and the current Chrome protocol's network-rule and navigator-state APIs. The [official Network protocol](https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/Network.pdl) defines throttling units, request events, cache control and URL blocking; [Emulation](https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/Emulation.pdl) defines the CPU slowdown factor. Unsupported protocol commands fail explicitly rather than silently running an unthrottled test.

The runner intentionally avoids Playwright request routing: [routing disables HTTP cache](https://playwright.dev/docs/api/class-browsercontext#browser-context-route), which would make a warm-cache comparison misleading. A local HTTP fixture verifies actual CSS cache reuse under the chosen instrumentation.

## What the report means

- **LCP** is the browser's latest largest-contentful-paint observation during the initial viewport measurement. FCP, navigation TTFB, DOMContentLoaded, load time and the exact observation duration are retained alongside it. The [LCP definition](https://web.dev/articles/lcp) explains why load-event timing alone does not describe when meaningful content becomes visible.
- **Observed CLS** uses the largest eligible layout-shift session window, with gaps under one second and a maximum five-second span, excluding recent user input. This follows the [CLS definition](https://web.dev/articles/cls), but this short lab visit cannot measure later, lifetime layout shifts.
- **Received bytes** come from CDP request-completion events plus redirect responses. They describe the initial viewport's observed network traffic, including transfers that failed. Separate browser Resource Timing body/transfer totals and per-resource cache/status data are preserved. Lazy resources below the fold may not load; this figure must not be substituted for the existing 800 KB full-page artifact budget.
- **Warm** means cache is available, not that responses were cacheable. Actual cache-hit counts and response cache policies are recorded. A `no-store` preview can legitimately show zero warm-cache hits.
- **Median** is emitted only when every expected repetition in that route/cache group is valid and its main-document hash is stable. Missing, failed, hidden-page, unavailable-observer or changed-document runs remain visible and withhold the aggregate; there is no survivor-only median.

The engineering investigation targets remain lab LCP ≤2.5 seconds and observed CLS ≤0.1. The report does not claim field p75 Core Web Vitals, an INP value, a Lighthouse performance score, conversion impact or consistently excellent generated design. No Lighthouse score is fabricated from these measurements; the quality plan's separate Lighthouse target remains open.

Browser HTTP cache is the only cache the runner resets. Operating-system DNS, upstream CDN state and server warmness are not controlled. The real shortlink follows cross-origin redirects; browser Navigation Timing can hide parts of that redirect history, so the CDP redirect chain is retained separately. Different routes are reported separately rather than averaged into one flattering site number.

## Provenance and verification

Every report records measurement version, timestamps, current Git revision/dirty state, SHA-256 of the measurement source files, exact tool/browser/host settings and each received main-document hash. It stores public request URLs and timings, but no page HTML, screenshots, cookies, browser login state or customer contact contents. Keep reports local and review their contents before deliberately sharing them.

Focused tests cover URL restrictions, median/failure integrity, CLS window boundaries, actual cold/warm cache behavior, blocked-resource detection and initialization through the real `node --import tsx` command. The CLI-level test matters: a first development attempt exposed a transpiler helper in a serialized observer callback. Those observations were explicitly invalid, produced no medians and were excluded from the baseline. The observer now uses explicit browser JavaScript, and the regression test runs it in the actual CLI toolchain.

The next acceptance step is to measure separately human-approved fresh builds across multiple industries and compare their individual worst routes. A measurement of manually revised Cosmo v9 is diagnostic baseline evidence, not an unattended generation success.

## Observed public baseline

Measured October 28, 2026, **16:02:33–16:04:37 UTC**, using the default profile and three cold/warm pairs per route. Seventeen of eighteen observations were valid. All values below are three-run medians; the failed group is deliberately unavailable. KB means 1,000 received bytes.

| Public Cosmo v9 route | Cache | Valid | LCP | Observed CLS | TTFB | Load event | Received KB |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Home, through branded shortlink | Cold | 3/3 | 1,124 ms | 0.0199 | 410 ms | 1,719 ms | 153.4 |
| Home, through branded shortlink | Warm | 3/3 | 952 ms | 0.0199 | 298 ms | 1,520 ms | 153.6 |
| Services | Cold | 2/3 | Unavailable | Unavailable | Unavailable | Unavailable | Unavailable |
| Services | Warm | 3/3 | 616 ms | 0 | 139 ms | 963 ms | 53.8 |
| Contact | Cold | 3/3 | 620 ms | 0 | 154 ms | 956 ms | 52.3 |
| Contact | Warm | 3/3 | 652 ms | 0 | 128 ms | 1,011 ms | 53.0 |

The successful visits painted quickly and showed little initial layout movement under this profile. That is encouraging speed evidence, not a full reliability pass: Services cold repetition 2 returned the correct HTML (HTTP 200, same document hash) but its stylesheet request ended with `net::ERR_ABORTED` after approximately 10.1 seconds, without an HTTP status or received stylesheet bytes. Its H1 painted at 10.4 seconds without the stylesheet. The report retains the failed visit and exits with status 1. The live markup uses one ordinary stylesheet link, so no duplicate preload cancellation was observed; this evidence alone does not identify the hosting, transport or browser cause.

Every valid visit recorded zero browser-cache hits. The public preview's HTML, stylesheet and runtime responses used `no-store`; a warm navigation therefore still transferred the assets. This is an observed caching policy, not permission to weaken preview revocation or expiry behavior.

Provenance: Git `82aacb5ceef1d96bbc4d0dbeef450265a84a1a52` with a dirty working tree; Node `22.19.0`; Playwright `1.64.1`; Chromium `156.0.8078.4` (protocol `1.3`); Windows `10.0.26200`, x64, AMD Ryzen 9 9900X, 24 logical CPUs, approximately 66.2 GB RAM. The measurement script SHA-256 was `a06fa24de6ace96f1b7359ec9b951e0d8cc5cc3769356ddd13153d7b2ac4b797`; helper SHA-256 was `ae019d6722e9978ded38c111b50c6a443fc65a79ed3dd40b18bb809a62c66909`. Exact response hashes, resource timings, settings and failures remain in the local `ta-factory-hosted-performance-2026-10-28T16-02-33-915Z` temporary report directory. No raw business report is checked in.

A separate Services-only confirmation at **16:09:10–16:09:49 UTC**, after concurrent repository build/tests finished, used identical measurement sources and settings. All six visits were valid: cold LCP 668/812/704 ms (median **704 ms**, CLS 0.0013, TTFB 186 ms, load 1,242 ms, 53.1 KB); warm LCP 628/608/640 ms (median **628 ms**, CLS 0, TTFB 159 ms, load 973 ms, 53.8 KB). The document hash remained unchanged, with no cache hits. The stylesheet failure did not recur, but its cause remains unconfirmed; this separate result does not replace the original incomplete baseline. Its raw report remains in temporary directory `ta-factory-hosted-performance-2026-10-28T16-09-10-191Z`.
