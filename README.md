# Tailored Agents website

Production-ready marketing website for Tailored Agents, a premium website development, digital growth, business automation, and custom software company. The site is built with Next.js App Router, TypeScript, React, Tailwind CSS, and a small server-side contact handler.

The experience is deliberately presentation-led: custom editorial layouts, original website concepts, synthetic analytics demonstrations, system diagrams, and focused interactive workflow components. It does not use stock photography, client logos, invented results, or generic AI imagery.

## Technology

- Next.js 16.4 with the App Router and Turbopack
- React 19.3 and strict TypeScript
- Tailwind CSS 4 plus a centralized CSS design system
- Lucide React for the small number of functional interface icons
- Vitest for unit tests and Oxlint for source linting
- Resend's HTTPS API for contact delivery; no SDK or database required
- Node.js 22 for local development and Render

Most routes are statically rendered. Only `/api/contact` and `/api/health` run on the server.

## Local development

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The website renders without delivery credentials, but the inquiry form will clearly report that delivery is not configured and will not claim a successful submission.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical public origin, normally `https://tailoredagents.com`. |
| `RESEND_API_KEY` | For contact delivery | Server-only Resend API credential. |
| `CONTACT_FROM_EMAIL` | For contact delivery | A sender on a domain verified by Resend. |
| `CONTACT_TO_EMAIL` | For contact delivery | Authorized business inbox that receives inquiries. |

Never expose `RESEND_API_KEY` through a `NEXT_PUBLIC_` variable. Do not commit `.env.local`.

## Contact handling

The project inquiry and free website review forms share one protected delivery route. The review funnel uses a distinct public `websiteUrl` field while retaining `website` as the hidden honeypot. Both inquiry types apply server-side field validation, a minimum completion time, request-size limits, an in-memory rate limit, a duplicate-content guard, and provider-level idempotency. The application does not write inquiry contents to a database or log them intentionally.

Render may run more than one service instance, so the in-memory abuse controls are per-instance. If traffic or abuse risk grows, replace them with a shared rate-limit service or edge/WAF control. Resend idempotency remains the final duplicate-delivery control.

Before launch, configure a verified sender and recipient. The code intentionally returns `503 DELIVERY_NOT_CONFIGURED` when those values are absent.

## Render deployment

The included `render.yaml` describes one Node web service with a health check at `/api/health`.

1. Create or select the final GitHub repository and push this project only after confirming its URL.
2. In Render, create a Blueprint from that repository and review the proposed service.
3. Set `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, and `CONTACT_TO_EMAIL` as secret environment values.
4. Confirm `NEXT_PUBLIC_SITE_URL=https://tailoredagents.com` before the production build.
5. Deploy and verify `/api/health`, every public route, the inquiry form, response headers, sitemap, robots file, and social image.

The application starts with `next start -H 0.0.0.0`; Next.js reads Render's injected `PORT` automatically.

### Custom domain and HTTPS

After the first Render deployment:

1. Add `tailoredagents.com` and, if desired, `www.tailoredagents.com` under the Render service's custom domains.
2. Apply the exact DNS records Render displays at the authoritative DNS provider. Do not guess records because Render may change the assigned target.
3. Choose one canonical hostname and configure the other to redirect to it. The current metadata uses the apex domain.
4. Wait for Render to issue and activate its managed TLS certificate, then confirm HTTP redirects to HTTPS.
5. Verify that the HSTS, CSP, frame, MIME, referrer, and permissions headers are present over HTTPS.

Do not add a Cloudflare proxy or another CDN until certificate and redirect behavior has been tested end to end.

## Content and asset notes

- StonegateOS capability language was grounded in its public repository and canonical system documents reviewed on October 12, 2026.
- Source presence is not presented as proof that every provider, flag, or protected workflow is active in a particular deployment.
- All interface visuals on this site are labeled conceptual and use synthetic data.
- No customer data or StonegateOS implementation code is included.

## Launch blockers

- Confirm the authorized inquiry recipient and a Resend-verified sender.
- Add an authorized privacy/legal contact address and confirm governing-law language if counsel requires it.
- Run browser-based responsive and accessibility QA. The implementation session did not have a connected browser surface, so screenshots and Lighthouse scores are not claimed.
- Review public pricing, service scope, all copy, and the StonegateOS case study with the business owner before publication.

See [the launch checklist](docs/LAUNCH_CHECKLIST.md) for the final production gate.
