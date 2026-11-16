import {businessDateKey,easternInputCandidates} from '@/lib/time';
import {calendarConfig,type BusinessCalendar} from './contract';
export const addDays=(d:string,n:number)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export function cadenceDate(anchor:string,months:number,step:number){
 const y=Number(anchor.slice(0,4)),m=Number(anchor.slice(5,7))-1+months*step,last=new Date(Date.UTC(y,m+1,0)).getUTCDate();
 return new Date(Date.UTC(y,m,Math.min(Number(anchor.slice(8)),last))).toISOString().slice(0,10);
}
function covered(c:BusinessCalendar,d:string){if(d<c.validFrom||d>c.validThrough)throw new Error('The business calendar does not cover this deadline. Record a reviewed calendar version.');}
export function workingDay(c:BusinessCalendar,d:string){covered(c,d);const n=new Date(d+'T12:00:00Z').getUTCDay()||7;return c.weekdays.includes(n)&&!c.holidays.includes(d);}
export function localInstant(d:string,minutes:number){const [first,...others]=easternInputCandidates(`${d}T${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`);if(!first||others.length)throw new Error('This local deadline is ambiguous or does not exist across the time change. Review the calendar.');return first;}
function nextWorking(c:BusinessCalendar,d:string){for(let i=0;i<370;i++,d=addDays(d,1)){if(workingDay(c,d))return d;}throw new Error('No working date within the supported calendar horizon.');}
export function dateDeadline(config:BusinessCalendar,date:string){const c=calendarConfig.parse(config);return localInstant(nextWorking(c,date),c.closes);}
export function responseDeadline(config:BusinessCalendar,received:string){
 const c=calendarConfig.parse(config),instant=new Date(received),date=businessDateKey(instant);covered(c,date);
 if(!workingDay(c,date))return localInstant(nextWorking(c,date),c.afterHoursDue);
 const open=Date.parse(localInstant(date,c.opens)),close=Date.parse(localInstant(date,c.closes));
 if(!workingDay(c,date)||instant.getTime()<open||instant.getTime()>=close){const next=nextWorking(c,workingDay(c,date)&&instant.getTime()>=close?addDays(date,1):date);return localInstant(next,c.afterHoursDue);}
 let cursor=Math.ceil(instant.getTime()/60000)*60000,left=c.responseMinutes,current=date;
 for(let i=0;i<370;i++){
  const end=Date.parse(localInstant(current,c.closes)),available=Math.max(0,(end-cursor)/60000);
  if(left<=available)return new Date(cursor+left*60000).toISOString();left-=available;
  current=nextWorking(c,addDays(current,1));cursor=Date.parse(localInstant(current,c.opens));
 }
 throw new Error('Response deadline exceeds the supported calendar horizon.');
}
export function loggingDeadline(config:BusinessCalendar,occurred:string){const c=calendarConfig.parse(config);let date=businessDateKey(new Date(occurred));covered(c,date);for(let i=0;i<c.loggingDays;i++)date=nextWorking(c,addDays(date,1));return localInstant(date,c.closes);}
