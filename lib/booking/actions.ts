'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {easternInputCandidates} from '@/lib/time';
import {changeCalendar} from './calendar';
export async function saveCalendar(_state:{ok:boolean;message:string},form:FormData){
 const context=await requireDashboardContext();
 try{const values=Object.fromEntries(form);if(values.operation==='publish'&&!values.startsAt){const choices=easternInputCandidates(String(values.startsAtLocal??''));if(choices.length!==1)return {ok:false,message:'Choose a valid Eastern time. During the fall clock change, choose the first or second occurrence.'};values.startsAt=choices[0];}await changeCalendar(context,values);}catch(e){return {ok:false,message:e instanceof z.ZodError?'Check the teammate, date and duration.':e instanceof Error?e.message:'The calendar could not be updated.'};}
 revalidatePath('/dashboard/calendar');revalidatePath('/dashboard/sales/today');
 return {ok:true,message:'Calendar updated.'};
}
