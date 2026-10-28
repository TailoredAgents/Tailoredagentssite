/** Frozen synthetic renderer cohort. It exercises approved render inputs, not
 * research accuracy, AI generation or unattended production completion. */
import {factoryBenchmarkCases,type FactoryBenchmarkCase} from "./benchmark-fixtures";

export const qualityCohortVersion="2026-10-28-v1";
export const qualityBaselineRevision="194da47fa5e906caed55634ccf9bd8bbde6c7a35";
export const qualityCohortManifest=[
  {id:"trades-established",split:"tuning",industry:"trades",conditions:["established-service-scope","missing-logo","multiple-pages"]},
  {id:"wellness-small-practice",split:"tuning",industry:"wellness",conditions:["missing-logo","no-credentials","no-health-promises"]},
  {id:"hospitality-concept",split:"tuning",industry:"hospitality",conditions:["no-hours-location-menu","missing-logo","dark-palette"]},
  {id:"professional-services",split:"tuning",industry:"professional",conditions:["no-case-studies","missing-logo","minimal-composition"]},
  {id:"sparse-new-business",split:"tuning",industry:"unknown",conditions:["no-website","no-company","no-phone","no-location","little-copy"]},
  {id:"trades-compact-first-site",split:"held-out",industry:"trades",conditions:["contrasting-same-industry-brief","no-website","short-copy","no-photo"]},
  {id:"professional-long-name",split:"held-out",industry:"professional",conditions:["long-public-name","missing-logo","nested-pages"]},
  {id:"hospitality-ambiguous-match",split:"held-out",industry:"hospitality",conditions:["ambiguous-company-match","candidate-facts-excluded","no-logo"]},
  {id:"unknown-company-none",split:"held-out",industry:"unknown",conditions:["company-None","no-website","no-logo","no-contact","very-little-copy"]},
  {id:"wellness-rich-content",split:"held-out",industry:"wellness",conditions:["substantial-existing-content","supplied-logo","multiple-page-purposes"]},
] as const;

export function qualityCohortCases():FactoryBenchmarkCase[]{
  const cases=factoryBenchmarkCases();
  const clone=(id:string,newId:string,label:string)=>({...structuredClone(cases.find(item=>item.id===id)!),id:newId,label});
  const compact=clone("trades-established","trades-compact-first-site","Northline: compact first-site direction");
  compact.blueprint.composition="split";compact.blueprint.design!.density="compact";compact.blueprint.design!.radius="square";compact.blueprint.design!.sectionStyles=[];
  compact.blueprint.presentation!.fontTheme="technical";compact.blueprint.presentation!.sectionImages=[];compact.blueprint.media=[];
  compact.blueprint.pages=compact.blueprint.pages.slice(0,1);compact.blueprint.pages[0].sections=compact.blueprint.pages[0].sections.slice(0,1);
  compact.blueprint.pages[0].sections[0].layout="rows";
  compact.blueprint.pages[0].hero={eyebrow:"Home comfort, explained simply",headline:"Get to the heart of your heating or cooling question.",body:"Tell us what has changed at home. Explore the relevant service, then call to discuss the next step.",primaryCta:"Call Northline",secondaryCta:"Explore services"};
  compact.blueprint.presentation!.heroEmphasis=null;compact.blueprint.interactions={version:1,forms:[],actions:[]};
  compact.plan.pages=compact.plan.pages.slice(0,1);compact.plan.pages[0].sections=["Services"];
  compact.plan.summary="Synthetic contrasting HVAC brief: first site, direct practical copy, compact technical typography, one page and no supplied photography.";
  compact.expected=["Meaningfully different from the established immersive HVAC brief","Compact direct service-first presentation","No requirement for an existing website or photography"];

  const long=clone("professional-services","professional-long-name","Long advisory public identity");
  long.blueprint.brandName="The Westbridge Collective for Independent Business Strategy & Organizational Development";
  long.plan.knownDetails[0].value=`Approved synthetic public identity: ${long.blueprint.brandName}. Advisory service scope remains unchanged.`;
  long.expected=["Long identity remains legible without horizontal overflow","Readable navigation and card title","Nested pages preserve identity"];

  const ambiguous=clone("hospitality-concept","hospitality-ambiguous-match","Ambiguous hospitality match");
  ambiguous.blueprint.brandName="Gathering House · Concept";
  ambiguous.plan.summary="Synthetic team-approved hospitality concept. Two similarly named directory matches exist; neither identity, address, hours nor menu is confirmed. Use only this provisional public concept name.";
  ambiguous.plan.knownDetails=[{label:"Team direction",value:"A warm shared-table hospitality concept with the public working title Gathering House · Concept.",basis:"submitted",sourceIds:[]}];
  ambiguous.expected=["Candidate directory identities are not presented as business facts","No invented address, opening hours, menu or logo","Coherent provisional identity"];

  const none=clone("sparse-new-business","unknown-company-none","Company None with minimal brief");
  none.blueprint.brandName="Your next chapter";none.blueprint.tagline="An idea taking shape";
  none.blueprint.pages[0].sections=none.blueprint.pages[0].sections.slice(0,1);
  none.plan.pages[0].sections=["Introduction"];
  none.plan.summary="Synthetic intake: company name None, no website, unknown industry, no logo, no public contact or location. Human-approved public concept title: Your next chapter.";
  none.plan.knownDetails=[{label:"Team direction",value:"A simple first website concept called Your next chapter. Company entry None is missing information, not the public identity.",basis:"submitted",sourceIds:[]}];
  none.expected=["None is not published as the company identity","No personal lead data is invented or exposed","Useful restrained presentation despite minimal content"];

  const rich=clone("wellness-small-practice","wellness-rich-content","Wellness with substantial approved content");
  rich.blueprint.media!.push({id:"mark",role:"logo",source:"provided",uploadId:"synthetic-approved-mark",prompt:"",alt:"Stillwell concept mark",caption:""});
  rich.blueprint.presentation!.logoAssetId="mark";
  rich.blueprint.pages[1].sections.push({id:"preparing-a-session",kind:"process",layout:"timeline",eyebrow:"Before your first conversation",title:"Make room for the experience you want.",body:"A useful introduction starts with preferences, not a perfect routine. Think about the time you can set aside, the pace you enjoy and the kind of space where you feel comfortable. These details help frame a conversation about the proposed experience.",items:[{title:"Notice your rhythm",body:"Consider which parts of the week feel most crowded and where a quieter pause might fit. There is no required schedule to bring into the conversation."},{title:"Bring your preferences",body:"Share the activities and settings you enjoy. Familiar examples can explain what feels welcoming more clearly than a long list of goals."},{title:"Ask practical questions",body:"Discuss the proposed format and what would help you feel prepared. Availability and any final service arrangements belong in the direct conversation with the business."}]});
  rich.plan.pages[1].sections.push("Preparing a session");
  rich.plan.summary="Synthetic approved wellness brief with substantial existing service and session-preparation content plus an authorized geometric concept logo. Preserve distinct page purposes and readable depth.";
  rich.expected=["Substantial copy remains readable without empty oversized sections","Approved logo retains its aspect ratio","Service and process content serve different purposes"];
  return [...cases,compact,long,ambiguous,none,rich];
}

/** An explicitly synthetic supplied logo, not a scraped or generated business mark. */
export const qualityCohortLogo='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240"><rect width="640" height="240" rx="30" fill="#343e32"/><path d="M90 175V95a55 55 0 0 1 110 0v80M116 175V100a29 29 0 0 1 58 0v75" fill="none" stroke="#f5f1e9" stroke-width="15"/><path d="M260 83h280M260 120h210M260 157h245" stroke="#f5f1e9" stroke-width="16" stroke-linecap="round"/></svg>';
