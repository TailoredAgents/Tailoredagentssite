import {easternInputValue} from '@/lib/time';

export type CalendarView='day'|'week'|'month';
export const eventKinds={appointment:'Client appointment',meeting:'Business meeting',meetup:'Business meetup',busy:'Busy',time_off:'Time off'} as const;
export function shiftDay(day:string,n:number){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10);}
export function shiftMonth(day:string,n:number){const date=new Date(day+'T12:00:00Z');date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+n);return date.toISOString().slice(0,10);}
export function weekStart(day:string){return shiftDay(day,-new Date(day+'T12:00:00Z').getUTCDay());}
export function viewDays(day:string,view:CalendarView){const start=view==='month'?weekStart(day.slice(0,7)+'-01'):view==='week'?weekStart(day):day;return Array.from({length:view==='month'?42:view==='week'?7:1},(_,i)=>shiftDay(start,i));}
export type CalendarEvent={id:string;source:'slot'|'task';profile:string|null;person:string;title:string;start:string;end:string;allDay:boolean;status:string};
export function touchesDay(event:CalendarEvent,day:string){return easternInputValue(event.start).slice(0,10)<=day&&easternInputValue(new Date(Date.parse(event.end)-1).toISOString()).slice(0,10)>=day;}
function wallMinute(value:string){const time=easternInputValue(value).slice(11);return Number(time.slice(0,2))*60+Number(time.slice(3));}
/** Position overlapping teammates side by side; UTC instants remain authoritative. */
export function dayLayout(events:CalendarEvent[],day:string){
 const segments=events.filter(e=>!e.allDay&&touchesDay(e,day)).map(event=>{
  const start=easternInputValue(event.start).slice(0,10)<day?0:wallMinute(event.start);
  const end=easternInputValue(event.end).slice(0,10)>day?1440:wallMinute(event.end);
  // A fall-back event can end at an earlier wall time; retain a visible clickable entry.
  return {event,start,end:Math.max(start+20,end),column:0,columns:1};
 }).sort((a,b)=>a.start-b.start||b.end-a.end||a.event.id.localeCompare(b.event.id));
 let group:typeof segments=[],ends:number[]=[],groupEnd=0;
 function finish(){for(const s of group)s.columns=ends.length;group=[];ends=[];}
 for(const segment of segments){if(group.length&&segment.start>=groupEnd)finish();let column=ends.findIndex(end=>end<=segment.start);if(column===-1)column=ends.length;ends[column]=segment.end;segment.column=column;group.push(segment);groupEnd=Math.max(...group.map(s=>s.end));}finish();return segments;
}
