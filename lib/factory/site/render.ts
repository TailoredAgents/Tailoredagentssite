import { createHash } from "node:crypto";
import { designFamilies } from "./families";
import { relativeSiteLink,siteManifest,type SiteFiles } from "./artifacts";
import type { PortableSiteBundle,SiteBlueprint } from "./types";
import { validateBlueprintStructure } from "./validate";
import { portablePolishCss,portableDesignCss,portablePresentationCss } from "./polish";
import { siteDesignCss,colorLuminance } from "./design";
import { portableHeroImages,portableSlotImages,portableLogoImage } from "./images";
import {configuredDemoForm,configuredFormRuntime} from "./interactions";
import {portableFontCss,portableFontFiles} from "./fonts";
import {portableSiteIdentityAssets,siteIdentityHead} from "./identity";
import {imageCompositionCss} from "./image-composition";

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
const serviceTabsRuntime=`document.querySelectorAll('[data-service-tabs]').forEach(group=>{const list=group.querySelector('[data-tab-list]'),tabs=Array.from(group.querySelectorAll('[data-service-tab]')),panels=Array.from(group.querySelectorAll('[data-service-panel]'));if(!list||!tabs.length||tabs.length!==panels.length)return;group.classList.add('tabs-enhanced');list.setAttribute('role','tablist');list.setAttribute('aria-orientation','vertical');function select(index,focus){tabs.forEach((tab,i)=>{tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].setAttribute('role','tabpanel');panels[i].hidden=i!==index;});if(focus)tabs[index].focus();}tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>select(index,false));tab.addEventListener('keydown',e=>{let next=index;if(e.key==='ArrowDown'||e.key==='ArrowRight')next=(index+1)%tabs.length;else if(e.key==='ArrowUp'||e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();select(next,true);});});select(0,false);});`;
export const trustedSiteRuntime=`(()=>{'use strict';const toggle=document.querySelector('[data-menu-toggle]'),menu=document.getElementById('site-menu');function close(){if(toggle&&menu){toggle.setAttribute('aria-expanded','false');menu.classList.remove('is-open');}}if(toggle&&menu){toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));menu.classList.toggle('is-open',open);});menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();toggle.focus();}});}${serviceTabsRuntime}${configuredFormRuntime}document.querySelectorAll('[data-demo-form]').forEach(form=>{form.addEventListener('submit',e=>{e.preventDefault();const output=form.querySelector('[data-demo-feedback]');if(output){output.textContent='This is a website preview. Your message was not sent or stored. The live form will be connected before launch.';output.hidden=false;output.focus();}});});})();`;
export const siteCsp="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'; manifest-src 'none'";

function inquiryTarget(b:SiteBlueprint,page:SiteBlueprint["pages"][number]){
  const form=b.interactions?.forms.find(f=>f.pagePath===page.path)||b.interactions?.forms.find(f=>b.pages.some(p=>p.path===f.pagePath&&/^contact(?: us)?$/i.test(p.title)))||b.interactions?.forms[0];
  if(form)return form.pagePath===page.path?`#${form.sectionId}`:`${relativeSiteLink(page.path,form.pagePath)}#${form.sectionId}`;
  const section=page.sections.find(s=>s.kind==="contact");
  if(section)return `#${section.id}`;
  if(b.presentation&&b.interactions&&!Object.values(b.contact).some(Boolean)){
    const destination=b.pages.find(p=>p.sections.some(s=>s.kind==="contact"));
    if(destination)return `${relativeSiteLink(page.path,destination.path)}#${destination.sections.find(s=>s.kind==="contact")!.id}`;
    return `#${page.sections[0]?.id||"page-content"}`;
  }
  return "#contact";
}
/** Automatic contact controls need an existing destination. An intentionally
 * sparse concept does not acquire an empty contact band or an unplanned form. */
function hasContactDestination(b:SiteBlueprint){
  return !b.presentation||!b.interactions||Object.values(b.contact).some(Boolean)||Boolean(b.interactions.forms.length)||b.pages.some(p=>p.sections.some(s=>s.kind==="contact"));
}
/** Booking verbs and booking requests imply an inquiry. A book as content or
 * bookkeeping as a service does not. Keep visibility and routing in agreement. */
function isInquiryAction(label:string){
  return /\b(?:contact|inquir|request|schedule|estimate|quote|appointment|conversation)|get in touch|let.s (?:talk|begin)|talk (?:to|with)/i.test(label)
    ||/^\s*book\b|\bbookings?\b|\b(?:ready to|click to|tap to|please)\s+book\b/i.test(label);
}
function usableHeroAction(label:string,b:SiteBlueprint){
  if(!b.presentation||!b.interactions)return true;
  if(/^\s*(?:call|dial|phone|ring)\b/i.test(label)&&!/^\s*call ?back\b/i.test(label)&&!b.contact.phone)return false;
  if(/^\s*(?:email|e-mail)\b/i.test(label)&&!b.contact.email)return false;
  return hasContactDestination(b)||!isInquiryAction(label);
}
/** CTA wording must agree with its destination on every page, including the
 * secondary action. Browsing services is different from requesting service. */
export function siteActionTarget(label:string,b:SiteBlueprint,page:SiteBlueprint["pages"][number],fallback:string,explicitTarget=false){
  if(/^\s*(?:call|dial|phone|ring)\b/i.test(label)&&!/^\s*call ?back\b/i.test(label)&&b.contact.phone)return `tel:${b.contact.phone.replace(/[^+0-9]/g,"")}`;
  if(/^\s*(?:email|e-mail)\b/i.test(label)&&b.contact.email)return `mailto:${b.contact.email}`;
  // A configured item already names its intended page/section. Preserve that
  // choice; only literal dial/email promises require a protocol destination.
  if(explicitTarget)return fallback;
  if(isInquiryAction(label))return inquiryTarget(b,page);
  const kind=/\b(?:explore|view|our|see|discover|browse)\b.*\bservices\b|^services$/i.test(label)?"services":/\b(?:our story|our company|about us|meet the team)\b/i.test(label)?"about":null;
  if(kind){
    const destination=b.pages.find(p=>p.path!=="index.html"&&(kind==="services"?/^services$/i.test(p.title):/^about(?: us)?|our (?:company|story)$/i.test(p.title)));
    if(destination&&destination.path!==page.path)return relativeSiteLink(page.path,destination.path);
    const section=page.sections.find(s=>s.kind===kind);if(section)return `#${section.id}`;
  }
  return fallback;
}
function heroHeadline(text:string,emphasis:string|null|undefined){
  const index=emphasis?text.indexOf(emphasis):-1;
  return index<0?escape(text):`${escape(text.slice(0,index))}<em>${escape(emphasis!)}</em>${escape(text.slice(index+emphasis!.length))}`;
}
type ImageMarkup=(assetId:string,lazy?:boolean)=>string;

function isContactPage(page:SiteBlueprint["pages"][number]){return /^contact(?: us)?$/i.test(page.title)||/^contact(?:-us)?\//i.test(page.path);}
/** Two adjacent Contact sections are one task: choose a channel or use the
 * inquiry form. Preserve section identities, copy, tones and keyboard order;
 * explicit imagery and more complex form arrangements keep their own layout. */
function hasContactComposition(b:SiteBlueprint,page:SiteBlueprint["pages"][number]){
  if(!b.presentation||!isContactPage(page))return false;
  const [channels,inquiry]=page.sections,forms=b.interactions?.forms.filter(form=>form.pagePath===page.path)||[];
  return channels?.kind==="contact"&&inquiry?.kind==="contact"&&forms.length===1&&forms[0].sectionId===inquiry.id
    &&!b.presentation.sectionImages.some(image=>image.pagePath===page.path&&[channels.id,inquiry.id].includes(image.sectionId));
}
function hasSingleContactForm(b:SiteBlueprint,page:SiteBlueprint["pages"][number]){
  if(!b.presentation||!isContactPage(page)||page.sections.length!==1)return false;
  const section=page.sections[0],forms=b.interactions?.forms.filter(form=>form.pagePath===page.path)||[];
  return section.kind==="contact"&&forms.length===1&&forms[0].sectionId===section.id
    &&!b.presentation.sectionImages.some(image=>image.pagePath===page.path);
}
/** A short form-led inner page needs a practical introduction, not a second
 * landing-page hero. Content-rich pages and explicit image stories opt out. */
function hasBriefInquiryComposition(b:SiteBlueprint,page:SiteBlueprint["pages"][number]){
  if(!b.presentation||page.path==="index.html"||isContactPage(page)||!page.sections.length||page.sections.length>3)return false;
  if(b.presentation.pageImages.some(image=>image.pagePath===page.path)||b.presentation.sectionImages.some(image=>image.pagePath===page.path))return false;
  const forms=b.interactions?.forms.filter(form=>form.pagePath===page.path)||[],inquiry=page.sections.at(-1)!;
  const words=(text:string)=>text.trim().split(/\s+/).length;
  return forms.length===1&&forms[0].sectionId===inquiry.id&&inquiry.kind==="contact"&&!inquiry.items.length
    &&words(`${page.hero.headline} ${page.hero.body}`)<=50
    &&page.sections.every(section=>!section.items.length&&words(`${section.title} ${section.body}`)<=60);
}

function luminance(hex:string){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
function contactMarkup(blueprint:SiteBlueprint,omit:ReadonlySet<keyof SiteBlueprint["contact"]>=new Set()){return [blueprint.contact.email&&!omit.has("email")?`<a href="mailto:${escape(blueprint.contact.email)}">${escape(blueprint.contact.email)}</a>`:"",blueprint.contact.phone&&!omit.has("phone")?`<a href="tel:${escape(blueprint.contact.phone.replace(/[^+0-9]/g,""))}">${escape(blueprint.contact.phone)}</a>`:"",blueprint.contact.address&&!omit.has("address")?`<p>${escape(blueprint.contact.address)}</p>`:""].filter(Boolean).join("");}
/** Explicit channel actions are the presentation, not another copy of the same
 * contact list. Put any remaining automatic channels in one section per page,
 * preferring direct-contact content over an inquiry form. */
function sectionContactMarkup(blueprint:SiteBlueprint,pagePath:string,sectionId:string){
  if(!blueprint.presentation)return contactMarkup(blueprint);
  const page=blueprint.pages.find(page=>page.path===pagePath)!,sections=page.sections.filter(section=>section.kind==="contact");
  const target=sections.find(section=>!blueprint.interactions?.forms.some(form=>form.pagePath===pagePath&&form.sectionId===section.id))||sections[0];
  if(target?.id!==sectionId)return "";
  const covered=new Set<keyof SiteBlueprint["contact"]>();
  for(const action of blueprint.interactions?.actions.filter(action=>action.pagePath===pagePath&&sections.some(section=>section.id===action.sectionId))||[]){
    const destination=siteActionTarget(action.label,blueprint,page,"",true);
    if(blueprint.contact.phone&&destination===`tel:${blueprint.contact.phone.replace(/[^+0-9]/g,"")}`)covered.add("phone");
    if(blueprint.contact.email&&destination===`mailto:${blueprint.contact.email}`)covered.add("email");
  }
  return contactMarkup(blueprint,covered);
}
function demoForm(){return `<form data-demo-form class="contact-form"><div class="form-row"><label>Your name<input name="name" autocomplete="name" placeholder="Your name" required maxlength="100"></label><label>Email address<input type="email" name="email" autocomplete="email" placeholder="you@example.com" required maxlength="200"></label></div><label>How can we help?<textarea name="message" rows="4" placeholder="Tell us a little about what you have in mind" required maxlength="2000"></textarea></label><button class="button button-primary" type="submit">Preview inquiry <span aria-hidden="true">↗</span></button><p class="form-note">Demo form — messages are not sent from this preview.</p><p data-demo-feedback role="status" tabindex="-1" hidden></p></form>`;}

function sectionMarkup(section:SiteBlueprint["pages"][number]["sections"][number],index:number,blueprint:SiteBlueprint,imageMarkup:ImageMarkup,pagePath:string,contactTarget:string){
  const eyebrow=section.eyebrow?`<p class="eyebrow">${escape(section.eyebrow)}</p>`:"";
  const heading=`<div class="section-heading">${eyebrow}<h2>${escape(section.title)}</h2>${section.body?`<p class="section-copy">${escape(section.body)}</p>`:""}</div>`;
  const bindings=blueprint.presentation?.sectionImages.filter(binding=>binding.pagePath===pagePath&&binding.sectionId===section.id)||[];
  const photo=(assetId:string,className:string)=>{
    const caption=assetId==="hero"?blueprint.heroImage.caption:blueprint.media?.find(m=>m.id===assetId)?.caption;
    return `<figure class="${className}">${imageMarkup(assetId,true)}${caption?`<figcaption>${escape(caption)}</figcaption>`:""}</figure>`;
  };
  // Remove only obvious list numbering; preserve service names such as
  // "24-Hour Support" and "3-Step Planning" whose numbers carry meaning.
  const itemTitle=(title:string)=>blueprint.presentation?title.replace(/^\s*0?[1-9](?:\s+[—–:-]\s+|\.\s+)/,""):title;
  let content="",hasContactDetails=false;
  if(section.kind==="faq")content=`<div class="faq-list">${section.items.map(item=>`<details><summary>${escape(item.title)}<span aria-hidden="true">+</span></summary><p>${escape(item.body)}</p></details>`).join("")}</div>`;
  else if(section.kind==="contact"){
    const form=blueprint.interactions?.forms.find(f=>f.pagePath===pagePath&&f.sectionId===section.id);
    const otherForms=blueprint.interactions?.forms.filter(f=>f.pagePath!==pagePath)||[];
    const contactPage=otherForms.find(f=>blueprint.pages.some(p=>p.path===f.pagePath&&/^contact(?: us)?$/i.test(p.title)))||otherForms[0];
    const actions=blueprint.interactions?.actions.filter(a=>a.pagePath===pagePath&&a.sectionId===section.id)||[];
    const items=section.items.map((item,itemIndex)=>{
      const action=actions.find(a=>a.itemIndex===itemIndex);
      const destination=action?siteActionTarget(action.label,blueprint,blueprint.pages.find(p=>p.path===pagePath)!,`${relativeSiteLink(pagePath,action.targetPage)}${action.targetSection?`#${action.targetSection}`:""}`,true):"";
      // When the heading is already the action label, make it the link once.
      // Do not merge merely similar labels or alter the configured destination.
      const sameLabel=blueprint.presentation&&action&&item.title.normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase()===action.label.normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase();
      const linkedHeading=sameLabel?`<a class="contact-heading-link" href="${escape(destination)}">${escape(item.title)} <span aria-hidden="true">↗</span></a>`:escape(item.title);
      return `<div class="contact-item"><h3>${linkedHeading}</h3><p>${escape(item.body)}</p>${action&&!sameLabel?`<a class="text-link" href="${escape(destination)}">${escape(action.label)} <span aria-hidden="true">↗</span></a>`:""}</div>`;
    }).join("");
    const details=`${sectionContactMarkup(blueprint,pagePath,section.id)}${items}${!form&&!actions.length&&contactPage?`<a href="${escape(relativeSiteLink(pagePath,contactPage.pagePath))}#${escape(contactPage.sectionId)}">${blueprint.presentation?"Preview inquiry":"Start an inquiry"} <span aria-hidden="true">↗</span></a>`:""}`;
    hasContactDetails=Boolean(details);
    content=`<div class="contact-details">${details}</div>${form?configuredDemoForm(form):blueprint.interactions?"":demoForm()}`;
  }
  else {
    const sectionActions=blueprint.interactions?.actions.filter(action=>action.pagePath===pagePath&&action.sectionId===section.id)||[];
    const items=section.items.map((item,i)=>{
    const detail=section.kind==="services"?blueprint.pages.find(p=>p.path!==pagePath&&p.path!=="index.html"&&p.title.toLowerCase()===item.title.toLowerCase()):null;
    const specified=sectionActions.find(a=>a.itemIndex===i);
    const page=blueprint.pages.find(p=>p.path===pagePath)!;
    const destination=specified?siteActionTarget(specified.label,blueprint,page,`${relativeSiteLink(pagePath,specified.targetPage)}${specified.targetSection?`#${specified.targetSection}`:""}`,true):detail?relativeSiteLink(pagePath,detail.path):contactTarget;
    // Once a new presentation configures a section's actions, do not add
    // fallback links to its remaining explanatory items. Unconfigured sections
    // and legacy presentations retain their useful automatic service links.
    const action=specified||section.kind==="services"&&(!blueprint.presentation||!sectionActions.length)&&(detail||hasContactDestination(blueprint))?`<a class="service-link" href="${escape(destination)}">${escape(specified?.label||(detail?"Explore this service":"Discuss your needs"))}<span aria-hidden="true">↗</span></a>`:"";
    const imageBinding=bindings.find(binding=>binding.itemIndex===i);
    const panelAttrs=section.layout==="service-tabs"?` id="${escape(section.id)}-panel-${i}" aria-labelledby="${escape(section.id)}-tab-${i}" data-service-panel tabindex="0"`:"";
    const numbering=section.layout==="service-tabs"?"":`<span class="item-number" aria-hidden="true">${section.layout==="checklist"?"✓":String(i+1).padStart(2,"0")}</span>`;
    return `<article class="feature-item${imageBinding?" has-item-image":""}"${panelAttrs}>${imageBinding?photo(imageBinding.assetId,"item-image"):""}${blueprint.presentation?"":numbering}<div${blueprint.presentation?' class="item-body"':""}>${blueprint.presentation?numbering:""}<h3>${escape(itemTitle(item.title))}</h3><p>${escape(item.body)}</p>${action}</div></article>`;
    }).join("");
    const tabList=section.layout==="service-tabs"?`<div class="service-tab-list" data-tab-list aria-label="${escape(section.title)}">${section.items.map((item,i)=>`<button type="button" id="${escape(section.id)}-tab-${i}" data-service-tab aria-controls="${escape(section.id)}-panel-${i}"><span>${escape(itemTitle(item.title))}</span><span aria-hidden="true">↗</span></button>`).join("")}</div>`:"";
    content=tabList?`<div class="service-tabs" data-service-tabs>${tabList}<div class="section-items service-panels">${items}</div></div>`:`<div class="section-items">${items}</div>`;
  }
  const sectionImage=bindings.find(binding=>binding.itemIndex===null);
  const illustration=sectionImage?photo(sectionImage.assetId,"story-image section-image"):!blueprint.presentation&&section.kind==="about"&&section.layout==="split"?photo("hero","story-image"):"";
  const tone=blueprint.design?.sectionStyles.find(s=>s.pagePath===pagePath&&s.sectionId===section.id)?.tone;
  const copyOnly=!section.items.length&&section.kind!=="contact"&&!illustration;
  const hasForm=section.kind==="contact"&&blueprint.interactions?.forms.some(form=>form.pagePath===pagePath&&form.sectionId===section.id);
  const page=blueprint.pages.find(page=>page.path===pagePath)!;
  // Short text-led inner sections need less breathing room than a Home feature
  // or an image story. Short inner statements are supporting copy, not another
  // hero. Keep Home statements, long readings and explicit image compositions
  // intact; the selected density still controls the spacing.
  const words=[section.title,section.body,...section.items.flatMap(item=>[item.title,item.body])].join(" ").trim().split(/\s+/).length;
  const precedesInquiry=blueprint.interactions?.forms.some(form=>form.pagePath===pagePath&&form.sectionId===page.sections[index+1]?.id);
  const compactContent=blueprint.presentation&&pagePath!=="index.html"&&section.kind!=="contact"&&!bindings.length&&!(copyOnly&&precedesInquiry)&&words<=(copyOnly?110:360);
  const readingSection=compactContent&&copyOnly&&Boolean(section.body)&&words<=110;
  const previous=page.sections[index-1],following=page.sections[index+1];
  // A brief orientation before detailed content and a closing note before
  // contact have supporting roles. Keep a standalone statement expressive.
  const readingIntroduction=readingSection&&words<=60&&index===0&&Boolean(following?.items.length);
  const readingConclusion=readingSection&&words<=60&&following?.kind==="contact"&&previous&&!previous.items.length
    &&previous.kind!=="contact"&&[previous.title,previous.body].join(" ").trim().split(/\s+/).length<=110;
  // A final direct-contact band has no form to fill its second grid column.
  // Use that column for its existing channels/actions; keep all copy intact.
  const contactClosing=blueprint.presentation&&blueprint.interactions&&!isContactPage(page)&&section.kind==="contact"&&!hasForm&&!sectionImage&&index===page.sections.length-1;
  const compactInquiry=blueprint.presentation&&!isContactPage(page)&&hasForm&&!sectionImage;
  const inquiryContext=blueprint.presentation&&pagePath!=="index.html"&&!isContactPage(page)&&copyOnly&&!sectionImage&&precedesInquiry;
  return `<section id="${escape(section.id)}" class="site-section section-${section.kind} layout-${section.layout} section-order-${index%2}${tone?` tone-${tone}`:""}${copyOnly?" is-copy-only":""}${sectionImage?" has-section-image":""}${hasForm?" with-demo-form":""}${compactContent?" compact-content":""}${readingSection?" reading-section":""}${readingIntroduction?" reading-introduction":""}${readingConclusion?" reading-conclusion":""}${contactClosing?` contact-closing${hasContactDetails?"":" contact-copy-only"}`:""}${compactInquiry?" compact-inquiry":""}${inquiryContext?" inquiry-context":""}" aria-labelledby="${escape(section.id)}-heading"><div class="section-inner">${heading.replace("<h2>",`<h2 id="${escape(section.id)}-heading">`)}${illustration}${content}</div></section>`;
}

export function renderPortableSite(bundle:PortableSiteBundle,assets:Record<string,Uint8Array>,options:{publicBaseUrl?:string}={}) {
  const b=validateBlueprintStructure(bundle.blueprint),family=designFamilies[b.family],encoder=new TextEncoder(),files:SiteFiles={};
  const identity=portableSiteIdentityAssets(assets);Object.assign(files,identity.files);
  const imageSet=portableHeroImages(assets);
  const imageSets:Record<string,ReturnType<typeof portableHeroImages>>={hero:imageSet};
  Object.assign(files,imageSet.files);
  for(const media of b.media||[]){
    const set=media.role==="logo"?portableLogoImage(assets,media.id):portableSlotImages(assets,media.id);
    imageSets[media.id]=set;Object.assign(files,set.files);
  }
  if(b.presentation)Object.assign(files,portableFontFiles(b.presentation.fontTheme));
  files["assets/runtime.js"]=encoder.encode(trustedSiteRuntime);
  // Black/white crossover guarantees readable button text even when the model
  // picks a mid-tone accent; a near-black swatch can miss WCAG's 4.5:1 threshold.
  const ink=luminance(b.accent)>.179?"#000000":"#ffffff";
  files["assets/site.css"]=encoder.encode(`:root{--background:${family.background};--surface:${family.surface};--ink:${family.ink};--muted:${family.muted};--accent:${b.accent};--accent-ink:${ink};--radius:${family.radius};--heading-font:${b.fontPair==="editorial"?'Georgia,"Times New Roman",serif':b.fontPair==="humanist"?'"Trebuchet MS",Arial,sans-serif':'Arial,Helvetica,sans-serif'};}\n${portableSiteCss}\n${portablePolishCss}\n${b.design?`${portableDesignCss}\n${siteDesignCss(b)}`:""}\n${b.presentation?`${portablePresentationCss}\n${portableFontCss(b.presentation.fontTheme,b.design?.typography.weight)}`:""}`);
  const cropCss=imageCompositionCss(b);
  if(cropCss)files["assets/site.css"]=encoder.encode(`${new TextDecoder().decode(files["assets/site.css"])}\n${cropCss}`);
  for(const page of b.pages){
    const local=(target:string)=>relativeSiteLink(page.path,target);
    const imageMarkup:ImageMarkup=(assetId,lazy=false)=>{
      const set=imageSets[assetId];if(!set)throw new Error(`Missing approved image asset: ${assetId}`);
      const meta=assetId==="hero"?b.heroImage:b.media!.find(m=>m.id===assetId)!;
      const isLogo=b.media?.some(m=>m.id===assetId&&m.role==="logo");
      const cropBinding=!isLogo&&b.presentation?.imageFocalPoints!==undefined?` data-asset-id="${assetId}"`:"";
      const img=`<img${cropBinding} src="${escape(local(set.fallback.path))}" alt="${escape(meta.alt)}" width="${set.fallback.width}" height="${set.fallback.height}" ${lazy?'loading="lazy"':isLogo?'loading="eager"':'fetchpriority="high"'} decoding="async">`;
      return set.variants.length?`<picture><source type="image/webp" media="(max-width: 760px)" srcset="${escape(local(set.variants[0].path))}">${img}</picture>`:img;
    };
    const nav=b.pages.map(p=>`<a href="${escape(local(p.path))}"${p.path===page.path?' aria-current="page"':""}>${escape(p.path==="index.html"?"Home":p.title)}</a>`).join("");
    const contactSection=page.sections.find(s=>s.kind==="contact"),contactTarget=inquiryTarget(b,page);
    // New presentations opt into inner-page images. An absent binding means a
    // compact text introduction, not repetition of the homepage's paid hero.
    const heroAssetId=b.presentation?.pageImages.find(binding=>binding.pagePath===page.path)?.assetId||(page.path==="index.html"||!b.presentation?"hero":null);
    const heroCaption=heroAssetId==="hero"?b.heroImage.caption:heroAssetId?b.media!.find(m=>m.id===heroAssetId)!.caption:null;
    const heroImage=heroAssetId?`<figure class="hero-image">${imageMarkup(heroAssetId)}${heroCaption&&!b.presentation?`<figcaption>${escape(heroCaption)}</figcaption>`:""}</figure>`:"";
    const heroNote=b.presentation&&heroAssetId&&heroCaption?`<p class="hero-image-caption" role="note">${escape(heroCaption)}</p>`:"";
    const compactIntro=!!b.presentation&&page.path!=="index.html"&&!heroAssetId;
    const briefInquiry=hasBriefInquiryComposition(b,page);
    const contactComposition=hasContactComposition(b,page);
    const focusedContact=compactIntro&&(contactComposition||hasSingleContactForm(b,page));
    const contactAvailable=hasContactDestination(b);
    const callTarget=b.contact.phone?`tel:${b.contact.phone.replace(/[^+0-9]/g,"")}`:null;
    const primaryTarget=siteActionTarget(page.hero.primaryCta,b,page,contactTarget);
    const secondaryTarget=siteActionTarget(page.hero.secondaryCta,b,page,page.sections[0]?`#${page.sections[0].id}`:contactTarget);
    const breadcrumb=page.path==="index.html"?"":`<div class="page-breadcrumb"><a href="${escape(local("index.html"))}">Home</a><span aria-hidden="true">/</span><span>${escape(page.title)}</span></div>`;
    const mobileContact=focusedContact||!contactAvailable?"":`<nav class="mobile-contact" aria-label="Quick contact">${callTarget?`<a class="button mobile-call" href="${escape(callTarget)}">Call now</a>`:""}<a class="button button-primary" href="${contactTarget}">Get in touch</a></nav>`;
    const repeatedContactAction=(target:string)=>focusedContact&&(target===contactTarget||target===callTarget||!!b.contact.email&&target===`mailto:${b.contact.email}`);
    const heroActions=[usableHeroAction(page.hero.primaryCta,b)&&!repeatedContactAction(primaryTarget)?`<a class="button button-primary" href="${escape(primaryTarget)}">${escape(page.hero.primaryCta)}<span aria-hidden="true">↗</span></a>`:"",page.hero.secondaryCta&&usableHeroAction(page.hero.secondaryCta,b)&&!repeatedContactAction(secondaryTarget)?`<a class="text-link" href="${escape(secondaryTarget)}">${escape(page.hero.secondaryCta)} <span aria-hidden="true">↗</span></a>`:""].join("");
    const heroCopy=`<div class="hero-copy">${breadcrumb}<p class="eyebrow"><span aria-hidden="true"></span>${escape(page.hero.eyebrow||b.tagline)}</p><h1>${heroHeadline(page.hero.headline,b.presentation?.heroEmphasis)}</h1><p class="hero-description">${escape(page.hero.body)}</p>${heroActions?`<div class="hero-actions">${heroActions}</div>`:""}</div>`;
    const renderedSections=page.sections.map((section,index)=>sectionMarkup(section,index,b,imageMarkup,page.path,contactTarget));
    const sections=contactComposition?`<div class="contact-composition">${renderedSections.slice(0,2).join("")}</div>${renderedSections.slice(2).join("")}`:renderedSections.join("");
    const heroIndex=compactIntro?"":`<div class="hero-index" aria-hidden="true"><span>${escape(b.tagline||family.name)}</span><span>01 — ${String(b.pages.length).padStart(2,"0")}</span></div>`;
    const brandContents=b.presentation?.logoAssetId?`<span class="brand-logo">${imageMarkup(b.presentation.logoAssetId)}</span>`:b.presentation?`<span class="brand-wordmark">${escape(b.brandName)}</span>`:`<span class="brand-symbol" aria-hidden="true">${escape(b.brandName.charAt(0))}</span><span>${escape(b.brandName)}</span>`;
    const automaticContact=b.presentation&&b.interactions?`${contactMarkup(b)}${contactTarget!=="#contact"?`<a class="text-link" href="${escape(contactTarget)}">${b.interactions.forms.length?"Preview inquiry":"Get in touch"} <span aria-hidden="true">↗</span></a>`:""}`:null;
    const closing=contactSection||!contactAvailable?"":automaticContact!==null?`<section id="contact" class="site-section section-contact layout-split contact-closing"><div class="section-inner"><div class="section-heading"><p class="eyebrow">Let's talk</p><h2>A good place to start.</h2><p class="section-copy">Tell us what you have in mind, and take the next step.</p></div><div class="contact-details">${automaticContact}</div></div></section>`:`<section id="contact" class="site-section section-contact layout-split"><div class="section-inner"><div class="section-heading"><p class="eyebrow">Let's talk</p><h2>A good place to start.</h2><p class="section-copy">Tell us what you have in mind, and take the next step.</p><div class="contact-details">${contactMarkup(b)}</div></div>${b.interactions?"":demoForm()}</div></section>`;
    files[page.path]=encoder.encode(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="${escape(siteCsp)}"><meta name="description" content="${escape(page.description)}"><meta name="color-scheme" content="${(b.design?colorLuminance(b.design.palette.background)<.179:b.family==="hospitality")?"dark":"light"}"><title>${escape(page.title)} | ${escape(b.brandName)}</title>${identity.variants.length?siteIdentityHead(b,page,options.publicBaseUrl):""}<link rel="stylesheet" href="${escape(local("assets/site.css"))}"><script src="${escape(local("assets/runtime.js"))}" defer></script></head><body data-page="${page.path}" class="${b.design?"design-v1 ":""}${b.presentation?`presentation-v1 font-${b.presentation.fontTheme} `:""}family-${b.family} composition-${b.composition} ${page.path==="index.html"?"page-home":"page-inner"}${compactIntro?" compact-intro":""}${focusedContact?" focused-contact":""}${briefInquiry?" brief-inquiry-page":""}"><a class="skip-link" href="#page-content">Skip to content</a><div class="preview-notice" role="note">Website concept <span>·</span> Forms are demonstrations</div><header class="site-header"><a class="brand" href="${escape(local("index.html"))}" aria-label="${escape(b.brandName)} home">${brandContents}</a><button type="button" class="menu-toggle" data-menu-toggle aria-controls="site-menu" aria-expanded="false">Menu <span aria-hidden="true">☰</span></button><nav id="site-menu" aria-label="Primary navigation">${nav}${contactAvailable?`<a class="nav-contact" href="${escape(contactTarget)}">Get in touch <span aria-hidden="true">↗</span></a>`:""}</nav></header><main id="page-content"><section class="site-hero"><div class="hero-inner${heroAssetId?"":" hero-text-only"}">${heroCopy}${heroImage}</div>${heroNote}${heroIndex}</section>${b.presentation?mobileContact:""}${sections}${closing}</main><footer class="site-footer"><div><a class="footer-brand${b.presentation?.logoAssetId?" has-logo":""}" href="${escape(local("index.html"))}" aria-label="${escape(b.brandName)} home">${b.presentation?.logoAssetId?brandContents:escape(b.brandName)}</a><p>${escape(b.tagline)}</p></div><nav class="footer-navigation" aria-label="Footer navigation">${nav}</nav><p>Website concept by Tailored Agents.<br>Business details and integrations are reviewed before launch.</p></footer>${b.presentation?"":mobileContact}</body></html>`);
  }
  files["robots.txt"]=encoder.encode("User-agent: *\nDisallow: /\n");
  return {files,manifest:siteManifest(files),runtimeSha256:createHash("sha256").update(trustedSiteRuntime).digest("hex")};
}

export const portableSiteCss=`
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;background:var(--background);color:var(--ink);font:16px/1.65 Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased}a{color:inherit;text-decoration:none}button,input,textarea,select{font:inherit}button,a,input,textarea,summary{-webkit-tap-highlight-color:transparent}a,button,summary{touch-action:manipulation}button{cursor:pointer}a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #437ade;outline-offset:5px}h1,h2,h3,p,figure{margin:0}h1,h2,h3{font-family:var(--heading-font);font-weight:600;line-height:1.1;letter-spacing:-.035em}h1{font-size:clamp(3rem,5.9vw,6.2rem);max-width:13ch}h2{font-size:clamp(2rem,3.8vw,3.8rem);max-width:18ch}h3{font-size:1.35rem;letter-spacing:-.025em}p{overflow-wrap:anywhere}img{display:block;max-width:100%;height:auto}button{border:0}section{position:relative}::selection{background:var(--accent);color:var(--accent-ink)}.skip-link{position:fixed;left:16px;top:-100px;z-index:1000;padding:10px 18px;background:var(--surface);color:var(--ink)}.skip-link:focus{top:16px}.preview-notice{padding:7px 20px;text-align:center;font-size:.7rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;background:var(--ink);color:var(--background)}.preview-notice span{margin:0 10px;opacity:.55}.site-header{display:flex;align-items:center;justify-content:space-between;gap:32px;width:min(1320px,calc(100% - 96px));min-height:100px;margin:auto;border-bottom:1px solid color-mix(in srgb,var(--ink) 17%,transparent)}.brand{display:flex;align-items:center;gap:12px;font-weight:700;font-size:1.02rem;line-height:1.2;max-width:310px}.brand-symbol{display:grid;place-items:center;flex:0 0 39px;height:39px;border:1px solid var(--ink);border-radius:50%;font-family:var(--heading-font);font-size:1.35rem}.site-header nav{display:flex;align-items:center;gap:26px;font-size:.83rem;font-weight:600}.site-header nav>a{padding:10px 0}.site-header nav>a[aria-current=page]{text-decoration:underline;text-underline-offset:7px}.site-header .nav-contact{padding:12px 19px;border:1px solid var(--ink);border-radius:999px;white-space:nowrap}.nav-contact span{margin-left:15px}.menu-toggle{display:none}.site-hero{padding:64px 0 0}.hero-inner{width:min(1320px,calc(100% - 96px));margin:auto;display:grid;grid-template-columns:1.05fr 1fr;align-items:center;gap:64px}.hero-copy{padding:30px 0 45px}.eyebrow{display:flex;align-items:center;gap:10px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.18em;margin-bottom:24px;color:var(--muted)}.hero-copy .eyebrow span{width:7px;height:7px;border-radius:50%;background:currentColor}.hero-description{font-size:1.07rem;color:var(--muted);max-width:43ch;margin-top:28px;line-height:1.8}.hero-actions{display:flex;align-items:center;flex-wrap:wrap;gap:26px;margin-top:36px}.button{display:inline-flex;justify-content:space-between;align-items:center;gap:24px;min-height:52px;padding:15px 24px;font-size:.86rem;font-weight:700;border-radius:var(--radius);line-height:1.35}.button-primary{background:var(--accent);color:var(--accent-ink)}.button:hover{filter:brightness(.95)}.text-link{display:inline-flex;align-items:center;gap:16px;font-size:.85rem;font-weight:600;border-bottom:1px solid currentColor;padding:9px 0}.hero-image{position:relative;align-self:stretch;min-height:490px;overflow:hidden;border-radius:var(--radius)}.hero-image img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}.hero-image figcaption{position:absolute;bottom:0;left:0;right:0;padding:32px 18px 12px;background:linear-gradient(transparent,rgba(0,0,0,.78));color:white;font-size:.66rem;line-height:1.4}.hero-index{width:min(1320px,calc(100% - 96px));margin:44px auto 0;padding:17px 0;display:flex;justify-content:space-between;gap:24px;font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;border-top:1px solid color-mix(in srgb,var(--ink) 18%,transparent);border-bottom:1px solid color-mix(in srgb,var(--ink) 18%,transparent);color:var(--muted)}.site-section{padding:92px 0}.section-inner{width:min(1200px,calc(100% - 96px));margin:auto}.section-heading{max-width:760px;margin-bottom:42px}.section-copy{color:var(--muted);max-width:65ch;margin-top:22px}.section-items{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.feature-item{padding:32px 28px;background:var(--surface);border-radius:var(--radius);border:1px solid color-mix(in srgb,var(--ink) 10%,transparent)}.item-number{display:block;font-size:.72rem;font-weight:700;letter-spacing:.1em;margin-bottom:35px;color:var(--muted)}.feature-item p{color:var(--muted);font-size:.91rem;margin-top:15px;line-height:1.8}.layout-rows .section-items{display:block;border-top:1px solid color-mix(in srgb,var(--ink) 18%,transparent)}.layout-rows .feature-item{display:grid;grid-template-columns:70px 1fr;background:none;border:0;border-bottom:1px solid color-mix(in srgb,var(--ink) 18%,transparent);border-radius:0;padding:28px 0}.layout-rows .feature-item>div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:40px}.layout-rows .feature-item p{margin:0}.layout-rows .item-number{margin:3px 0}.layout-split .section-inner{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:70px;align-items:start}.layout-split .section-heading{margin-bottom:0}.layout-split .section-items{display:block}.layout-split .feature-item{padding:23px 0;border:0;border-bottom:1px solid color-mix(in srgb,var(--ink) 18%,transparent);background:none;border-radius:0;display:flex;gap:28px}.layout-split .item-number{margin:5px 0;flex:0 0 26px}.layout-split .section-items:empty{display:none}.story-image{overflow:hidden;border-radius:var(--radius)}.story-image img{width:100%;aspect-ratio:1.1;object-fit:cover}.story-image figcaption{font-size:.72rem;color:var(--muted);padding-top:10px}.layout-split .story-image+.section-items{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:30px}.layout-editorial .section-heading{margin-left:22%;max-width:760px}.layout-editorial .section-items{grid-template-columns:repeat(2,minmax(0,1fr));gap:80px}.layout-editorial .feature-item{padding:32px 0;background:none;border:0;border-top:2px solid var(--ink);border-radius:0}.layout-editorial .feature-item:nth-child(even){margin-top:55px}.layout-timeline .section-items{gap:0;counter-reset:steps}.layout-timeline .feature-item{position:relative;padding:32px;border-radius:0;border:0;border-top:1px solid var(--ink);background:none}.layout-timeline .feature-item:before{position:absolute;content:'';top:-6px;left:32px;width:11px;height:11px;border-radius:50%;background:var(--ink)}.layout-timeline .item-number{font-size:2rem;font-family:var(--heading-font)}.layout-band{background:var(--ink);color:var(--background)}.layout-band .eyebrow,.layout-band .section-copy,.layout-band .feature-item p,.layout-band .item-number{color:var(--background)}.layout-band .section-heading{max-width:900px}.layout-band .feature-item{background:none;border:1px solid color-mix(in srgb,var(--background) 30%,transparent)}.section-statement .section-inner{max-width:1040px}.section-statement h2{font-size:clamp(2.5rem,5vw,5rem);max-width:22ch}.section-statement .section-items:empty{display:none}.faq-list{border-top:1px solid color-mix(in srgb,var(--ink) 18%,transparent)}.faq-list details{border-bottom:1px solid color-mix(in srgb,var(--ink) 18%,transparent)}.faq-list summary{cursor:pointer;display:flex;justify-content:space-between;gap:24px;padding:25px 0;font-weight:600;list-style:none}.faq-list summary::-webkit-details-marker{display:none}.faq-list summary span{font-size:1.4rem;line-height:1}.faq-list details p{padding:0 36px 25px 0;max-width:75ch;color:var(--muted)}.section-contact{border-top:1px solid color-mix(in srgb,var(--ink) 18%,transparent);background:var(--surface)}.section-contact .contact-details{grid-column:1;font-size:1rem;display:grid;gap:10px}.section-contact .contact-details:empty{display:none}.section-contact .contact-form{grid-column:2;grid-row:1/span 2}.contact-details a{text-decoration:underline;text-underline-offset:5px;overflow-wrap:anywhere}.contact-item{display:grid;gap:12px;margin-top:18px;max-width:60ch}.contact-item p{font-size:.94rem}.contact-item .text-link{justify-self:start}.contact-form{display:grid;gap:20px}.contact-form label{display:grid;gap:7px;font-size:.78rem;font-weight:600}.form-row{display:grid;grid-template-columns:1fr 1fr;gap:20px}.contact-form input,.contact-form textarea,.contact-form select{width:100%;min-width:0;border:1px solid color-mix(in srgb,var(--ink) 28%,transparent);border-radius:6px;padding:13px 14px;background:var(--background);color:var(--ink);font-size:.9rem}.contact-form textarea{resize:vertical;min-height:115px}.contact-form input::placeholder,.contact-form textarea::placeholder{color:var(--muted);opacity:1}.contact-form .button{justify-self:start}.form-note{font-size:.75rem;color:var(--muted)}[data-demo-feedback]{font-size:.9rem;border-left:3px solid var(--ink);padding-left:14px}.site-footer{width:min(1320px,calc(100% - 96px));margin:auto;padding:45px 0;display:flex;justify-content:space-between;gap:40px;border-top:1px solid color-mix(in srgb,var(--ink) 18%,transparent)}.footer-brand{font-family:var(--heading-font);font-weight:600;font-size:1.6rem}.site-footer p{font-size:.76rem;color:var(--muted);margin-top:10px}.site-footer>p{max-width:48ch;text-align:right}.family-trades .brand-symbol{border-radius:3px;background:var(--accent);color:var(--accent-ink);border-color:transparent}.family-trades h1,.family-trades h2{font-weight:800;letter-spacing:-.05em}.family-trades .layout-grid .feature-item{border-top:4px solid var(--ink)}.family-editorial h1,.family-wellness h1,.family-hospitality h1{font-weight:400}.family-wellness .hero-image{border-radius:180px 180px 30px 30px}.family-wellness .site-section{padding:110px 0}.family-wellness .item-number{font-family:Georgia,serif;font-size:1.25rem;font-weight:400}.family-hospitality .preview-notice{background:#e3aa60;color:#211d19}.family-hospitality .feature-item{border-color:#5f5143}.family-professional .site-header{min-height:95px}.family-professional h1{font-weight:700;letter-spacing:-.055em}.family-professional .eyebrow{letter-spacing:.14em}.family-general .hero-image{transform:rotate(2deg);border:9px solid var(--surface);border-radius:35px}.family-general .hero-copy h1{letter-spacing:-.055em}.composition-centered .hero-inner{display:flex;flex-direction:column;text-align:center;gap:20px;max-width:1200px}.composition-centered .hero-copy{max-width:900px;padding:15px 0 35px}.composition-centered h1{max-width:18ch;margin:auto}.composition-centered .hero-description{margin:26px auto 0;max-width:58ch}.composition-centered .eyebrow,.composition-centered .hero-actions{justify-content:center}.composition-centered .hero-image{width:100%;min-height:380px;max-height:520px;aspect-ratio:2.5;transform:none;border-radius:var(--radius)}.composition-editorial .hero-inner{grid-template-columns:.9fr 1fr;gap:40px;align-items:start}.composition-editorial .hero-copy{padding:45px 0 10px;position:relative;z-index:1}.composition-editorial h1{font-size:clamp(3rem,6.6vw,7rem);max-width:15ch}.composition-editorial .hero-image{margin-top:100px;min-height:580px}.composition-asymmetric .hero-inner{grid-template-columns:1.2fr .8fr;align-items:start;gap:30px}.composition-asymmetric .hero-image{min-height:460px;margin-top:140px;border-radius:var(--radius) 90px var(--radius) var(--radius)}.composition-asymmetric .hero-copy{padding:5px 0 80px}.composition-asymmetric h1{max-width:14ch}.composition-minimal .hero-inner{grid-template-columns:1.25fr .75fr;gap:70px;align-items:end}.composition-minimal .hero-copy{padding:30px 0 80px}.composition-minimal .hero-image{min-height:310px;align-self:end;margin-bottom:40px;border-radius:50% 50% var(--radius) var(--radius)}.composition-minimal .hero-description{max-width:48ch}.composition-immersive .site-hero{padding:0}.composition-immersive .hero-inner{width:100%;min-height:660px;position:relative;display:flex;align-items:center;padding:75px max(48px,calc((100% - 1230px)/2));background:#18201d}.composition-immersive .hero-copy{position:relative;z-index:2;max-width:820px;color:white}.composition-immersive .hero-copy .eyebrow,.composition-immersive .hero-description{color:#ffffff}.composition-immersive .hero-copy h1{max-width:14ch;text-shadow:0 2px 16px #0005}.composition-immersive .hero-image{position:absolute;inset:0;border-radius:0;min-height:0;z-index:0}.composition-immersive .hero-image:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.87),rgba(0,0,0,.5) 60%,rgba(0,0,0,.25))}.composition-immersive .hero-image figcaption{z-index:1;text-align:right;font-size:.6rem}.composition-immersive .hero-index{margin-top:0}.composition-immersive .text-link{color:white}.composition-immersive .site-header{border-bottom:0}.family-hospitality .layout-editorial .feature-item{border-top-color:var(--accent)}.family-editorial .brand-symbol{border:0;border-radius:0;font-size:2.3rem}.family-editorial .button{border-radius:0}.family-wellness .brand-symbol{border-color:var(--muted);font-family:Georgia,serif}
@media(min-width:761px) and (max-width:1100px){.site-header{gap:18px}.site-header nav{gap:14px;font-size:.76rem}.brand{max-width:220px}.hero-inner{gap:32px}.hero-image{min-height:450px}.layout-split .section-inner{gap:35px}.section-items{gap:16px}.feature-item{padding:24px 20px}}
@media(max-width:760px){html{scroll-behavior:auto}.preview-notice{font-size:.58rem;letter-spacing:.08em;padding:7px 10px}.site-header{width:calc(100% - 40px);min-height:80px;gap:16px;position:relative;z-index:10}.brand{font-size:.86rem;max-width:240px;gap:9px}.brand-symbol{flex-basis:32px;height:32px;font-size:1.1rem}.menu-toggle{display:flex;align-items:center;gap:8px;min-height:44px;padding:10px 0 10px 12px;background:none;color:var(--ink);font-size:.78rem;font-weight:700}.site-header nav{display:none;position:absolute;top:100%;left:-20px;right:-20px;background:var(--surface);color:var(--ink);padding:18px 24px 26px;border-bottom:1px solid color-mix(in srgb,var(--ink) 20%,transparent);box-shadow:0 12px 20px #0001}.site-header nav.is-open{display:grid;gap:6px}.site-header nav>a{display:block;padding:10px 4px;font-size:.9rem}.site-header nav .nav-contact{margin-top:8px;text-align:center}.site-hero{padding-top:28px}.hero-inner,.composition-editorial .hero-inner,.composition-asymmetric .hero-inner,.composition-minimal .hero-inner{width:calc(100% - 40px);display:flex;flex-direction:column;gap:18px;align-items:stretch}.hero-copy,.composition-editorial .hero-copy,.composition-asymmetric .hero-copy,.composition-minimal .hero-copy{padding:22px 0 24px}.eyebrow{font-size:.62rem;letter-spacing:.14em;margin-bottom:20px}h1,.composition-editorial h1{font-size:clamp(2.7rem,11vw,4rem);line-height:1.04;letter-spacing:-.04em;max-width:16ch}h2{font-size:2.2rem;max-width:18ch}h3{font-size:1.2rem}.hero-description{font-size:.97rem;line-height:1.75;margin-top:23px;max-width:44ch}.hero-actions{gap:21px;margin-top:26px}.button{font-size:.8rem;padding:14px 19px;min-height:50px;gap:18px}.text-link{font-size:.78rem}.hero-image,.composition-editorial .hero-image,.composition-asymmetric .hero-image,.composition-minimal .hero-image{margin:0;min-height:330px;aspect-ratio:1.12;width:100%;max-height:none;align-self:stretch;transform:none}.hero-image figcaption{font-size:.6rem}.family-general .hero-image{border-width:6px}.composition-centered .hero-inner{gap:12px}.composition-centered .hero-copy{padding-top:12px}.composition-centered .hero-image{min-height:260px;aspect-ratio:1.4}.composition-immersive .hero-inner{padding:60px 24px 95px;min-height:620px;width:100%;display:block}.composition-immersive .hero-copy{padding:0}.composition-immersive .hero-image{aspect-ratio:auto;min-height:0;position:absolute;width:100%;height:100%}.composition-immersive .hero-image:after{background:linear-gradient(90deg,#000d,#0008)}.composition-immersive h1{font-size:3.2rem}.hero-index{width:calc(100% - 40px);margin-top:25px;padding:16px 0;font-size:.58rem;letter-spacing:.09em;gap:15px}.hero-index span:first-child{max-width:70%}.site-section,.family-wellness .site-section{padding:60px 0}.section-inner{width:calc(100% - 40px)}.section-heading{margin-bottom:30px}.section-copy{font-size:.94rem;margin-top:18px}.section-items{grid-template-columns:1fr;gap:15px}.feature-item{padding:25px}.item-number{margin-bottom:24px}.feature-item p{font-size:.9rem}.layout-split .section-inner{display:flex;flex-direction:column;gap:30px;align-items:stretch}.layout-split .section-items,.layout-split .story-image+.section-items{display:block}.layout-split .section-heading{margin:0}.layout-split .feature-item{gap:20px}.layout-rows .feature-item{grid-template-columns:35px 1fr;gap:15px;padding:24px 0}.layout-rows .feature-item>div{display:block}.layout-rows .feature-item p{margin-top:12px}.layout-editorial .section-heading{margin-left:0}.layout-editorial .section-items{grid-template-columns:1fr;gap:20px}.layout-editorial .feature-item:nth-child(even){margin-top:0}.layout-timeline .section-items{display:block}.layout-timeline .feature-item{padding:26px 0 26px 25px;border-left:1px solid var(--ink);border-top:0}.layout-timeline .feature-item:before{left:-6px;top:30px}.layout-timeline .item-number{font-size:1.5rem;margin-bottom:15px}.section-statement h2{font-size:2.6rem}.faq-list summary{font-size:.92rem;padding:22px 0}.faq-list details p{font-size:.9rem;padding-right:15px}.contact-form{width:100%;gap:16px}.form-row{grid-template-columns:1fr;gap:16px}.site-footer{width:calc(100% - 40px);display:block;padding:32px 0}.site-footer>p{text-align:left;margin-top:25px}.footer-brand{font-size:1.4rem}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important;animation:none!important}}
.site-header nav{flex-wrap:wrap;justify-content:flex-end}.site-header nav>a{overflow-wrap:anywhere}.brand>span:last-child,h1,h2,h3{overflow-wrap:anywhere}.section-contact.layout-band{background:var(--ink);color:var(--background)}.section-contact.layout-band .form-note,.layout-band .faq-list details p{color:var(--background)}
`;
