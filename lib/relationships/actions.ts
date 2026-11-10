'use server';
import {revalidatePath} from 'next/cache';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import {ZodError} from 'zod';
import type {OperationActionState} from '@/lib/operations/validation';
import {discoveryFields} from './contract';
import {saveDiscovery,addIntroduction,setAccountManager} from './service';
export async function relationshipAction(_:OperationActionState,form:FormData):Promise<OperationActionState>{
 const c=await requireDashboardContext();const value=Object.fromEntries(form);
 try{
 if(value.operation==='discovery')await saveDiscovery(c,{kind:value.kind,id:value.id,fields:Object.fromEntries(Object.keys(discoveryFields).map(k=>[k,form.get(k)||'']))});
 else if(value.operation==='referral')await addIntroduction(c,value);
 else if(value.operation==='manager')await setAccountManager(c,value);
 else throw new SalesAccessError('Choose a supported change.');
 revalidatePath('/dashboard','layout');return {status:'success',message:'Saved to this relationship.'};
 }catch(e){return {status:'error',message:e instanceof SalesAccessError?e.message:e instanceof ZodError?'Check the details and try again.':'The change could not be saved. Try again.'};}
}
