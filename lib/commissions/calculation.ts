import {allocateCents,windowEnd} from '@/lib/commercial/calculation';
import type {BillingReview} from '@/lib/billing/contract';
import type {Component} from './contract';
export const nextDay=(s:string)=>new Date(Date.parse(s+'T00:00:00Z')+86400000).toISOString().slice(0,10);
export const monthEnd=(s:string)=>new Date(Date.UTC(Number(s.slice(0,4)),Number(s.slice(5,7)),0)).toISOString().slice(0,10);
export const nextMonth=(s:string)=>new Date(Date.UTC(Number(s.slice(0,4)),Number(s.slice(5,7)),1)).toISOString().slice(0,10);
const days=(a:string,b:string)=>Math.round((Date.parse(b)-Date.parse(a))/86400000)+1;
export type CommissionRole={id:string;recipientKey:string;agreementId:string;role:string;rateBps:number;startsOn:string;endsBefore:string|null;anchor:string|null;windowMonths:number|null};
export type CommissionInput={asOf:string;netCents:number;lines:BillingReview['lines'];roles:CommissionRole[]};
/** Approved convention v2: equal full months, partial months weighted by calendar days.
 * Recognition is at calendar month end; exact rational weights and deterministic cents. */
export function calculateCommissions(v:CommissionInput){
 const holds:string[]=[],entries:Component[]=[],windows=new Map<string,string>(),rates=new Map<string,number>();let segmentCount=0;
 if(!Number.isSafeInteger(v.netCents)||v.netCents<0||v.netCents>v.lines.reduce((n,l)=>n+l.amountCents,0))throw new Error('Cash does not reconcile.');
 const lines=[...v.lines].sort((a,b)=>a.sourceId.localeCompare(b.sourceId)),roles=[...v.roles].sort((a,b)=>a.id.localeCompare(b.id)||a.startsOn.localeCompare(b.startsOn));
 if(roles.length>200)throw new Error('Eligibility exceeds the complete calculation limit.');
 for(let i=0;i<roles.length;i++){
  const a=roles[i];if(a.windowMonths&&!a.anchor)holds.push('A fixed window needs an approved original receipt anchor.');
  const end=a.windowMonths&&a.anchor?nextDay(windowEnd(a.anchor,a.windowMonths)):'9999-12-31';windows.set(a.id,end);
  const from=[a.startsOn,a.anchor??a.startsOn].sort().at(-1)!,to=[a.endsBefore??'9999-12-31',end].sort()[0];
  if(from<to){rates.set(from,(rates.get(from)??0)+a.rateBps);rates.set(to,(rates.get(to)??0)-a.rateBps);}
  for(let j=i+1;j<roles.length;j++){const b=roles[j];if(a.role===b.role&&a.startsOn<(b.endsBefore??'9999-12-31')&&b.startsOn<(a.endsBefore??'9999-12-31'))holds.push('Eligibility overlaps within one role.');}
 }
 let rate=0;for(const [,delta] of [...rates].sort(([a],[b])=>a.localeCompare(b))){rate+=delta;if(rate>10000){holds.push('Combined recipient components exceed the revenue for an eligible day.');break;}}
 const cash=allocateCents(v.netCents,lines.map(l=>l.amountCents));let excludedCents=0,deferredCents=0,eligibleCents=0;
 lines.forEach((line,index)=>{
  if(line.classification!=='recurring'){excludedCents+=cash[index];return;}
  if(!line.startsOn||!line.endsOn||line.endsOn<line.startsOn)throw new Error('Recurring service dates are required.');
  const segments:{month:string;from:string;to:string;count:number;weight:number}[]=[];
  for(let m=line.startsOn.slice(0,8)+'01';m<=line.endsOn;m=nextMonth(m)){
   if(segments.length>=120)throw new Error('Service history exceeds the calculation limit.');
   if(++segmentCount>600)throw new Error('Invoice service segments exceed the calculation limit.');
   const from=[m,line.startsOn].sort().at(-1)!,to=[monthEnd(m),line.endsOn].sort()[0],count=days(from,to);
   segments.push({month:m,from,to,count,weight:count*(377580/days(m,monthEnd(m)))});
  }
  const basis=allocateCents(cash[index],segments.map(s=>s.weight));
  segments.forEach((s,ix)=>{
   if(monthEnd(s.month)>v.asOf){deferredCents+=basis[ix];return;}eligibleCents+=basis[ix];
   for(const role of ['external','originator','manager']){
    const parts=roles.filter(r=>r.role===role).map(r=>{
     const end=windows.get(r.id)!;
     const from=[s.from,r.startsOn,r.anchor??s.from].sort().at(-1)!,before=[nextDay(s.to),r.endsBefore??'9999-12-31',end].sort()[0];
     const count=from<before?days(from,before)-1:0;
     return {r,count,numerator:BigInt(basis[ix])*BigInt(r.rateBps)*BigInt(count)};
    }).filter(p=>p.count>0);
    const denom=10000n*BigInt(s.count),total=parts.reduce((n,p)=>n+p.numerator,0n),rounded=Number((total+denom/2n)/denom);
    const amounts=parts.map(p=>Number(p.numerator/denom));let residual=rounded-amounts.reduce((a,b)=>a+b,0);
    for(const p of parts.map((p,i)=>({i,r:p.numerator%denom})).sort((a,b)=>a.r===b.r?a.i-b.i:a.r>b.r?-1:1)){if(residual--<=0)break;amounts[p.i]++;}
    parts.forEach((p,j)=>{
     if(entries.length>=1000)throw new Error('Component count exceeds the complete posting limit.');
     const key=JSON.stringify([line.sourceId,s.month,p.r.id]),old=entries.find(e=>e.key===key);
     if(old){old.amountCents+=amounts[j];old.eligibleDays+=p.count;}
     else entries.push({key,entitlementId:p.r.id,recipientKey:p.r.recipientKey,agreementId:p.r.agreementId,role,lineId:line.sourceId,month:s.month,basisCents:basis[ix],eligibleDays:p.count,serviceDays:s.count,rateBps:p.r.rateBps,amountCents:amounts[j]});
    });
   }
   if(entries.filter(e=>e.lineId===line.sourceId&&e.month===s.month).reduce((n,e)=>n+e.amountCents,0)>basis[ix])holds.push('Combined recipient components exceed this service-month revenue.');
  });
 });
 const commissionCents=entries.reduce((n,e)=>n+e.amountCents,0);
 return {algorithm:'calendar-month-v2',holds:[...new Set(holds)],entries:holds.length?[]:entries,netCents:v.netCents,excludedCents,deferredCents,eligibleCents,commissionCents:holds.length?0:commissionCents,unallocatedCents:eligibleCents-commissionCents,moneyMoved:false};
}
