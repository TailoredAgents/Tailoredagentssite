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

function pageMatch(plannedTitle:string,page:SiteBlueprint["pages"][number]):number {
  const wanted=normalize(plannedTitle),title=normalize(page.title),path=normalize(page.path.replace(/\/?index\.html$/,""))||"home";
  if(alias(wanted)===0&&page.path!=="index.html")return 0;
  if(wanted===title)return 3;
  if(wanted===path)return 2;
  return alias(wanted)!==-1&&[title,path].some(value=>alias(value)===alias(wanted))?1:0;
}

/** Distinct approved pages must have distinct matches, even when both use a common alias. */
function missingPages(blueprint:SiteBlueprint,plan:FactoryPlanContent):string[] {
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
  return plan.pages.slice(0,10).filter((_,index)=>!assign(index,new Set())).map(page=>page.title);
}

/** Every rendered copy field is included; generated factualClaims are not the source of truth. */
export function publicSiteCopy(blueprint:SiteBlueprint):Array<{page:string;text:string}> {
  return blueprint.pages.map(page=>({page:page.path,text:[
    blueprint.brandName,blueprint.tagline,blueprint.heroImage.alt,blueprint.heroImage.caption,
    page.title,page.description,...Object.values(page.hero),
    ...page.sections.flatMap(section=>[section.eyebrow,section.title,section.body,...section.items.flatMap(item=>[item.title,item.body])]),
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
const uncertain=/\?|\b(?:not|no|unconfirmed|unverified|unknown|pending|awaiting|illustrative|example|sample|placeholder|confirm|confirmation|whether|ask about|ask if)\b/i;
function sentences(text:string):string[]{return text.split(/(?<=[.!?])(?:\s+|$)|\n+/).filter(Boolean);}
const normalizeClaim=(text:string)=>normalize(text.replace(/\$/g," dollars ").replace(/%/g," percent "))
  .replace(/\b(founded|established)( in)? (?=(?:19|20)\d{2}\b)/g,"since ")
  .replace(/\bserving since\b/g,"since")
  .replace(/\byears? (?:(?:of|in) )?(?:experience|business|service)\b/g,"years experience")
  .replace(/\b(?:out of (?:5|five)|star rated|stars?)\b/g,"star");
function unsupportedClaims(text:string,plan:FactoryPlanContent):string[]{
  const evidence=plan.knownDetails.filter(detail=>detail.basis==="submitted"||detail.basis==="sourced")
    .flatMap(detail=>sentences(detail.value)).filter(sentence=>!uncertain.test(sentence)).map(normalizeClaim);
  const unsupported=new Set<string>();
  for(const sentence of sentences(text)){
    if(uncertain.test(sentence))continue;
    for(const pattern of concreteClaimPatterns)for(const match of sentence.matchAll(pattern)){
      const value=normalizeClaim(match[0]);
      if(!evidence.some(fact=>` ${fact} `.includes(` ${value} `)))unsupported.add(match[0]);
    }
  }
  return [...unsupported];
}

/** Structural/content checks supplement visual and semantic review; they cannot judge aesthetics. */
export function reviewSiteDepth(blueprint:SiteBlueprint,plan:FactoryPlanContent):SiteIssue[] {
  const issues:SiteIssue[]=[];
  const add=(page:string,code:string,message:string)=>issues.push({page,code,message,severity:"error"});
  const missing=missingPages(blueprint,plan);
  if(missing.length)add("index.html","missing_planned_pages",`Include distinct pages for these approved page identities: ${missing.join(", ")}. A different page with the same total count does not satisfy the plan.`);
  const previous:Array<{path:string;blocks:string[]}>=[];
  for(const page of blueprint.pages){
    const sections=page.sections.filter(s=>s.kind!=="contact");
    const minimum=page.path==="index.html"?4:2;
    if(sections.length<minimum) add(page.path,"thin_page",`Provide at least ${minimum} useful non-contact sections on this page; use approved services, explanatory guidance, process and relevant questions rather than padding.`);
    for(const section of sections){
      if(["services","features","process","faq"].includes(section.kind)&&section.items.length<2)
        add(page.path,"empty_collection",`The ${section.id} section needs at least two useful items or a more suitable section type.`);
    }
    const blocks=substantiveBlocks(page),duplicate=previous.find(other=>repeatedContent(blocks,other.blocks));
    if(duplicate)add(page.path,"repeated_page",`Most substantive copy repeats ${duplicate.path}, even if headings differ. Give this page a distinct purpose and useful content from the approved plan.`);
    previous.push({path:page.path,blocks});
    if(sections.length>=4&&new Set(sections.map(s=>s.layout)).size<3)
      add(page.path,"repeated_layout","Use at least three complementary section layouts for this page instead of repeating the same treatment throughout.");
  }
  for(const copy of publicSiteCopy(blueprint)){
    const unsupported=unsupportedClaims(copy.text,plan);
    if(unsupported.length)add(copy.page,"unsupported_concrete_claim",`Public copy contains concrete claims absent from confirmed/submitted plan facts: ${unsupported.slice(0,8).join("; ")}. Remove or accurately qualify them; do not invent evidence.`);
  }
  return issues;
}
