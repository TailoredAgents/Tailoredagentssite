import type { FactoryPlanContent } from "../types";
import { designFamilies } from "./families";
import type { SiteBlueprint, SiteDesign } from "./types";

export function colorLuminance(hex:string){
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
export function contrastRatio(a:string,b:string){const x=colorLuminance(a),y=colorLuminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function readableInk(background:string){return colorLuminance(background)>.179?"#000000":"#ffffff";}

/** Labels are interpreted narrowly; colors without a semantic role remain art-direction input. */
export function approvedDesignConstraints(plan:FactoryPlanContent){
  const palette:Partial<SiteDesign["palette"]>={};
  const labeledPalette:Partial<SiteDesign["palette"]>={};
  const roleLabels:Record<string,keyof SiteDesign["palette"]>={background:"background",canvas:"background",surface:"surface",card:"surface",ink:"ink",foreground:"ink",text:"ink","body text":"ink",muted:"muted","muted text":"muted","muted body text":"muted","muted foreground":"muted","muted ink":"muted",accent:"accent","primary accent":"accent",accentsecondary:"accentSecondary","secondary accent":"accentSecondary"};
  const swatches=plan.design.palette.flatMap(label=>{const color=label.match(/#[0-9a-fA-F]{6}\b/)?.[0];return color?[{label:label.toLowerCase(),color:color.toLowerCase()}]:[];});
  const inferred:Array<{role:keyof SiteDesign["palette"];color:string}>=[];
  for(const {label,color} of swatches){
    // A leading role is authoritative. Descriptive prose such as "on its
    // surface" or "with dark text" must not reassign Muted/AccentSecondary.
    const role=label.match(/^\s*([a-z]+(?:\s+[a-z]+){0,2})\s*:/)?.[1].replace(/\s+/g," ");
    if(role&&Object.hasOwn(roleLabels,role)){labeledPalette[roleLabels[role]]=color;continue;}
    // Explicit roles win over color-name heuristics: "off-white text" is not a background.
    if(/(?:muted|secondary|subtle) (?:body )?text|muted (?:foreground|ink)/.test(label))palette.muted=color;
    else if(/(?:body )?text|\bink\b|foreground/.test(label))palette.ink=color;
    else if(/surface|card/.test(label))palette.surface=color;
    else if(/background|canvas/.test(label))palette.background=color;
    else if(/secondary|supporting|limited|highlight/.test(label))palette.accentSecondary=color;
    else if(/primary|accent/.test(label))palette.accent=color;
    else if(/teal|cobalt|royal blue/.test(label))inferred.push({role:"accent",color});
    else if(/off.white|ivory|cream/.test(label))inferred.push({role:"background",color});
    else if(/charcoal/.test(label))inferred.push({role:"ink",color});
    else if(/muted/.test(label))inferred.push({role:"muted",color});
    else if(/warm amber|gold|coral/.test(label))inferred.push({role:"accentSecondary",color});
  }
  Object.assign(palette,labeledPalette);
  // Fill only unspecified roles after every explicit entry has been considered,
  // so reordering a palette cannot let a color-name guess override its labels.
  for(const {role,color} of inferred)if(!palette[role])palette[role]=color;
  const navy=swatches.find(s=>/navy|deep blue/.test(s.label)&&!Object.values(palette).includes(s.color));
  if(navy){if(!palette.ink)palette.ink=navy.color;else if(!palette.muted)palette.muted=navy.color;}
  const type=plan.design.typography.toLowerCase();
  const typography:Partial<SiteDesign["typography"]>={};
  const font=(clause:string):SiteDesign["typography"]["heading"]|undefined=>{
    if(/humanist|trebuchet/.test(clause))return "humanist";
    if(/geometric|avenir|futura/.test(clause))return "geometric";
    if(/sans[ -]?serif|\binter\b|\barial\b|\bhelvetica\b/.test(clause))return "modern";
    if(/\bserif\b|georgia|editorial/.test(clause))return "editorial";
  };
  const clauses=type.split(/[,;.]|\s+\/\s+|\b(?:paired with|with|and|alongside|plus)\b/).map(clause=>({text:clause,font:font(clause)}));
  const heading=clauses.find(clause=>/head(?:ing|line)s?|display|titles?/.test(clause.text)&&clause.font)?.font;
  const body=clauses.find(clause=>/\bbody\b|paragraph|reading/.test(clause.text)&&clause.font)?.font;
  // Independent roles preserve serif headings paired with a sans-serif body.
  if(heading)typography.heading=heading;
  if(body==="modern"||body==="humanist")typography.body=body;
  if(!heading&&!body){const general=font(type);if(general){typography.heading=general;if(general==="modern"||general==="humanist")typography.body=general;}}
  if(/\bbold\b|\bstrong\b/.test(type))typography.weight=700;
  return {palette,typography};
}

export function defaultSiteDesign(b:SiteBlueprint):SiteDesign {
  const family=designFamilies[b.family];
  return {version:1,palette:{background:family.background,surface:family.surface,ink:family.ink,muted:family.muted,accent:b.accent,accentSecondary:b.accent},
    typography:{heading:b.fontPair,body:"modern",scale:"balanced",weight:b.fontPair==="editorial"?400:700},density:"balanced",radius:"soft",heroFocalPoint:{x:50,y:50},sectionStyles:[]};
}

/** Approved labeled choices take precedence over a model's defaults, including during repair. */
export function applyApprovedDesign(b:SiteBlueprint,plan:FactoryPlanContent):SiteBlueprint {
  const constraints=approvedDesignConstraints(plan),design=b.design||defaultSiteDesign(b);
  const palette={...design.palette,...constraints.palette};
  // A plan's light/dark background may require a matching neutral surface when none was specified.
  if(!constraints.palette.surface&&contrastRatio(palette.ink,palette.surface)<4.5)palette.surface=palette.background;
  // An unapproved helper color can be adjusted; an explicit inaccessible choice is reported by validation.
  if(!constraints.palette.muted&&[palette.background,palette.surface].some(bg=>contrastRatio(palette.muted,bg)<4.5))palette.muted=palette.ink;
  let presentation=b.presentation;
  if(presentation&&constraints.typography.heading){
    const serif=constraints.typography.heading==="editorial",themeIsSerif=presentation.fontTheme==="editorial"||presentation.fontTheme==="warm";
    if(serif&&!themeIsSerif)presentation={...presentation,fontTheme:"editorial"};
    if(!serif&&themeIsSerif)presentation={...presentation,fontTheme:constraints.typography.heading==="geometric"?"technical":"studio"};
  }
  return {...b,...(presentation?{presentation}:{}),accent:palette.accent,fontPair:constraints.typography.heading==="geometric"?"modern":constraints.typography.heading||b.fontPair,
    design:{...design,palette,typography:{...design.typography,...constraints.typography}}};
}

export function siteDesignCss(b:SiteBlueprint){
  if(!b.design)return "";
  const d=b.design,p=d.palette;
  const fonts={modern:'Arial,Helvetica,sans-serif',editorial:'Georgia,"Times New Roman",serif',humanist:'"Trebuchet MS",Arial,sans-serif',geometric:'"Avenir Next",Avenir,"Segoe UI",Arial,sans-serif'};
  const radius={square:"2px",soft:"12px",rounded:"28px"}[d.radius];
  const space={compact:{desktop:56,mobile:38},balanced:{desktop:76,mobile:50},airy:{desktop:96,mobile:62}}[d.density];
  const secondaryInk=readableInk(p.accentSecondary);
  return `:root{--background:${p.background};--surface:${p.surface};--ink:${p.ink};--muted:${p.muted};--accent:${p.accent};--accent-ink:${readableInk(p.accent)};--accent-secondary:${p.accentSecondary};--secondary-ink:${secondaryInk};--radius:${radius};--heading-font:${fonts[d.typography.heading]};--body-font:${fonts[d.typography.body]};--heading-weight:${d.typography.weight};--section-space:${space.desktop}px;--section-space-mobile:${space.mobile}px;--image-x:${d.heroFocalPoint.x}%;--image-y:${d.heroFocalPoint.y}%;--heading-size:${d.typography.scale==="expressive"?"clamp(3rem,6.2vw,6.5rem)":"clamp(2.8rem,5.2vw,5.5rem)"};}
${d.sectionStyles.map(style=>{
    // IDs/paths and colors have already passed strict structural validation.
    const selector=`body[data-page="${style.pagePath}"] #${style.sectionId}`;
    if(style.tone==="contrast")return `${selector}{--section-background:${p.ink};--section-ink:${p.background};--section-muted:${p.background};--section-surface:${p.ink};}`;
    if(style.tone==="accent")return `${selector}{--section-background:${p.accentSecondary};--section-ink:${secondaryInk};--section-muted:${secondaryInk};--section-surface:${p.accentSecondary};}`;
    return `${selector}{--section-background:${style.tone==="surface"?p.surface:p.background};--section-ink:${p.ink};--section-muted:${p.muted};--section-surface:${style.tone==="surface"?p.background:p.surface};}`;
  }).join("\n")}`;
}
