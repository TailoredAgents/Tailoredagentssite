# Tailored Agents logo

The October 23, 2026 logo supplied by Austin replaces the former CSS letter mark on the website, sign-in page, and CRM navigation.

- Shared component: `components/brand-logo.tsx`.
- Transparent master for the site: `public/brand/tailored-agents-logo.png` (1008 × 333).
- Browser icon: `app/icon.png`; phone home-screen icon: `app/apple-icon.png`. Both use the new emblem with a light background for legibility.
- Social previews use the full logo; Organization structured data references the public asset.
- Dark surfaces use a white rendering of the same artwork. The separate Mail application is not part of this website asset change.

## Asset preparation

Source: Austin's `ChatGPT Image Oct 23, 2026, 02_47_48 PM.png`. The built-in imagegen tool prepared the transparent artwork; Sharp trimmed transparent margins and produced web-sized derivatives. No additional dependency was added.

Preparation prompt:

> Use case: background-extraction. Edit target: the provided Tailored Agents logo. Remove only the white background and excessive empty margins. Output a tightly framed wide horizontal transparent PNG of this exact logo with a small consistent transparent margin. Preserve the exact blue gradient TA emblem, exact geometry, letterforms, two-line text 'Tailored' bold above 'Agents' thin, navy text color, spacing and relative proportions. Do not redesign, add anything, or change the logo. True alpha transparency, no white/checkerboard baked in.

The generated dark variant was discarded; CSS reverses the shared master instead, keeping the same geometry in both treatments.
