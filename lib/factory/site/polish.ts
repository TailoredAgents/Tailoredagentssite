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
.page-inner .hero-copy .eyebrow,.page-inner .hero-description{color:var(--muted)}.page-inner h1{font-size:clamp(2.6rem,4.8vw,4.8rem);max-width:22ch;text-shadow:none}.page-inner .hero-description{max-width:65ch}.page-inner .hero-image{position:relative;inset:auto;margin:20px 0;min-height:250px;height:auto;aspect-ratio:1.1;width:100%;border-radius:var(--radius);transform:none}.page-inner .hero-image:after{display:none}.page-inner .hero-index{margin-top:0}.page-inner .hero-actions .text-link{color:var(--ink)}
.page-inner .hero-copy,.page-inner .hero-actions,.page-inner .eyebrow{text-align:left;justify-content:flex-start}.page-inner h1,.page-inner .hero-description{margin-left:0}
.page-breadcrumb{font-size:.76rem;color:var(--muted);margin-bottom:20px;display:flex;gap:12px}.page-breadcrumb a{text-decoration:underline;text-underline-offset:4px}
.footer-navigation{display:grid;gap:8px;font-size:.8rem}.footer-navigation a{text-decoration:underline;text-underline-offset:4px}
.mobile-contact{display:none}
.hero-image picture{display:block;position:absolute;inset:0}.story-image picture{display:block}
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

/** Optional v1 tokens do not restyle old blueprints that have no design brief. */
export const portableDesignCss=`
.design-v1{font-family:var(--body-font)}
.design-v1 h1,.design-v1 h2,.design-v1 h3{font-weight:var(--heading-weight);text-wrap:balance}
.design-v1 .hero-copy h1{font-size:var(--heading-size);line-height:1.04;letter-spacing:-.045em;max-width:17ch}
.design-v1 .hero-description,.design-v1 .section-copy{text-wrap:pretty}
.design-v1 .hero-image img,.design-v1 .story-image img{object-position:var(--image-x) var(--image-y)}
.design-v1 .site-section{padding:var(--section-space) 0}
.design-v1 .hero-image,.design-v1 .button{border-radius:var(--radius)}
.design-v1 .preview-notice{background:var(--ink);color:var(--background)}
.design-v1 .feature-item{border-color:color-mix(in srgb,var(--ink) 15%,transparent)}
.design-v1 .eyebrow{font-size:.72rem;letter-spacing:.13em}.design-v1 .hero-description{font-size:1.08rem;line-height:1.75}
.design-v1 .feature-item p{font-size:.96rem;line-height:1.75}.design-v1 .section-heading h2{max-width:23ch}
.design-v1 .layout-feature-list .section-inner{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:60px;align-items:start}
.design-v1 .layout-feature-list .section-items{display:block}.design-v1 .layout-feature-list .feature-item{display:flex;gap:24px;padding:28px 0;border:0;border-bottom:1px solid color-mix(in srgb,var(--ink) 18%,transparent);border-radius:0;background:none}
.design-v1 .layout-feature-list .item-number{flex:0 0 30px;margin:4px 0;color:var(--muted)}
.design-v1 .layout-spotlight .section-items{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.design-v1 .layout-spotlight .feature-item:first-child{grid-column:1/-1;display:grid;grid-template-columns:70px minmax(0,1fr);padding:38px;background:var(--ink);color:var(--background)}
.design-v1 .layout-spotlight .feature-item:first-child p,.design-v1 .layout-spotlight .feature-item:first-child .item-number{color:var(--background)}
.design-v1 .layout-spotlight .feature-item:first-child h3{font-size:clamp(1.7rem,2.8vw,2.6rem)}
.design-v1 .layout-comparison .section-items{grid-template-columns:repeat(2,minmax(0,1fr));gap:0;border:1px solid color-mix(in srgb,var(--ink) 20%,transparent);border-radius:var(--radius);overflow:hidden}
.design-v1 .layout-comparison .feature-item{border:0;border-radius:0;padding:34px}.design-v1 .layout-comparison .feature-item:nth-child(even){border-left:1px solid color-mix(in srgb,var(--ink) 20%,transparent);background:var(--background)}
.design-v1.composition-framed .hero-inner{padding:40px;background:var(--surface);border:1px solid color-mix(in srgb,var(--ink) 14%,transparent);border-top:6px solid var(--accent-secondary);border-radius:var(--radius);gap:40px}
.design-v1.composition-framed .hero-copy{padding:10px 0}.design-v1.composition-framed .hero-image{min-height:440px}.design-v1.composition-framed .site-hero{padding-top:36px}
.design-v1 .site-section[class*="tone-"]{background:var(--section-background);color:var(--section-ink)}
.design-v1 .site-section[class*="tone-"] .eyebrow,.design-v1 .site-section[class*="tone-"] .section-copy,.design-v1 .site-section[class*="tone-"] .faq-list details p{color:var(--section-muted)}
.design-v1 .site-section[class*="tone-"] .feature-item{background:var(--section-surface);color:var(--section-ink);border-color:color-mix(in srgb,var(--section-ink) 20%,transparent)}
.design-v1 .site-section[class*="tone-"] .feature-item p,.design-v1 .site-section[class*="tone-"] .item-number,.design-v1 .site-section[class*="tone-"] .service-link{color:var(--section-ink)}
.design-v1 .site-section.layout-checklist[class*="tone-"] .item-number{color:var(--accent-ink)}
.design-v1 .site-section.layout-timeline[class*="tone-"] .feature-item{border-color:color-mix(in srgb,var(--section-ink) 35%,transparent)}
.design-v1 .site-section.layout-timeline[class*="tone-"] .feature-item:before{background:var(--section-ink)}
.design-v1 .site-section[class*="tone-"] .faq-list,.design-v1 .site-section[class*="tone-"] .faq-list details{border-color:color-mix(in srgb,var(--section-ink) 24%,transparent)}
.design-v1 .section-contact[class*="tone-"] .contact-form{background:var(--background);color:var(--ink)}
.design-v1 .section-contact[class*="tone-"] .contact-form .form-note{color:var(--muted)}
.design-v1 .page-inner .hero-copy h1,.design-v1.page-inner .hero-copy h1{font-size:clamp(2.6rem,4.8vw,4.8rem)}
.design-v1.page-inner.composition-framed .hero-inner{padding:30px;gap:36px}.design-v1.page-inner.composition-framed .hero-image{min-height:240px}
@media(max-width:760px){
 .design-v1 .site-section{padding:var(--section-space-mobile) 0}.design-v1 .hero-copy h1{font-size:clamp(2.4rem,10.2vw,3.6rem);max-width:18ch}.design-v1.page-inner .hero-copy h1{font-size:clamp(2.2rem,9.5vw,3rem)}
 .design-v1 .layout-feature-list .section-inner{display:block}.design-v1 .layout-feature-list .section-heading{margin-bottom:22px}
 .design-v1 .layout-spotlight .section-items,.design-v1 .layout-comparison .section-items{grid-template-columns:1fr}.design-v1 .layout-spotlight .feature-item:first-child{display:block;padding:26px}.design-v1 .layout-spotlight .feature-item:first-child .item-number{margin-bottom:22px}
 .design-v1 .layout-comparison .feature-item{padding:26px}.design-v1 .layout-comparison .feature-item:nth-child(even){border-left:0;border-top:1px solid color-mix(in srgb,var(--ink) 20%,transparent)}
 .design-v1.composition-framed .hero-inner,.design-v1.page-inner.composition-framed .hero-inner{padding:24px 20px;gap:24px}.design-v1.composition-framed .hero-image{min-height:280px}.design-v1.composition-framed .site-hero{padding-top:24px}
}
`;

/** Presentation v1 adds a deliberately smaller set of art-directed compositions
 * on top of the immutable legacy renderer. All image bindings and copy remain
 * model data; layout, interaction code and external-resource policy are trusted. */
export const portablePresentationCss=`
.presentation-v1{--content-width:1240px;font-size:16px;line-height:1.65}
.presentation-v1 .site-header,.presentation-v1 .hero-inner,.presentation-v1 .hero-index,.presentation-v1 .site-footer{width:min(var(--content-width),calc(100% - 96px))}
.presentation-v1 .section-inner{width:min(1160px,calc(100% - 96px))}
.presentation-v1 h1,.presentation-v1 h2,.presentation-v1 h3{font-weight:var(--heading-weight);letter-spacing:-.045em;text-wrap:balance}
.presentation-v1 .hero-copy h1{font-size:clamp(3.25rem,6.2vw,6.4rem);line-height:1.02;max-width:16ch;overflow-wrap:anywhere}
.presentation-v1 h1 em{font-family:var(--emphasis-font);font-weight:400;letter-spacing:-.045em;font-style:italic}
.presentation-v1.font-technical h1 em{font-style:normal;text-decoration:underline;text-decoration-color:var(--accent-secondary);text-decoration-thickness:3px;text-underline-offset:.12em}
.presentation-v1 h2{font-size:clamp(2.35rem,4.2vw,4rem);line-height:1.09;max-width:22ch}
.presentation-v1 h3{font-size:1.35rem;line-height:1.18}
.presentation-v1 .preview-notice{font-size:.59rem;letter-spacing:.09em;padding:5px 20px}
.presentation-v1 .site-header{min-height:96px;gap:30px;border-color:color-mix(in srgb,var(--ink) 12%,transparent)}
.presentation-v1 .brand{max-width:300px;flex-shrink:0}.presentation-v1 .brand-wordmark{font-family:var(--heading-font);font-size:1.35rem;line-height:1.13;letter-spacing:-.045em;font-weight:var(--heading-weight);max-width:20ch}
.presentation-v1 .brand-logo{display:block;max-width:224px}.presentation-v1 .brand-logo img{width:auto;max-width:224px;height:64px;object-fit:contain;object-position:left center}
.presentation-v1 .site-header nav{font-size:.8rem;gap:24px}.presentation-v1 .site-header .nav-contact{background:var(--ink);color:var(--background);border-color:transparent;border-radius:5px;padding:13px 19px}
.presentation-v1 .hero-copy{padding:24px 0 44px}.presentation-v1 .hero-description{font-size:1.05rem;line-height:1.75;max-width:45ch;margin-top:26px}
.presentation-v1 .eyebrow{font-size:.66rem;letter-spacing:.15em;line-height:1.6;margin-bottom:21px}
.presentation-v1 .button{min-height:52px;font-size:.82rem;border-radius:5px;padding:16px 22px;transition:transform .16s ease,filter .16s ease}
.presentation-v1 .button:hover{transform:translateY(-2px)}.presentation-v1 .text-link{font-size:.82rem;line-height:1.5;padding:10px 0;min-height:44px}
.presentation-v1 .hero-actions{gap:28px;margin-top:32px}.presentation-v1 .hero-image{min-height:500px;border-radius:var(--radius)}
.presentation-v1 .hero-image figcaption{padding:25px 15px 10px;font-size:.6rem;text-align:right;background:linear-gradient(transparent,#0009)}
.presentation-v1 .hero-index{margin-top:36px;font-size:.6rem;letter-spacing:.11em;padding:17px 0;border-bottom:0}
.presentation-v1 .site-section{padding:var(--section-space,80px) 0}.presentation-v1 .section-heading{margin-bottom:38px;max-width:740px}
.presentation-v1 .section-copy{font-size:1rem;line-height:1.8;max-width:62ch;margin-top:22px}
.presentation-v1 .feature-item p{font-size:.95rem;line-height:1.8;max-width:62ch}.presentation-v1 .item-number{font-size:.64rem;letter-spacing:.13em;margin:0 0 20px;color:var(--section-muted,var(--muted))}
.presentation-v1 .service-link{font-size:.78rem;min-height:44px;margin-top:20px;padding:9px 0;max-width:max-content}
.presentation-v1 .layout-rows .feature-item{display:block;padding:27px 0}.presentation-v1 .layout-rows .feature-item>.item-body{display:grid;grid-template-columns:42px minmax(0,1fr) minmax(0,1.5fr);gap:20px 32px;align-items:baseline}
.presentation-v1 .layout-rows .item-body .item-number{margin:0}.presentation-v1 .layout-rows .item-body h3{font-size:1.45rem}.presentation-v1 .layout-rows .item-body p{margin:0}.presentation-v1 .layout-rows .service-link{grid-column:3;margin-top:0}
.presentation-v1 .layout-split .section-inner{align-items:center}.presentation-v1 .layout-split .feature-item{display:block}.presentation-v1 .layout-split .item-number{display:none}
.presentation-v1 .layout-feature-list .feature-item{display:block}.presentation-v1 .layout-feature-list .item-number{display:none}
.presentation-v1 .layout-timeline .item-number{font-size:.75rem;margin-bottom:20px}.presentation-v1 .layout-timeline h3{font-size:1.3rem}
.presentation-v1 .layout-checklist .feature-item{display:block}.presentation-v1 .layout-checklist .item-number{float:left;width:30px;margin-right:18px}.presentation-v1 .layout-checklist .item-body h3,.presentation-v1 .layout-checklist .item-body p{margin-left:48px}
.presentation-v1 .layout-showcase .feature-item:first-child{min-height:280px}.presentation-v1 .layout-spotlight .feature-item:first-child{display:block}
.presentation-v1 .layout-editorial .section-heading{margin-left:0}.presentation-v1 .layout-editorial .feature-item:nth-child(even){margin-top:38px}
.presentation-v1 .item-image{position:relative;overflow:hidden;margin:0;background:var(--surface);border-radius:var(--radius)}
.presentation-v1 .item-image picture,.presentation-v1 .section-image picture{display:block}.presentation-v1 .item-image img{width:100%;height:auto;aspect-ratio:1.38;object-fit:cover}
.presentation-v1 .item-image figcaption,.presentation-v1 .section-image figcaption{font-size:.64rem;line-height:1.5;padding:9px 0;color:var(--section-muted,var(--muted))}
.presentation-v1 .item-image figcaption{padding:9px 13px;background:var(--section-background,var(--background))}
.presentation-v1 .section-image img{width:100%;aspect-ratio:1.04;object-fit:cover}.presentation-v1 .section-image{align-self:stretch;overflow:visible;border-radius:0}.presentation-v1 .section-image img{border-radius:var(--radius)}
.presentation-v1 .has-section-image .section-inner{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:36px 70px;align-items:center}
.presentation-v1 .has-section-image .section-heading{margin:0}.presentation-v1 .has-section-image .section-items,.presentation-v1 .has-section-image .service-tabs{grid-column:1/-1}
.presentation-v1 .has-section-image .faq-list{grid-column:1/-1}
.presentation-v1 .has-section-image .section-items:empty{display:none}
.presentation-v1 .has-section-image.section-order-1:not(.section-contact) .section-image{grid-column:1;grid-row:1}.presentation-v1 .has-section-image.section-order-1:not(.section-contact) .section-heading{grid-column:2;grid-row:1}
.presentation-v1 .layout-image-grid .section-items{grid-template-columns:repeat(3,minmax(0,1fr));gap:34px}
.presentation-v1 .layout-image-grid .feature-item{padding:0;border:0;background:none!important;border-radius:0;color:var(--section-ink,var(--ink))}
.presentation-v1 .layout-image-grid .item-body{padding:24px 0 0}.presentation-v1 .layout-image-grid .item-number{display:none}.presentation-v1 .layout-image-grid h3{font-size:1.6rem}
.presentation-v1 .layout-image-grid .feature-item:not(.has-item-image){border-top:2px solid var(--section-ink,var(--ink));align-self:end}.presentation-v1 .layout-image-grid .feature-item:not(.has-item-image) .item-body{padding:28px 0}
.presentation-v1 .layout-image-grid .feature-item p{color:var(--section-muted,var(--muted))}.presentation-v1 .layout-image-grid .item-image{border-radius:var(--radius)}
.presentation-v1 .layout-alternating .section-items{display:grid;grid-template-columns:1fr;gap:64px}
.presentation-v1 .layout-alternating .feature-item{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;padding:0;border:0;background:none!important;border-radius:0;color:var(--section-ink,var(--ink))}
.presentation-v1 .layout-alternating .feature-item:not(.has-item-image){grid-template-columns:1fr;border-top:1px solid color-mix(in srgb,var(--section-ink,var(--ink)) 18%,transparent);padding-top:26px}
.presentation-v1 .layout-alternating .feature-item:nth-child(even) .item-image{grid-column:2;grid-row:1}.presentation-v1 .layout-alternating .feature-item:nth-child(even) .item-body{grid-column:1;grid-row:1}
.presentation-v1 .layout-alternating .item-body{padding:25px 10px}.presentation-v1 .layout-alternating h3{font-size:clamp(1.8rem,3.1vw,2.7rem);max-width:21ch}.presentation-v1 .layout-alternating .item-number{display:none}
.presentation-v1 .layout-alternating .item-image img{aspect-ratio:1.14}.presentation-v1 .layout-alternating .feature-item p{color:var(--section-muted,var(--muted))}
.presentation-v1 .service-tab-list{display:none}.presentation-v1 .service-panels{display:block}.presentation-v1 .service-panels .feature-item{margin-bottom:28px}
.presentation-v1 .tabs-enhanced{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:70px;align-items:start}
.presentation-v1 .tabs-enhanced .service-tab-list{display:grid;border-top:1px solid color-mix(in srgb,var(--section-ink,var(--ink)) 20%,transparent)}
.presentation-v1 .service-tab-list button{display:flex;justify-content:space-between;align-items:center;gap:24px;text-align:left;width:100%;min-height:76px;padding:22px 0;background:none;color:var(--section-muted,var(--muted));border-bottom:1px solid color-mix(in srgb,var(--section-ink,var(--ink)) 20%,transparent);font-family:var(--heading-font);font-size:clamp(1.15rem,2vw,1.7rem);line-height:1.3}
.presentation-v1 .service-tab-list button>span:last-child{font-family:var(--body-font);font-size:1.1rem}.presentation-v1 .service-tab-list button[aria-selected=true]{color:var(--section-ink,var(--ink));border-bottom:2px solid currentColor}
.presentation-v1 .service-panels .feature-item{padding:0;border:0;background:none!important;color:var(--section-ink,var(--ink));border-radius:0}.presentation-v1 .service-panels .feature-item[hidden]{display:none}
.presentation-v1 .service-panels .item-image img{aspect-ratio:1.5}.presentation-v1 .service-panels .item-body{padding:22px 0 0}.presentation-v1 .service-panels h3{font-size:1.7rem}.presentation-v1 .service-panels .feature-item p{color:var(--section-muted,var(--muted))}
.presentation-v1 .section-statement h2{max-width:24ch}.presentation-v1 .section-statement.is-copy-only .section-inner{max-width:1160px}.presentation-v1 .section-statement.is-copy-only .section-heading{max-width:920px}
.presentation-v1 .faq-list summary{font-size:1.01rem;padding:26px 0}.presentation-v1 .faq-list details p{font-size:.95rem;line-height:1.8}
.presentation-v1 .section-contact .section-inner{gap:28px 72px}.presentation-v1 .section-contact .contact-form{border-radius:var(--radius);padding:32px}.presentation-v1 .contact-details{line-height:1.7}
.presentation-v1 .section-contact.has-section-image .section-image{grid-column:2;grid-row:1/span 2}.presentation-v1 .section-contact.has-section-image .contact-details{grid-column:1;grid-row:2}.presentation-v1 .section-contact.has-section-image.with-demo-form .section-image{grid-column:1;grid-row:3;max-width:420px}.presentation-v1 .section-contact.has-section-image.with-demo-form .contact-form{grid-column:2;grid-row:1/span 3}
.presentation-v1 .site-footer{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.8fr) minmax(0,1fr);gap:55px;padding:45px 0}.presentation-v1 .site-footer>p{text-align:left;max-width:34ch}.presentation-v1 .site-footer>*{min-width:0}.presentation-v1 .footer-brand{font-size:1.6rem;overflow-wrap:anywhere}.presentation-v1 .footer-brand.has-logo{display:block;width:max-content;max-width:100%}.presentation-v1 .site-footer .brand-logo img{max-width:200px;height:62px}.presentation-v1 .footer-navigation{grid-template-columns:1fr;align-content:start;gap:7px}.presentation-v1 .footer-navigation a{font-size:.78rem;text-decoration:none}
.presentation-v1.composition-immersive.page-home .hero-inner{width:100%;min-height:650px;padding:86px max(48px,calc((100% - var(--content-width))/2));isolation:isolate}
.presentation-v1.composition-immersive.page-home .hero-copy{max-width:760px;padding:20px 0 42px}.presentation-v1.composition-immersive.page-home .hero-copy h1{max-width:14ch}
.presentation-v1.composition-immersive.page-home .hero-description{color:#fff;max-width:43ch}.presentation-v1.composition-immersive.page-home .hero-image{border-radius:0}
.presentation-v1.composition-immersive.page-home .hero-image:after{background:linear-gradient(90deg,color-mix(in srgb,var(--ink) 85%,#000) 0%,#0009 48%,#0003 100%)}
.presentation-v1.composition-immersive.page-home .hero-index{margin-top:0;min-height:60px;align-items:center}
.presentation-v1.composition-editorial.page-home .hero-inner{grid-template-columns:1.05fr .95fr;gap:46px}.presentation-v1.composition-editorial.page-home .hero-copy{padding:40px 0 20px}.presentation-v1.composition-editorial.page-home .hero-image{margin-top:70px;min-height:520px}
.presentation-v1.composition-centered.page-home .hero-copy h1{max-width:18ch}.presentation-v1.composition-centered.page-home .hero-inner{max-width:1240px}.presentation-v1.composition-centered.page-home .hero-image{aspect-ratio:2.6;min-height:340px;max-height:460px}
.presentation-v1.family-wellness .hero-image{border-radius:220px 220px 14px 14px}.presentation-v1.family-wellness .layout-image-grid .item-image{border-radius:140px 140px 12px 12px}
.presentation-v1.family-hospitality .layout-alternating .item-image,.presentation-v1.family-editorial .layout-alternating .item-image{border-radius:0}
.presentation-v1.family-professional .layout-rows .feature-item{border-top-width:1px}.presentation-v1.family-professional .section-statement h2{max-width:25ch}
.presentation-v1.family-general .hero-image{border:0;transform:none}.presentation-v1.family-general .layout-image-grid .feature-item:nth-child(2) .item-image{border-radius:100px 100px var(--radius) var(--radius)}
.presentation-v1.page-inner .hero-copy h1{font-size:clamp(2.8rem,5.3vw,5rem);max-width:20ch}.presentation-v1.page-inner .hero-inner{grid-template-columns:1.25fr .75fr;gap:65px}.presentation-v1.page-inner .hero-image{min-height:290px;margin-top:10px;aspect-ratio:1.25;border-radius:var(--radius)}
@media(min-width:761px) and (max-width:1100px){
 .presentation-v1 .site-header{gap:20px}.presentation-v1 .site-header nav{gap:15px;font-size:.74rem}.presentation-v1 .brand{max-width:220px}.presentation-v1 .brand-logo img{max-width:180px;height:54px}.presentation-v1 .tabs-enhanced,.presentation-v1 .layout-alternating .feature-item,.presentation-v1 .has-section-image .section-inner{gap:36px}.presentation-v1 .layout-image-grid .section-items{gap:22px}
}
@media(max-width:760px){
 .presentation-v1 .site-header,.presentation-v1 .hero-inner,.presentation-v1 .hero-index,.presentation-v1 .site-footer,.presentation-v1 .section-inner{width:calc(100% - 40px)}
 .presentation-v1 .site-header{min-height:82px;gap:18px}.presentation-v1 .brand{max-width:calc(100% - 80px);flex-shrink:1}.presentation-v1 .brand-wordmark{font-size:1.18rem}.presentation-v1 .brand-logo img{max-width:min(180px,100%);height:54px}.presentation-v1 .site-header nav{gap:7px}.presentation-v1 .site-header .nav-contact{margin-top:8px}.presentation-v1 .hero-copy h1{font-size:clamp(2.55rem,10.7vw,4.4rem);max-width:17ch;overflow-wrap:anywhere}
 .presentation-v1 h2{font-size:clamp(2rem,8.5vw,3rem)}.presentation-v1 .hero-description{font-size:.98rem;margin-top:22px;line-height:1.75}.presentation-v1 .hero-copy{padding:15px 0 20px}.presentation-v1 .hero-actions{gap:16px 24px;margin-top:25px}.presentation-v1 .hero-image{min-height:320px;aspect-ratio:1.12}
 .presentation-v1 .site-section{padding:var(--section-space-mobile,54px) 0}.presentation-v1 .section-heading{margin-bottom:30px}.presentation-v1 .section-copy{font-size:.95rem}.presentation-v1 .eyebrow{font-size:.62rem;margin-bottom:18px}
 .presentation-v1 .layout-rows .feature-item>.item-body{grid-template-columns:28px 1fr;gap:12px 18px}.presentation-v1 .layout-rows .item-body p,.presentation-v1 .layout-rows .service-link{grid-column:2}.presentation-v1 .layout-rows .item-body h3{font-size:1.35rem}
 .presentation-v1 .has-section-image .section-inner{display:flex;flex-direction:column;gap:30px;align-items:stretch}.presentation-v1 .has-section-image .section-heading{order:0}.presentation-v1 .has-section-image .section-image{order:1}.presentation-v1 .has-section-image .section-items,.presentation-v1 .has-section-image .service-tabs{order:2}
 .presentation-v1 .section-image img{aspect-ratio:1.2}.presentation-v1 .layout-image-grid .section-items{grid-template-columns:1fr;gap:38px}.presentation-v1 .layout-image-grid .item-image img{aspect-ratio:1.45}.presentation-v1 .layout-image-grid .item-body{padding-top:19px}
 .presentation-v1 .layout-alternating .section-items{gap:40px}.presentation-v1 .layout-alternating .feature-item{display:flex;flex-direction:column;align-items:stretch;gap:18px}.presentation-v1 .layout-alternating .item-body{padding:0}.presentation-v1 .layout-alternating .item-image img{aspect-ratio:1.36}.presentation-v1 .layout-alternating h3{font-size:1.9rem}
 .presentation-v1 .tabs-enhanced{grid-template-columns:1fr;gap:28px}.presentation-v1 .service-tab-list button{min-height:58px;padding:17px 0;font-size:1.2rem}.presentation-v1 .service-panels h3{font-size:1.5rem}.presentation-v1 .service-panels .item-image img{aspect-ratio:1.4}
 .presentation-v1 .layout-editorial .feature-item:nth-child(even){margin-top:0}.presentation-v1 .section-contact .section-inner{gap:28px}.presentation-v1 .section-contact .contact-form{padding:24px}.presentation-v1 .faq-list summary{font-size:.95rem;padding:23px 0}
 .presentation-v1 .site-footer{grid-template-columns:1fr;gap:30px;padding:35px 0}.presentation-v1 .footer-navigation{grid-template-columns:1fr 1fr;gap:12px}.presentation-v1 .site-footer>p{margin:0}.presentation-v1 .mobile-contact{background:var(--surface);gap:10px}.presentation-v1 .mobile-contact .button{padding:12px 16px;min-height:46px}
 .presentation-v1.composition-immersive.page-home .hero-inner{width:100%;min-height:610px;padding:66px 24px 80px}.presentation-v1.composition-immersive.page-home .hero-copy{padding:0;max-width:100%}.presentation-v1.composition-immersive.page-home .hero-image{aspect-ratio:auto;min-height:0}.presentation-v1.composition-immersive.page-home .hero-copy h1{max-width:14ch}.presentation-v1.composition-immersive.page-home .hero-image:after{background:linear-gradient(90deg,#000d,#0008)}
 .presentation-v1.composition-editorial.page-home .hero-image{margin:0;min-height:330px}.presentation-v1.composition-editorial.page-home .hero-copy{padding:14px 0 20px}.presentation-v1.composition-centered.page-home .hero-image{min-height:260px;aspect-ratio:1.5}
 .presentation-v1.page-inner .hero-inner{display:flex;gap:22px}.presentation-v1.page-inner .hero-copy h1{font-size:clamp(2.4rem,10vw,3.6rem)}.presentation-v1.page-inner .hero-image{min-height:230px;max-height:280px;margin:0;aspect-ratio:1.5}
}
.presentation-v1.page-inner .hero-inner.hero-text-only{display:block;min-height:0;padding:0;background:none}
.presentation-v1.page-inner .hero-text-only .hero-copy{max-width:960px;padding:24px 0 32px}
.presentation-v1 .hero-image-caption{width:min(var(--content-width),calc(100% - 96px));margin:12px auto 0;color:var(--muted);font-size:.8rem;line-height:1.55;text-align:right}
@media(max-width:760px){
 .presentation-v1{padding-bottom:0}
 .presentation-v1 .mobile-contact{position:static;inset:auto;z-index:auto;width:calc(100% - 40px);margin:16px auto 0;padding:14px 0;border-top:1px solid color-mix(in srgb,var(--ink) 18%,transparent);border-bottom:1px solid color-mix(in srgb,var(--ink) 18%,transparent);background:none;box-shadow:none}
 .presentation-v1.page-inner .hero-text-only .hero-copy{padding:15px 0 20px}
 .presentation-v1 .hero-image-caption{width:calc(100% - 40px);text-align:left}
}
@media(prefers-reduced-motion:reduce){.presentation-v1 .button{transition:none}.presentation-v1 .button:hover{transform:none}}
`;
