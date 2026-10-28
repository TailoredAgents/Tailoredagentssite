import type { FactoryPlanContent } from "../types";
import type { SiteIssue } from "./artifacts";
import type { SiteBlueprint } from "./types";

const normalize=(text:string)=>text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/['’]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const pageAliases=[
  ["home","homepage","welcome"],
  ["about","about us","our story","our company","who we are","our approach","approach"],
  ["services","our services","what we do","solutions","our solutions"],
  ["contact","contact us","get in touch","lets talk"],
  ["service areas","service area","areas we serve","areas served","locations","coverage"],
  ["faq","faqs","frequently asked questions","questions and answers"],
  ["portfolio","our work","projects","our projects"],
];
const alias=(title:string)=>pageAliases.findIndex(group=>group.includes(title));

/** A valid URL can still do the wrong thing. Keep these checks narrow: a link
 * offering to schedule a call may correctly open a form, but “Call Cosmo's”
 * promises the phone dialer, not another service section. */
export function actionDestinationIssue(label:string,href:string):string|null {
  const text=normalize(label);
  if(/^(?:call|dial|phone)(?: |$)/.test(text)&&!/^call ?back\b/.test(text)&&!/^tel:\+?\d/.test(href))
    return `The “${label.slice(0,100)}” action must dial the approved phone number, or use an accurate contact/inquiry label when no number is available.`;
  if(/^email(?: |$)/.test(text)&&!/^mailto:[^\s@]+@[^\s@]+/.test(href))
    return `The “${label.slice(0,100)}” action must open the approved email address, or be relabelled to match its actual destination.`;
  return null;
}

function pageMatch(plannedTitle:string,page:SiteBlueprint["pages"][number]):number {
  const wanted=normalize(plannedTitle),title=normalize(page.title),path=normalize(page.path.replace(/\/?index\.html$/,""))||"home";
  if(alias(wanted)===0&&page.path!=="index.html")return 0;
  if(wanted===title)return 3;
  if(wanted===path)return 2;
  return alias(wanted)!==-1&&[title,path].some(value=>alias(value)===alias(wanted))?1:0;
}

/** Distinct approved pages must have distinct matches, even when both use a common alias. */
function plannedPageCoverage(blueprint:SiteBlueprint,plan:FactoryPlanContent):{missing:string[];unexpected:string[]} {
  const matches=new Map<number,number>();
  const candidates=plan.pages.slice(0,10).map(planned=>blueprint.pages.map((page,index)=>({index,score:pageMatch(planned.title,page)})).filter(candidate=>candidate.score>0).sort((a,b)=>b.score-a.score));
  const assign=(plannedIndex:number,seen:Set<number>):boolean=>{
    for(const {index} of candidates[plannedIndex]){
      if(seen.has(index))continue;
      seen.add(index);
      const existing=matches.get(index);
      if(existing===undefined||assign(existing,seen)){matches.set(index,plannedIndex);return true;}
    }
    return false;
  };
  const missing=plan.pages.slice(0,10).filter((_,index)=>!assign(index,new Set())).map(page=>page.title);
  return {missing,unexpected:blueprint.pages.filter((_,index)=>!matches.has(index)).map(page=>page.title)};
}

/** Every rendered copy field is included; generated factualClaims are not the source of truth. */
export function publicSiteCopy(blueprint:SiteBlueprint):Array<{page:string;text:string}> {
  return blueprint.pages.map(page=>({page:page.path,text:[
    blueprint.brandName,blueprint.tagline,blueprint.heroImage.alt,blueprint.heroImage.caption,
    ...(blueprint.media||[]).flatMap(media=>[media.alt,media.caption]),
    page.title,page.description,...Object.values(page.hero),
    ...page.sections.flatMap(section=>[section.eyebrow,section.title,section.body,...section.items.flatMap(item=>[item.title,item.body])]),
    ...(blueprint.interactions?.forms.filter(f=>f.pagePath===page.path).map(f=>f.submitLabel)||[]),
    ...(blueprint.interactions?.actions.filter(a=>a.pagePath===page.path).map(a=>a.label)||[]),
    ...Object.values(blueprint.contact).filter((value):value is string=>value!==null),
  ].filter(Boolean).join("\n")}));
}

function substantiveBlocks(page:SiteBlueprint["pages"][number]):string[] {
  return page.sections.filter(section=>section.kind!=="contact").flatMap(section=>[section.body,...section.items.map(item=>item.body)])
    .map(normalize).filter(text=>{
      const words=text.split(" ").length;
      // Repeating a short contact invitation is useful; it is not a duplicated service page.
      return words>=7&&!(words<40&&/\b(contact us|get in touch|start a conversation|call us|request a quote)\b/.test(text));
    });
}
function shingles(blocks:string[]):Set<string> {
  const result=new Set<string>();
  for(const block of blocks){const words=block.split(" ");for(let i=0;i<=words.length-4;i++)result.add(words.slice(i,i+4).join(" "));}
  return result;
}
function repeatedContent(a:string[],b:string[]):boolean {
  if(!a.length||!b.length)return false;
  if(a.join("|")===b.join("|"))return true;
  const aa=shingles(a),bb=shingles(b),minimum=Math.min(aa.size,bb.size);
  // Multiple substantial blocks must overlap. A shared intro or closing CTA is insufficient.
  if(minimum<40||Math.min(a.length,b.length)<2)return false;
  let overlap=0;for(const value of aa)if(bb.has(value))overlap++;
  return overlap/minimum>=0.82;
}

// Narrow patterns catch conspicuous claims, not every possible fact. Semantic review compares
// the entire public copy with the plan; ordinary industry concepts stay permissible.
const concreteClaimPatterns=[
  /\b(?:licensed|certified|accredited|insured|bonded)\b/gi,
  /(?:\$\s*\d[\d,]*(?:\.\d{1,2})?|\b\d+(?:\.\d+)?\s*%)/g,
  /\b\d+(?:\.\d+)?\s*[- ]?(?:star(?:s| rated)?|out of (?:5|five))\b/gi,
  /\b(?:five|four)[- ]star(?: rated)?\b/gi,
  /\b\d[\d,]*\+?\s+(?:(?:happy|satisfied|completed|verified)\s+)?(?:customers|clients|projects|reviews)\b/gi,
  /\b\d+\+?\s+years?\s+(?:(?:of|in)\s+)?(?:experience|business|service)\b/gi,
  /\b(?:founded|established|serving since|since)\s+(?:in\s+)?(?:19|20)\d{2}\b/gi,
  /\b24\s*[/x]\s*7\b/gi,
];
function sentences(text:string):string[]{return text.split(/(?<=[.!?])(?:\s+|$)|\n+/).filter(Boolean);}
const normalizeClaim=(text:string)=>normalize(text.replace(/\$/g," dollars ").replace(/%/g," percent "))
  .replace(/\b(founded|established)( in)? (?=(?:19|20)\d{2}\b)/g,"since ")
  .replace(/\bserving since\b/g,"since")
  .replace(/\byears? (?:(?:of|in) )?(?:experience|business|service)\b/g,"years experience")
  .replace(/\b(?:out of (?:5|five)|star rated|stars?)\b/g,"star");
function concreteClaims(text:string):RegExpMatchArray[]{return concreteClaimPatterns.flatMap(pattern=>[...text.matchAll(pattern)]);}

/** Qualification belongs to the claim, not any occurrence of "no" or a question
 * mark elsewhere in its sentence. This deliberately narrow check supplements
 * semantic review; it is not a general-purpose factual or grammar parser. */
function qualifiedClaim(sentence:string,claim:RegExpMatchArray):boolean {
  const start=claim.index!,end=start+claim[0].length;
  const boundaries=[...sentence.matchAll(/[,;]|\b(?:but|while|although|however)\b/gi)];
  const left=boundaries.filter(match=>match.index!<start).at(-1),right=boundaries.find(match=>match.index!>=end);
  const before=sentence.slice(left?left.index!+left[0].length:0,start),after=sentence.slice(end,right?.index??sentence.length);
  // A negation can qualify a coordinated list ("not licensed or insured"), but
  // it cannot reach through unrelated prose ("no fuss with licensed staff").
  const withoutClaims=(value:string)=>concreteClaimPatterns.reduce((result,pattern)=>result.replace(pattern," "),value);
  const prefix=normalize(withoutClaims(before)),suffix=normalize(withoutClaims(after));
  if(/\b(?:not|no|no longer|never|isnt|arent|wasnt|werent)(?:\s+(?:currently|yet|fully|and|or))*(?:\s+an?)?$/.test(prefix))return true;
  if(/\b(?:unconfirmed|unverified|unknown|pending|illustrative|hypothetical)(?:\s+(?:claim|figure|price|pricing|rate|fee|discount|rating|credentials?|availability|and|or))*$/.test(prefix))return true;
  if(/^(?:example|sample|placeholder)(?:\s+(?:claim|figure|price|pricing|rate|fee|discount|rating|credentials?|availability|and|or))*$/.test(prefix))return true;
  if(/^(?:and |or )*(?:(?:status|credentials?|coverage|availability|service|pricing|price|cost|rate|claim|figure|amount) )?(?:(?:is|are|remains?|still) )*(?:unconfirmed|unverified|unknown|pending|awaiting confirmation|not confirmed|not verified|(?:has|have) not (?:yet )?been (?:confirmed|verified)|needs confirmation|requires confirmation|must be confirmed)\b/.test(suffix))return true;
  if(/\b(?:ask|check|confirm) (?:about|whether|if)\b/.test(prefix)&&! /\b(?:our|your|their|its)\b/.test(prefix))return true;
  // A direct availability/credential question is not an assertion. Possessive
  // claims inside a question ("Are our 500 customers happy?") still are.
  const clause=sentence.slice(left?left.index!+left[0].length:0,right?.index??sentence.length).trim();
  if(clause.endsWith("?")&&((/^(?:is|are|am|was|were|does|do|did|can|could|would|will|has|have)\b/.test(prefix)&&! /\b(?:our|your|their|its)\b/.test(prefix)&&! /\b(?:the|this|those)\s*$/.test(prefix))||normalize(clause)===normalize(claim[0])))return true;
  return false;
}
function unsupportedClaims(text:string,plan:FactoryPlanContent):string[]{
  const evidence=new Set(plan.knownDetails.filter(detail=>detail.basis==="submitted"||detail.basis==="sourced")
    .flatMap(detail=>sentences(detail.value)).flatMap(sentence=>concreteClaims(sentence).filter(claim=>!qualifiedClaim(sentence,claim)).map(claim=>normalizeClaim(claim[0]))));
  const unsupported=new Set<string>();
  for(const sentence of sentences(text)){
    for(const match of concreteClaims(sentence)){
      if(qualifiedClaim(sentence,match))continue;
      const value=normalizeClaim(match[0]);
      if(!evidence.has(value))unsupported.add(match[0]);
    }
  }
  return [...unsupported];
}

const usefulSection=(section:SiteBlueprint["pages"][number]["sections"][number])=>section.kind!=="contact"&&!!section.title.trim()&&(normalize(section.body).split(" ").length>=12||section.items.some(item=>normalize(item.body).split(" ").length>=12));

/** An intentional overview may lead to an approved detail page instead of a
 * contact channel. Count only a real configured link to distinct useful copy;
 * a self-link, missing target or unsupported Call label is not a next step. */
function hasUsefulDetailAction(blueprint:SiteBlueprint,page:SiteBlueprint["pages"][number],plan:FactoryPlanContent):boolean {
  return (blueprint.interactions?.actions||[]).some(action=>{
    if(action.pagePath!==page.path||action.targetPage===page.path)return false;
    const source=page.sections.find(section=>section.id===action.sectionId),target=blueprint.pages.find(candidate=>candidate.path===action.targetPage);
    if(!source||!["services","features","contact"].includes(source.kind)||!source.items[action.itemIndex]||!target||!plan.pages.some(planned=>pageMatch(planned.title,target)>0)||actionDestinationIssue(action.label,action.targetPage))return false;
    const destinations=action.targetSection?target.sections.filter(section=>section.id===action.targetSection):target.sections;
    const sourceCopy=new Set([source.body,...source.items.map(item=>item.body)].map(normalize));
    return destinations.some(section=>usefulSection(section)&&[section.body,...section.items.map(item=>item.body)].map(normalize).some(copy=>copy.split(" ").length>=12&&!sourceCopy.has(copy)));
  });
}

/** Structural/content checks supplement visual and semantic review; they cannot judge aesthetics. */
export function reviewSiteDepth(blueprint:SiteBlueprint,plan:FactoryPlanContent):SiteIssue[] {
  const issues:SiteIssue[]=[];
  const add=(page:string,code:string,message:string)=>issues.push({page,code,message,severity:"error"});
  const {missing,unexpected}=plannedPageCoverage(blueprint,plan);
  if(missing.length)add("index.html","missing_planned_pages",`Include distinct pages for these approved page identities: ${missing.join(", ")}. A different page with the same total count does not satisfy the plan.`);
  if(unexpected.length)add("index.html","unexpected_planned_pages",`Remove pages outside the approved plan: ${unexpected.join(", ")}. Keep the distinct approved page identities; adding another page requires a revised human-approved plan.`);
  const directChannel=[blueprint.contact.email,blueprint.contact.phone].some(value=>value&&plan.knownDetails.some(detail=>["submitted","sourced"].includes(detail.basis)&&detail.value.toLowerCase().includes(value.toLowerCase())));
  const forms=(blueprint.interactions?.forms||[]).filter(form=>blueprint.pages.some(page=>page.path===form.pagePath&&page.sections.some(section=>section.id===form.sectionId&&section.kind==="contact")));
  const previous:Array<{path:string;blocks:string[]}>=[];
  for(const page of blueprint.pages){
    const sections=page.sections.filter(s=>s.kind!=="contact");
    // An approved contact/coverage page can be a focused inquiry utility, not a second sales page.
    // Count substantive form/direct-contact guidance only there; a form cannot exempt a thin service page.
    const inquiryPage=page.path!=="index.html"&&plan.pages.some(p=>[3,4].includes(alias(normalize(p.title)))&&pageMatch(p.title,page)>0)
      &&(directChannel||forms.some(form=>form.pagePath===page.path));
    const usefulContacts=inquiryPage?page.sections.filter(s=>s.kind==="contact"&&s.title.trim()&&normalize(s.body).split(" ").length>=12).length:0;
    const usefulSections=sections.filter(usefulSection);
    // Purpose takes precedence over a prescribed section count. A focused form
    // page or one substantial service presentation can be complete. Home needs
    // enough distinct material to introduce the offer and help a visitor decide.
    // A concise Home can explain the offer in its introduction, develop it in
    // one useful section and provide a real next step. Do not require an extra
    // decorative section, or let a generic heading and dead contact CTA pass.
    const introduction=normalize(page.hero.body),distinctIntroduction=introduction.split(" ").length>=12&&!sections.some(section=>[section.body,...section.items.map(item=>item.body)].some(body=>normalize(body)===introduction));
    const focusedHome=usefulSections.length===1&&distinctIntroduction&&(directChannel||forms.length>0||hasUsefulDetailAction(blueprint,page,plan));
    const complete=page.path==="index.html"?usefulSections.length>=2||focusedHome:usefulSections.length>0||usefulContacts>0;
    if(!complete)add(page.path,"thin_page",page.path==="index.html"?"The homepage needs useful material explaining the offer and helping a visitor decide on a next step. Add missing reader value, not extra sections or words for a quota.":"This page does not yet fulfil its approved purpose. Add a useful explanation, service detail or focused inquiry utility; a section count alone is not a quality target.");
    for(const section of sections){
      if(["services","features","process","faq"].includes(section.kind)&&section.items.length===0)
        add(page.path,"empty_collection",`The ${section.id} section has no useful items. Supply the content its purpose requires or choose a suitable prose section.`);
    }
    const blocks=substantiveBlocks(page),duplicate=previous.find(other=>repeatedContent(blocks,other.blocks));
    if(duplicate)add(page.path,"repeated_page",`Most substantive copy repeats ${duplicate.path}, even if headings differ. Give this page a distinct purpose and useful content from the approved plan.`);
    previous.push({path:page.path,blocks});
    if("presentation" in blueprint){
      const substantial=sections.flatMap(section=>[section.body,...section.items.map(item=>item.body)]).map(normalize).filter(body=>body.split(" ").length>=12);
      const repeated=([...new Set(substantial)]).filter(body=>substantial.filter(value=>value===body).length>=3);
      if(repeated.length)add(page.path,"repeated_padding","Three or more content blocks repeat the same explanation. Give each retained block a distinct visitor purpose or remove the repetition.");
      const publicSections=sections.map(section=>[section.title,section.body,...section.items.map(item=>item.body)].join(" "));
      if(publicSections.filter(copy=>/\b(?:awaiting confirmation|pending confirmation|details (?:remain|are) unconfirmed|before making (?:any )?arrangements|prepare (?:for|an?|your) (?:inquiry|conversation))\b/i.test(copy)).length>=3)
        add(page.path,"uncertainty_dominates_copy","Internal uncertainty or inquiry-preparation instructions dominate several sections. Keep honest general explanations and customer benefits public, and move unresolved factual details into the internal handoff without inventing claims.");
    }
  }
  for(const copy of publicSiteCopy(blueprint)){
    const unsupported=unsupportedClaims(copy.text,plan);
    if(unsupported.length)add(copy.page,"unsupported_concrete_claim",`Public copy contains concrete claims absent from confirmed/submitted plan facts: ${unsupported.slice(0,8).join("; ")}. Remove or accurately qualify them; do not invent evidence.`);
  }
  return issues;
}
