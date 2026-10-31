import { createHash } from "node:crypto";
import { z } from "zod";
import { BUSINESS_TIME_ZONE, easternInputValue, easternInputCandidates } from "@/lib/time";

export const introSettingsSchema = z.object({
  enabled: z.boolean(), numberId: z.uuid().nullable(), ownerId: z.string().trim().max(200).nullable(),
  formIds: z.array(z.string().regex(/^\d{5,30}$/)).max(30),
  startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(1).max(1440),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  instructions: z.string().trim().max(2000), dailyLimit: z.number().int().min(1).max(100), reviewed: z.boolean(),
}).superRefine((v,c) => {
  if(v.startMinute>=v.endMinute)c.addIssue({code:"custom",message:"Choose an end time after the start time."});
  if(v.enabled && (!v.numberId || !v.ownerId || !v.formIds.length || !v.reviewed)) c.addIssue({code:"custom",message:"Choose a sending number, call owner and eligible forms, then review the introduction policy before enabling."});
});
export type IntroWindow = {start_minute:number;end_minute:number;weekdays:number[]};
export function introRuntimeEnabled() { return process.env.LEAD_INTRO_SMS_ENABLED === "true"; }
export function introFactsHash(facts: unknown) { return createHash("sha256").update(JSON.stringify(facts)).digest("hex"); }

/** Business window is Eastern. Do not infer a recipient's timezone from a phone number. */
export function nextIntroTime(after: Date, window: IntroWindow): Date {
  const base=easternInputValue(after.toISOString());
  for(let day=0;day<9;day++) {
    const d=new Date(`${base.slice(0,10)}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+day);
    if(!window.weekdays.includes(d.getUTCDay()))continue;
    const date=d.toISOString().slice(0,10);
    const current=day===0?Number(base.slice(11,13))*60+Number(base.slice(14,16)):0;
    for(let minute=Math.max(current,window.start_minute);minute<window.end_minute;minute++) {
      const value=`${date}T${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`;
      for(const candidate of easternInputCandidates(value)) {
        const instant=new Date(candidate);
        if(instant>=after)return instant;
        if(day===0 && minute===current && after.getTime()-instant.getTime()<60000)return after;
      }
    }
  }
  throw new Error(`No sending window in ${BUSINESS_TIME_ZONE}`);
}
export function introWindowOpen(now: Date, window: IntroWindow) { return nextIntroTime(now,window).getTime()===now.getTime(); }

const topics = {website:"your website",seo:"SEO",ai:"AI agents",website_seo:"your website and SEO",exploring:"options for your business",general:"your inquiry"} as const;
export const introAnswerSchema=z.object({topic:z.enum(["website","seo","ai","website_seo","exploring","general"]),question:z.string().trim().min(15).max(170)
  .refine(s=>s.endsWith("?") && (s.match(/\?/g)||[]).length===1 && !/[\r\n@$\d]|https?:|www\./i.test(s),"Use one short question without prices, contact details or links.")});
export function composeIntroduction(name: string | null, answer: z.infer<typeof introAnswerSchema>) {
  const first=(name||"").trim().split(/\s+/)[0];
  const greeting=first && /^[A-Za-z][A-Za-z'-]{0,29}$/.test(first) && !/^(facebook|instagram|unknown|none|test|lead)$/i.test(first)?`Hi ${first}!`:"Hi!";
  return `${greeting} Thanks for reaching out to Tailored Agents about ${topics[answer.topic]}. ${answer.question} Our team will also give you a call to follow up.`;
}
export function fallbackIntroduction(name:string|null) {return composeIntroduction(name,{topic:"general",question:"What would you most like our team to help you with?"});}
