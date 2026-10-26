import {setTimeout as delay} from "node:timers/promises";
import {runFactoryBuildWorkerStep} from "../lib/factory/build-worker";
import {getDatabasePool} from "../lib/dashboard/db";

let stopping=false;
process.on("SIGTERM",()=>{stopping=true;});process.on("SIGINT",()=>{stopping=true;});
const once=process.argv.includes("--once");
const drain=process.argv.includes("--drain"),started=Date.now();let stages=0;
try{
  do{
    const result=await runFactoryBuildWorkerStep();console.log(JSON.stringify({worker:"website-builder",...result}));
    stages++;
    // Scheduled runs drain approved work, then exit instead of billing idle time.
    // A busy queue is continued by the next run, never by restarting paid steps.
    if(once||stopping||(drain&&(!result.more||stages>=30||Date.now()-started>=30*60*1000)))break;
    if(!result.more)await delay(15000);
  }while(!stopping);
}catch{console.error("Website builder unavailable. Check its database, AI, storage and browser runtime configuration.");process.exitCode=1;}
finally{await getDatabasePool().end();}
