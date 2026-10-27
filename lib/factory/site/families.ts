import type { DesignFamilyId,HeroComposition } from "./types";
export type DesignFamily={name:string;direction:string;compositions:readonly HeroComposition[];background:string;surface:string;ink:string;muted:string;accent:string;radius:string;sectionRhythm:string};
export const designFamilies:Record<DesignFamilyId,DesignFamily>={
  trades:{name:"Built with purpose",direction:"Architectural, direct and assured. Oversized practical headlines, numbered services, strong photography and clear estimates. Avoid generic stock trust badges.",compositions:["split","immersive","framed"],background:"#f3f1e9",surface:"#ffffff",ink:"#172825",muted:"#475852",accent:"#c9ed63",radius:"6px",sectionRhythm:"service rows, numbered process and a bold contact band"},
  editorial:{name:"Independent perspective",direction:"Magazine-like and expressive. Large serif headlines, asymmetrical image crop, narrow editorial copy and generous whitespace. Curated rather than corporate.",compositions:["editorial","asymmetric","framed"],background:"#f7f2eb",surface:"#fffdf8",ink:"#302820",muted:"#665449",accent:"#b95c37",radius:"2px",sectionRhythm:"alternating editorial features and statement sections"},
  wellness:{name:"A gentler pace",direction:"Calm, tactile and personal. Airy serif typography, muted natural colors, softly curved imagery and clear service descriptions. Avoid medical outcome promises.",compositions:["centered","split","framed"],background:"#f4f0e8",surface:"#fffdf7",ink:"#283f35",muted:"#526257",accent:"#b5c8aa",radius:"28px",sectionRhythm:"spacious split stories, small service collections and simple booking guidance"},
  hospitality:{name:"Worth gathering for",direction:"Warm, immersive and sensory. Deep backgrounds, a dominant atmospheric hero image, rich type, menu-like rows and simple visit/contact information. Do not invent menus, prices or opening hours.",compositions:["immersive","editorial"],background:"#211d19",surface:"#302a24",ink:"#fff7e9",muted:"#d4c7b4",accent:"#e3aa60",radius:"3px",sectionRhythm:"menu-style rows, image-led storytelling and a warm invitation band"},
  professional:{name:"Clarity creates confidence",direction:"Precise, composed and credible. Clean typography, structured service explanations, restrained blue tones and a clear consultation path. No invented certifications or results.",compositions:["minimal","asymmetric","framed"],background:"#eef2f7",surface:"#ffffff",ink:"#172b46",muted:"#50617a",accent:"#3769b2",radius:"12px",sectionRhythm:"ordered service grid, process timeline and consultation section"},
  general:{name:"Room to grow",direction:"Flexible, welcoming and contemporary. Confident mixed-scale typography, expressive color blocks and clear introductions that work without an established company identity.",compositions:["centered","minimal"],background:"#f4f3ee",surface:"#ffffff",ink:"#263031",muted:"#556262",accent:"#c5cfef",radius:"18px",sectionRhythm:"varied feature grids, useful service rows and an uncomplicated contact form"},
};
export function familyForPlan(text:string):DesignFamilyId {
  // Website redesign is the requested work, not the customer's industry.
  text=text.replace(/\b(?:website|web|site)\s+(?:re)?design\b|\bredesign\w*/gi,"");
  if(/roof|plumb|hvac|heating|air conditioning|cooling|heat pump|contractor|landscap|construction|remodel|electrician/i.test(text))return"trades";
  if(/spa|salon|wellness|beauty|yoga|massage|esthetic/i.test(text))return"wellness";
  if(/restaurant|cafe|coffee|bakery|hotel|hospitality|catering/i.test(text))return"hospitality";
  if(/law|account|consult|financial|insurance|professional/i.test(text))return"professional";
  if(/design|studio|photograph|creative|interior|architecture/i.test(text))return"editorial";
  return"general";
}
