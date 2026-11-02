'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {reviewAction,manageConnection,stopAllWrites} from '@/lib/assistant/actions';
import {z} from 'zod';
export async function assistantControl(form:FormData){
 const context=await requireDashboardContext();let result='updated';
 try{
  const operation=z.enum(['approve','reject','revoke','pause','resume','stop']).parse(form.get('operation'));
  if(operation==='stop')await stopAllWrites(context);
  else {const id=z.uuid().parse(form.get('id'));if(operation==='approve'||operation==='reject'){const r=await reviewAction(context,id,operation);result=r.status;}else await manageConnection(context,id,operation);}
 }catch{result='unavailable';}
 revalidatePath('/dashboard','layout');
 redirect('/dashboard/assistant?result='+result);
}
