import {describe,it,expect} from 'vitest';
import {dayLayout,touchesDay,viewDays,shiftMonth,type CalendarEvent} from './display';
const event=(id:string,start:string,end:string,allDay=false):CalendarEvent=>({id,start,end,allDay,title:id,person:'Austin',profile:'austin',source:'slot',status:'blocked'});
describe('Eastern calendar views',()=>{
 it('covers month edges and year changes with real dates',()=>{expect(viewDays('2026-11-10','week')).toEqual(['2026-11-08','2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-14']);expect(viewDays('2026-11-10','month')).toHaveLength(42);expect(shiftMonth('2026-12-31',1)).toBe('2027-01-01');});
 it('does not spill an all-day event into its exclusive last midnight across DST',()=>{const e=event('dst','2027-03-14T05:00:00Z','2027-03-15T04:00:00Z',true);expect(touchesDay(e,'2027-03-14')).toBe(true);expect(touchesDay(e,'2027-03-15')).toBe(false);expect(dayLayout([e],'2027-03-14')).toEqual([]);});
 it('splits overnight events into the right daily positions',()=>{const e=event('night','2026-11-11T04:00:00Z','2026-11-11T07:00:00Z');expect(dayLayout([e],'2026-11-10')[0]).toMatchObject({start:1380,end:1440});expect(dayLayout([e],'2026-11-11')[0]).toMatchObject({start:0,end:120});});
 it('shares columns for overlapping teammates and gives later events full width',()=>{const rows=dayLayout([event('a','2026-11-10T14:00:00Z','2026-11-10T15:00:00Z'),event('b','2026-11-10T14:30:00Z','2026-11-10T15:30:00Z'),event('c','2026-11-10T16:00:00Z','2026-11-10T17:00:00Z')],'2026-11-10');expect(rows.map(r=>[r.column,r.columns])).toEqual([[0,2],[1,2],[0,1]]);});
 it('keeps repeated fall-back times visible instead of negative height',()=>{expect(dayLayout([event('fall','2027-11-07T05:30:00Z','2027-11-07T06:15:00Z')],'2027-11-07')[0]).toMatchObject({start:90,end:110});});
});
