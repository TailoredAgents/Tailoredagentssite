# Portable site fonts

The `data.json` file contains unmodified Latin WOFF2 subsets served by Google Fonts, plus their SIL Open Font License texts. Keeping the bytes as a static import avoids a font CDN dependency or filesystem lookup in exported sites and production workers. Exported bundles include only the chosen theme's files and `assets/fonts/licenses.txt`.

Retrieved October 27, 2026:

- DM Sans variable 400–800: https://fonts.gstatic.com/s/dmsans/v17/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K4.woff2
- DM Serif Display regular: https://fonts.gstatic.com/s/dmserifdisplay/v17/-nFnOHM81r4j6k0gjAW3mujVU2B2G_Bx0g.woff2
- DM Serif Display italic: https://fonts.gstatic.com/s/dmserifdisplay/v17/-nFhOHM81r4j6k0gjAW3mujVU2B2G_VB0PD2.woff2
- Manrope variable 400–800: https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2

License sources: https://github.com/google/fonts/tree/main/ofl/dmsans, https://github.com/google/fonts/tree/main/ofl/dmserifdisplay, https://github.com/google/fonts/tree/main/ofl/manrope. Copies are retained here and embedded with the data.

The renderer uses `font-display: swap`, system fallbacks, and no external requests. Characters outside the supplied Latin subset use the browser's fallback fonts. Safety validation accepts only these exact font bytes and matching declarations.

`identity-fonts.json` contains the same DM Sans, DM Serif Display regular and Manrope subsets unpacked to TTF for server-side sharing-card/icon outlines. Fontkit 2.0.4 supports the original WOFF2 glyphs, but its `getVariation()` does not preserve the compressed table directory; unpacking allows approved variable weights to work consistently. These derived fonts retain the same names, glyph outlines and SIL OFL licenses. They are internal renderer inputs, never additional browser font downloads. The generated PNG/JPEG identity assets contain no font dependency.

The deterministic conversion used Python FontTools 4.68.0 and Brotli 1.2.1 decoding, with `TTFont(BytesIO(woff2), recalcTimestamp=False)`, `font.flavor=None`, and `font.save(BytesIO())`. No Python or conversion tools are needed in production. The source WOFF2 files and original license texts remain in `data.json`.
