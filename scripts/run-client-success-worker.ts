import {runClientSuccessWorker} from '../lib/client-success/worker';
import {getDatabasePool} from '../lib/dashboard/db';
async function main(){
 if(process.env.CLIENT_SUCCESS_WORKER_ENABLED!=='true'){console.log('Client-success scheduling is disabled.');return;}
 try{
  console.log(JSON.stringify(await runClientSuccessWorker()));
  if(process.env.CLIENT_SUCCESS_REMINDERS_ENABLED==='true'){
   const {runEmployeeNotificationWorker}=await import('../lib/assistant/notification-worker');
   console.log(JSON.stringify(await runEmployeeNotificationWorker()));
  }
 }finally{await getDatabasePool().end();}
}
void main().catch(()=>{console.error('Client-success worker stopped. Review the saved plans and calendar coverage.');process.exitCode=1;});
