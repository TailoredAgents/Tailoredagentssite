'use server';
import {revalidatePath} from 'next/cache';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {changeCardSettings} from './settings';
export type CardActionState={ok:boolean;message:string};
export async function saveCardSettings(_previous:CardActionState,form:FormData):Promise<CardActionState>{
 const result=await changeCardSettings(await requireDashboardContext(),form);
 if(result.ok){revalidatePath('/dashboard/smart-cards');revalidatePath('/c','layout');}
 return {ok:result.ok,message:result.message};
}
