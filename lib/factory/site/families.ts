import type { DesignFamilyId,HeroComposition } from "./types";
import type { FactoryPlanContent } from "../types";
export type DesignFamily={name:string;direction:string;compositions:readonly HeroComposition[];background:string;surface:string;ink:string;muted:string;accent:string;radius:string;sectionRhythm:string};
export const designFamilies:Record<DesignFamilyId,DesignFamily>={
  trades:{name:"Built with purpose",direction:"A recognizable local business, not a contractor template. Lead with the customer's desired outcome and a confident photograph or clearly illustrative scene. Follow approved typography; studio or technical is only a possible starting point. Use the real logo if supplied. Practical clear services and easy contact, never fabricated badges or reviews.",compositions:["split","immersive","framed"],background:"#f3f1e9",surface:"#ffffff",ink:"#172825",muted:"#475852",accent:"#c9ed63",radius:"6px",sectionRhythm:"Optional treatments, only where the approved page purpose and available content justify them: immersive or decisive split opening, interactive service collection with supplied photos, alternating company story, concise process, contrasting contact invitation"},
  editorial:{name:"Independent perspective",direction:"A distinctive studio journal. Editorial or warm type with a short expressive headline, deliberate asymmetry and artful image crops. Make the work itself the focal point through authorized project imagery. Use wide and narrow compositions in contrast, not a succession of identical cards.",compositions:["editorial","asymmetric","framed"],background:"#f7f2eb",surface:"#fffdf8",ink:"#302820",muted:"#665449",accent:"#b95c37",radius:"2px",sectionRhythm:"Optional treatments, only where the approved page purpose and available content justify them: asymmetric introduction, image-grid portfolio or services, alternating feature stories, short statement, restrained inquiry section"},
  wellness:{name:"A gentler pace",direction:"A personal sanctuary. Consider warm type, natural tones and reassuring copy when they fit the approved direction. Provide a booking/inquiry destination only when supported. Demonstrate the experience through atmosphere and actual supplied work. Avoid medical outcomes, invented credentials and exaggerated transformation promises.",compositions:["centered","split","framed"],background:"#f4f0e8",surface:"#fffdf7",ink:"#283f35",muted:"#526257",accent:"#b5c8aa",radius:"28px",sectionRhythm:"Optional treatments, only where the approved page purpose and available content justify them: calm centered opening, softly framed image-grid offerings, intimate split story, useful first-visit guidance, simple booking invitation"},
  hospitality:{name:"Worth gathering for",direction:"An invitation to an experience. Atmospheric immersive photography, rich editorial type, warm contrast, sensory concise copy and a useful next action within the approved preview capabilities. Use supplied food, place and room photographs only for real offerings; generated scenes remain illustrative. Do not invent menus, prices or opening hours.",compositions:["immersive","editorial"],background:"#211d19",surface:"#302a24",ink:"#fff7e9",muted:"#d4c7b4",accent:"#e3aa60",radius:"3px",sectionRhythm:"Optional treatments, only where the approved page purpose and available content justify them: cinematic opening, alternating experience features, menu-like rows, intimate story, practical visit/contact information"},
  professional:{name:"Clarity creates confidence",direction:"A premium advisory practice. Studio or technical typography, generous but purposeful whitespace, a precise customer-centered promise and restrained geometric composition. Present the approach and expertise clearly using confirmed facts. No invented certifications, clients or performance statistics.",compositions:["minimal","asymmetric","framed"],background:"#eef2f7",surface:"#ffffff",ink:"#172b46",muted:"#50617a",accent:"#3769b2",radius:"12px",sectionRhythm:"Optional treatments, only where the approved page purpose and available content justify them: concise asymmetric or minimal opening, service rows or service-tabs, split philosophy, compact process, high-contrast consultation section"},
  general:{name:"Room to grow",direction:"A distinct identity even with sparse inputs. Use a typographic wordmark, a specific audience benefit, one clear visual idea and expressive but restrained color. Frame a useful offering without inventing company history. Choose only sections that support the customer's next step; avoid filler inquiries and repetitive instructions.",compositions:["centered","minimal"],background:"#f4f3ee",surface:"#ffffff",ink:"#263031",muted:"#556262",accent:"#c5cfef",radius:"18px",sectionRhythm:"Optional treatments, only where the approved page purpose and available content justify them: confident centered introduction, varied image-led offerings when supported, a short purposeful story, clear next step"},
};
export function familyForPlan(text:string):DesignFamilyId {
  // Website redesign is the requested work, not the customer's industry.
  text=text.replace(/\b(?:website|web|site)\s+(?:re)?design\b|\bredesign\w*/gi,"");
  const terms:Array<[DesignFamilyId,RegExp]>=[
    ["trades",/\b(?:roof(?:ing|ers?)?|plumb(?:ing|ers?)?|hvac|heating|air[\s-]+conditioning|cooling|heat[\s-]+pumps?|contractors?|landscap(?:e|es|ing|ers?)|construction|remodel(?:ing|ers?)?|electricians?|lawn[\s-]+care|mowing)\b/i],
    ["wellness",/\b(?:spas?|salons?|wellness|beauty|yoga|massage|esthetics?|aesthetics?|estheticians?|aestheticians?)\b/i],
    ["hospitality",/\b(?:restaurants?|caf[eé]s?|coffee|baker(?:y|ies)|hotels?|hospitality|catering)\b/i],
    ["professional",/\b(?:law|lawyers?|attorneys?|accountants?|accounting|consult(?:ing|ants?|ancy)|financial|insurance|professional[\s-]+services?)\b/i],
  ];
  const matches=terms.filter(([,pattern])=>pattern.test(text));
  // Mixed business/audience hints cannot establish which industry owns the site.
  if(matches.length>1)return"general";
  if(matches.length===1)return matches[0][0];
  if(/\b(?:design|studios?|photograph(?:y|ers?)?|creative|interiors?|architecture|architects?)\b/i.test(text))return"editorial";
  return"general";
}

/** A historical-plan suggestion, never an approved identity or binding recipe.
 * Candidate matches and assumptions cannot choose the customer's industry. */
export function familyHintForPlan(plan:Pick<FactoryPlanContent,"knownDetails"|"goal"|"audience">):DesignFamilyId {
  const facts=plan.knownDetails.filter(detail=>detail.basis==="submitted"||detail.basis==="sourced");
  const industry=facts.filter(detail=>/^(?:industry|sector|business type|company type)$/i.test(detail.label.trim()));
  if(industry.length)return familyForPlan(industry.map(detail=>detail.value).join(" "));
  const known=familyForPlan(facts.map(detail=>detail.value).join(" "));
  return known!=="general"?known:familyForPlan(`${plan.goal} ${plan.audience}`);
}
