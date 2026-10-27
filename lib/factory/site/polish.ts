/** Trusted layouts shared by generated blueprints; no generated CSS or remote assets. */
export const portablePolishCss=`
.site-header,.hero-inner,.hero-index,.site-footer{width:min(1440px,calc(100% - 96px))}
.section-inner{width:min(1320px,calc(100% - 96px))}
.site-section{padding:76px 0}.section-heading{margin-bottom:34px}
.section-features.section-order-1,.section-faq.section-order-1{background:var(--surface)}
.section-services .section-copy{max-width:62ch}
.service-link{display:inline-flex;align-items:center;justify-content:space-between;gap:20px;margin-top:24px;padding-bottom:6px;border-bottom:1px solid currentColor;font-size:.8rem;font-weight:700;line-height:1.5}
.layout-rows .service-link{grid-column:2;margin-top:12px;justify-self:start}
.layout-showcase .section-items{grid-template-columns:1.15fr 1fr;gap:18px}
.layout-showcase .feature-item{padding:30px;border:1px solid color-mix(in srgb,var(--ink) 15%,transparent)}
.layout-showcase .feature-item:first-child{grid-row:span 2;background:var(--ink);color:var(--background);padding:38px;display:flex;flex-direction:column;justify-content:center;min-height:320px}
.layout-showcase .feature-item:first-child h3{font-size:clamp(1.8rem,3vw,2.8rem);max-width:18ch}
.layout-showcase .feature-item:first-child p,.layout-showcase .feature-item:first-child .item-number{color:var(--background)}
.layout-showcase .feature-item:first-child .service-link{color:var(--background)}
.layout-checklist .section-items{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 32px}
.layout-checklist .feature-item{display:flex;gap:18px;padding:25px 0;border:0;border-top:1px solid color-mix(in srgb,var(--ink) 20%,transparent);background:none;border-radius:0}
.layout-checklist .item-number{display:grid;place-items:center;flex:0 0 30px;height:30px;border-radius:50%;background:var(--accent);color:var(--accent-ink);margin:0;font-size:.95rem}
.layout-checklist .feature-item p{margin-top:10px}
.is-copy-only .section-inner{display:block}.is-copy-only .section-heading{max-width:960px;margin:0}.is-copy-only .section-copy{max-width:76ch}.is-copy-only h2{max-width:26ch}.is-copy-only .section-items{display:none}
.section-contact .section-inner{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:24px 64px;align-items:start}
.section-contact .section-heading{grid-column:1;margin:0}.section-contact .contact-form{grid-column:2;grid-row:1/span 2;background:var(--background);color:var(--ink);border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);padding:28px;border-radius:var(--radius)}
.section-contact.layout-band .contact-form{color:var(--ink)}.section-contact.layout-band .contact-form .form-note{color:var(--muted)}
.page-inner .site-hero{padding-top:30px}.page-inner .hero-inner{display:grid;grid-template-columns:1.4fr .6fr;gap:50px;min-height:0;padding:0;background:none}.page-inner .hero-copy{padding:25px 0 40px;max-width:none;color:var(--ink)}
.page-inner .hero-copy .eyebrow,.page-inner .hero-description{color:var(--muted)}.page-inner h1{font-size:clamp(2.6rem,4.8vw,4.8rem);max-width:22ch;text-shadow:none}.page-inner .hero-description{max-width:65ch}.page-inner .hero-image{position:relative;inset:auto;margin:20px 0;min-height:250px;height:auto;aspect-ratio:1.1;width:100%;border-radius:var(--radius);transform:none}.page-inner .hero-image:after{display:none}.page-inner .hero-index{margin-top:0}.page-inner .text-link{color:var(--ink)}
.page-inner .hero-copy,.page-inner .hero-actions,.page-inner .eyebrow{text-align:left;justify-content:flex-start}.page-inner h1,.page-inner .hero-description{margin-left:0}
.page-breadcrumb{font-size:.76rem;color:var(--muted);margin-bottom:20px;display:flex;gap:12px}.page-breadcrumb a{text-decoration:underline;text-underline-offset:4px}
.footer-navigation{display:grid;gap:8px;font-size:.8rem}.footer-navigation a{text-decoration:underline;text-underline-offset:4px}
.mobile-contact{display:none}
@media(max-width:760px){
  body{padding-bottom:80px}.site-header,.hero-inner,.hero-index,.site-footer,.section-inner{width:calc(100% - 40px)}
  .site-section,.family-wellness .site-section{padding:50px 0}.layout-showcase .section-items,.layout-checklist .section-items{grid-template-columns:1fr}.layout-showcase .feature-item:first-child{grid-row:auto;min-height:260px;padding:28px}.layout-showcase .feature-item{padding:25px}.layout-rows .service-link{grid-column:auto}
  .section-contact .section-inner{display:flex;flex-direction:column;gap:28px}.section-contact .contact-form{padding:22px;width:100%}
  .page-inner .hero-inner{display:flex;flex-direction:column;gap:0}.page-inner .hero-copy{padding:15px 0 25px}.page-inner h1{font-size:2.7rem}.page-inner .hero-image{min-height:210px;max-height:260px;aspect-ratio:1.7;margin:0}.page-inner .hero-index{margin-top:24px}
  .mobile-contact{position:fixed;bottom:0;left:0;right:0;z-index:30;display:flex;gap:10px;padding:10px 16px max(10px,env(safe-area-inset-bottom));background:var(--surface);border-top:1px solid color-mix(in srgb,var(--ink) 18%,transparent);box-shadow:0 -3px 20px #0001}
  .mobile-contact a{flex:1;text-align:center;justify-content:center;min-height:46px;padding:12px 16px}.mobile-contact .mobile-call{background:var(--ink);color:var(--background)}
  .site-footer{display:grid;gap:24px}.site-footer>p{margin:0;text-align:left}
}
`;
