'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {easternInputCandidates} from '@/lib/time';
import {changeCalendar} from './calendar';
import {shiftDay} from './display';
export async function saveCalendar(_state:{ok:boolean;message:string},form:FormData){
 const context=await requireDashboardContext();
 try{const values=Object.fromEntries(form);
  if(['create_event','update_event'].includes(String(values.operation))&&values.allDay==='on'){
   const start=z.iso.date().parse(values.allDayStart),last=z.iso.date().parse(values.allDayEnd);
   if(last<start)return {ok:false,message:'The last day must be on or after the first day.'};
   values.startsAt=easternInputCandidates(start+'T00:00')[0];values.endsAt=easternInputCandidates(shiftDay(last,1)+'T00:00')[0];
  }else if(['publish','create_event','update_event'].includes(String(values.operation))){
   for(const field of values.operation==='publish'?['startsAt']:['startsAt','endsAt'])if(!values[field]){const choices=easternInputCandidates(String(values[field+'Local']??''));if(choices.length!==1)return {ok:false,message:'Choose a valid Eastern time. During the fall clock change, choose the first or second occurrence.'};values[field]=choices[0];}
  }
  await changeCalendar(context,values);
 }catch(e){return {ok:false,message:e instanceof z.ZodError?'Check the title, teammate, dates and event details.':e instanceof Error?e.message:'The calendar could not be updated.'};}
 revalidatePath('/dashboard/calendar');revalidatePath('/dashboard/sales/today');
 return {ok:true,message:'Calendar updated.'};
}
