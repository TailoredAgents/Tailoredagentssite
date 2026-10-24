import { runScheduledWorkers } from "./scheduled-workers.mjs";
if (!(await runScheduledWorkers(process.env, { error: console.error }))) process.exitCode = 1;
