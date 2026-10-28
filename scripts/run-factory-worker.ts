import { runFactoryWorkerStep } from "../lib/factory/worker";
import { getDatabasePool } from "../lib/dashboard/db";
import {syncFactoryWorkNotices} from "../lib/factory/work-notices";

try {
  // One stage only. The secured scheduled endpoint can continue while more=true.
  console.log(JSON.stringify(await runFactoryWorkerStep()));
  try{await syncFactoryWorkNotices();}catch{console.error("Website updates will be refreshed on the next pass.");}
} catch {
  console.error("Factory worker could not finish. Review database and provider configuration.");
  process.exitCode=1;
} finally {
  await getDatabasePool().end();
}
