/** Human calibration targets, not measured AI achievements. Use these anchors
 * consistently in reviews and keep the output under human comparative review. */
export const siteQualityRubric={
  version:2 as const,
  target:85,
  dimensionFloor:75,
  anchors:[
    {score:50,description:"A rough, inconsistent or difficult-to-use draft."},
    {score:65,description:"A clean generic template: legible but repetitive, weakly branded and not persuasive enough for a premium sales presentation."},
    {score:80,description:"Coherent and useful, with clear business relevance; one or two material presentation weaknesses remain."},
    {score:90,description:"Distinctive, business-specific and convincing: memorable opening, intentional typography, purposeful imagery, crisp copy and equally strong mobile treatment."},
    {score:100,description:"Exceptional across every visible dimension. Do not award for merely having no detected errors."},
  ],
  dimensions:{
    firstImpression:{weight:25,label:"First impression and identity",description:"A memorable, industry-appropriate opening and clear customer benefit; not a generic business-name substitution."},
    composition:{weight:20,label:"Composition and typography",description:"Deliberate type scale, spacing, contrast, density and changing rhythm without arbitrary decorative sections."},
    imagery:{weight:15,label:"Imagery and brand treatment",description:"Intentional crops and relevant visual storytelling, with clear logo treatment when an authorized asset exists. Sparse input can succeed with an intentional typographic/illustrative direction."},
    copy:{weight:15,label:"Persuasive and honest writing",description:"Specific visitor value and useful explanations; no repeated filler, inquiry instructions or visible research bureaucracy. No unsupported business facts."},
    usefulness:{weight:10,label:"Page purpose and actions",description:"Each page answers its own visitor questions. Actions describe what they do; navigation and next steps are understandable."},
    mobile:{weight:15,label:"Mobile presentation",description:"Readable hierarchy, strong crops, comfortable controls and well-composed stacking at phone width—not just absence of horizontal overflow."},
  },
};
export type SiteQualityDimension=keyof typeof siteQualityRubric.dimensions;
export const siteQualityBenchmarks=[
  {id:"cosmos-human-reference",industry:"HVAC",input:"Reference only",referenceUrl:"https://cosmos-heating-air.onrender.com",expectations:["Local, emotionally relevant hero message","Distinct logo and cream/forest identity","Varied service, story, membership and contact compositions"],caution:"Use composition and storytelling as a benchmark; the business claims, photos and testimonials require authorization/verification before reuse."},
  {id:"trades-established",industry:"Home services",input:"Confirmed service categories, company name, approved contact; no reviews or credentials",expectations:["Clear service differentiation","Useful equipment or comfort imagery","Direct call action","No invented proof"]},
  {id:"wellness-small-practice",industry:"Wellness",input:"Practice name and broad service direction; no medical outcomes, staff photos or credentials",expectations:["Calm readable hierarchy","Warm image treatment","Service descriptions without medical promises","Comfortable phone layout"]},
  {id:"hospitality-concept",industry:"Hospitality",input:"Name and proposed concept; no final menu, hours, location or booking system",expectations:["Evocative atmosphere","Purposeful visual variety","Clearly demonstrative inquiry experience","No fabricated menu prices or reservation confirmations"]},
  {id:"professional-services",industry:"Advisory",input:"Business name and confirmed service scope; no case studies or results",expectations:["Confident concise service explanation","Editorial hierarchy","Useful process detail","No invented client logos or performance numbers"]},
  {id:"sparse-new-business",industry:"Unknown / new business",input:"First name and desire for a first website only",expectations:["Intentional restrained identity","Honest concept copy","No mandatory company or website data","Unknowns kept in internal handoff","No fabricated identity or credibility"]},
] as const;
export function siteQualityAverage(scores:Record<SiteQualityDimension,number>):number {
  return Math.round((Object.keys(siteQualityRubric.dimensions) as SiteQualityDimension[]).reduce((sum,key)=>sum+scores[key]*siteQualityRubric.dimensions[key].weight,0)/100);
}
