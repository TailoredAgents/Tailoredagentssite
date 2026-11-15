import {z} from 'zod';
import {invoiceLineSchema,money,roleSchema} from './contract';
const day=z.iso.date();
export const calculationInput=z.object({
 asOf:day,collectedOn:day,cleared:z.boolean(),collectedCents:money,refundedCents:money,
 lines:z.array(invoiceLineSchema).min(1).max(50),
 roles:z.array(z.object({recipientId:z.string().min(1).max(200),agreementId:z.uuid(),role:roleSchema,rateBps:z.number().int().min(1).max(10000),startsOn:day,endsOn:day.nullable(),windowStartsOn:day.nullable(),windowMonths:z.number().int().min(1).max(120).nullable()})).max(100),
}).strict();
export type CalculationInput=z.infer<typeof calculationInput>;
const days=(a:string,b:string)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000)+1;
const max=(...v:string[])=>v.sort().at(-1)!;
const min=(...v:string[])=>v.sort()[0];
function monthEnd(s:string){return new Date(Date.UTC(Number(s.slice(0,4)),Number(s.slice(5,7)),0)).toISOString().slice(0,10);}
function monthAfter(s:string){return new Date(Date.UTC(Number(s.slice(0,4)),Number(s.slice(5,7)),1)).toISOString().slice(0,10);}
function previousDay(s:string){return new Date(Date.parse(s+'T00:00:00Z')-86400000).toISOString().slice(0,10);}
export function windowEnd(start:string,months:number){
 const first=new Date(Date.UTC(Number(start.slice(0,4)),Number(start.slice(5,7))-1+months,1)).toISOString().slice(0,10);
 const anniversary=first.slice(0,8)+String(Math.min(Number(start.slice(8)),Number(monthEnd(first).slice(8)))).padStart(2,'0');
 return previousDay(anniversary);
}
/** Largest remainder with stable input order; all cents are conserved. */
export function allocateCents(total:number,weights:number[]){
 if(!Number.isSafeInteger(total)||total<0||weights.some(w=>!Number.isSafeInteger(w)||w<0))throw new Error('Use nonnegative integer cents and weights.');
 const denominator=weights.reduce((s,w)=>s+BigInt(w),0n);
 if(!denominator){if(total)throw new Error('A nonzero amount needs allocation weights.');return weights.map(()=>0);}
 const parts=weights.map((w,i)=>({i,value:Number(BigInt(total)*BigInt(w)/denominator),remainder:BigInt(total)*BigInt(w)%denominator}));
 let left=total-parts.reduce((s,p)=>s+p.value,0);
 for(const p of [...parts].sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1)){if(left--<=0)break;p.value++;}
 return parts.map(p=>p.value);
}
export function previewRecurringCalculation(input:unknown){
 const v=calculationInput.parse(input),holds:string[]=[];
 const total=v.lines.reduce((s,l)=>s+l.amountCents,0);
 if(v.refundedCents>v.collectedCents||v.collectedCents>total)throw new Error('Collections and refunds must reconcile to the invoice total.');
 if(v.collectedOn>v.asOf)throw new Error('Collection date is after this preview date.');
 for(const r of v.roles){if(r.endsOn&&r.endsOn<r.startsOn)throw new Error('Eligibility ends before it begins.');if(r.windowMonths&&!r.windowStartsOn)holds.push('A fixed commission window needs its verified first-collection anchor.');}
 // Conflicting recipients for one role cannot silently split an entitlement.
 for(let i=0;i<v.roles.length;i++)for(let j=i+1;j<v.roles.length;j++){
  const a=v.roles[i],b=v.roles[j];if(a.role===b.role&&max(a.startsOn,b.startsOn)<=min(a.endsOn??'9999-12-31',b.endsOn??'9999-12-31'))throw new Error('Role eligibility intervals overlap. Resolve attribution or manager day ownership first.');
 }
 const allocated=allocateCents(v.collectedCents-v.refundedCents,v.lines.map(l=>l.amountCents));
 const entries:{line:number;month:string;recipientId:string;agreementId:string;role:string;eligibleDays:number;serviceDays:number;basisCents:number;amountCents:number}[]=[];
 let excludedCents=0,deferredCents=0,eligibleCents=0;
 for(let i=0;i<v.lines.length;i++){
  const l=v.lines[i],amount=allocated[i];
  if(l.classification!=='recurring'){excludedCents+=amount;continue;}
  const start=l.startsOn!,end=l.endsOn!;
  if(start.slice(8)!=='01'||end!==monthEnd(end)){holds.push(`Line ${i+1}: partial-month services need an approved allocation schedule.`);continue;}
  const months:string[]=[];let current=start;
  while(current<=end){months.push(current);if(months.length>120)throw new Error('Use at most ten years per preview.');current=monthAfter(current);}
  const monthly=allocateCents(amount,months.map(()=>1));
  for(let m=0;m<months.length;m++){
   const first=months[m],last=monthEnd(first),basis=monthly[m],count=days(first,last);
   // Month-end recognition is explicit in this preview; other conventions require review.
   if(last>v.asOf||!v.cleared){deferredCents+=basis;continue;}
   eligibleCents+=basis;
   for(const role of ['external','originator','manager']){
    const segments=v.roles.filter(r=>r.role===role).map(r=>{
     const from=max(first,r.startsOn,r.windowStartsOn??first),to=min(last,r.endsOn??last,r.windowMonths&&r.windowStartsOn?windowEnd(r.windowStartsOn,r.windowMonths):last);
     const n=from>to?0:days(from,to);return {r,n,numerator:BigInt(basis)*BigInt(r.rateBps)*BigInt(n)};
    }).filter(s=>s.n>0);
    const denominator=10000n*BigInt(count),sum=segments.reduce((s,r)=>s+r.numerator,0n),rounded=Number((sum+denominator/2n)/denominator);
    const portions=segments.map(s=>Number(s.numerator/denominator));let residual=rounded-portions.reduce((s,n)=>s+n,0);
    const order=segments.map((s,index)=>({index,remainder:s.numerator%denominator})).sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1);
    for(const p of order){if(residual--<=0)break;portions[p.index]++;}
    segments.forEach((s,j)=>entries.push({line:i+1,month:first,recipientId:s.r.recipientId,agreementId:s.r.agreementId,role,eligibleDays:s.n,serviceDays:count,basisCents:basis,amountCents:portions[j]}));
   }
  }
 }
 const commissionCents=entries.reduce((s,e)=>s+e.amountCents,0);
 if(commissionCents>eligibleCents)holds.push('Combined role components exceed eligible revenue. Review the configured rules.');
 return {mode:'shadow' as const,algorithm:'calendar-month-v1',allocationPolicy:'proportional invoice lines; equal full service months; month-end recognition',holds:[...new Set(holds)],entries:holds.length?[]:entries,collectedNetCents:v.collectedCents-v.refundedCents,excludedCents,deferredCents,heldCents:v.collectedCents-v.refundedCents-excludedCents-deferredCents-eligibleCents,eligibleCents,commissionCents:holds.length?0:commissionCents,unallocatedCents:holds.length?eligibleCents:eligibleCents-commissionCents,moneyMoved:false};
}
