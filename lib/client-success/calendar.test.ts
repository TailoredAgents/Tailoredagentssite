import {describe,it,expect} from 'vitest';
import {calendarConfig,type BusinessCalendar} from './contract';
import {responseDeadline,loggingDeadline,dateDeadline,cadenceDate,localInstant} from './calendar';
// Synthetic policy, deliberately different from private commercial terms.
export const syntheticCalendar:BusinessCalendar={timezone:'America/New_York',weekdays:[1,2,3,4,5],opens:600,closes:960,responseMinutes:90,afterHoursDue:675,loggingDays:2,validFrom:'2026-01-01',validThrough:'2028-12-31',holidays:['2026-11-16']};
describe('Reviewed business calendar',()=>{
 it('counts business minutes and rounds partial minutes forward',()=>{expect(responseDeadline(syntheticCalendar,'2026-11-13T15:00:14Z')).toBe('2026-11-13T16:31:00.000Z');});
 it('carries the allowance across a weekend and a reviewed holiday',()=>{expect(responseDeadline(syntheticCalendar,'2026-11-13T20:30:00Z')).toBe('2026-11-17T16:00:00.000Z');});
 it('uses the explicit next-morning cutoff for closed-hours requests',()=>{expect(responseDeadline(syntheticCalendar,'2026-11-13T21:00:00Z')).toBe('2026-11-17T16:15:00.000Z');expect(responseDeadline(syntheticCalendar,'2026-11-17T13:00:00Z')).toBe('2026-11-17T16:15:00.000Z');});
 it('uses actual Eastern DST offsets on both sides of the spring change',()=>{expect(responseDeadline(syntheticCalendar,'2026-03-06T20:30:00Z')).toBe('2026-03-09T15:00:00.000Z');});
 it('rolls date deadlines forward and counts logging business dates',()=>{expect(dateDeadline(syntheticCalendar,'2026-11-14')).toBe('2026-11-17T21:00:00.000Z');expect(loggingDeadline(syntheticCalendar,'2026-11-13T17:00:00Z')).toBe('2026-11-18T21:00:00.000Z');});
 it('keeps recurrence anchored at the original day after a short month',()=>{expect(cadenceDate('2026-01-31',1,1)).toBe('2026-02-28');expect(cadenceDate('2026-01-31',1,2)).toBe('2026-03-31');expect(cadenceDate('2028-02-29',12,1)).toBe('2029-02-28');});
 it('holds unknown calendar coverage and ambiguous or nonexistent local times',()=>{expect(()=>dateDeadline(syntheticCalendar,'2029-01-01')).toThrow(/does not cover/);expect(()=>localInstant('2026-03-08',150)).toThrow(/does not exist/);expect(()=>localInstant('2026-11-01',90)).toThrow(/ambiguous/);});
 it('refuses duplicate weekdays, out-of-range holidays and an unspecified after-hours cutoff',()=>{expect(calendarConfig.safeParse({...syntheticCalendar,weekdays:[1,1]}).success).toBe(false);expect(calendarConfig.safeParse({...syntheticCalendar,afterHoursDue:500}).success).toBe(false);expect(calendarConfig.safeParse({...syntheticCalendar,holidays:['2029-01-01']}).success).toBe(false);});
});
