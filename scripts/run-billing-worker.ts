import {runBillingWorkerStep} from '../lib/billing/reconciliation';
import {getDatabasePool} from '../lib/dashboard/db';
async function main(){
 if(process.env.BILLING_STRIPE_IMPORT_ENABLED!=='true'){console.log('Billing import is disabled.');return;}
 const deadline=Date.now()+210_000;
 try{
  for(let count=0;count<50&&Date.now()<deadline-105_000;count++){
   const result=await runBillingWorkerStep();
   if(result.disabled){console.log('Billing import is disabled.');return;}
   if(result.error){console.error('Billing source requires retry/review:',result.error);process.exitCode=1;return;}
   if(!result.processed)break;
  }
  console.log('Billing reconciliation pass finished; review the finance collection queue.');
 }finally{await getDatabasePool().end();}
}
void main().catch(()=>{console.error('Billing worker stopped. Check configured identity and the collection queue; no provider writes were made.');process.exitCode=1;});
