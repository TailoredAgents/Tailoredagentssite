import { normalizeOAuthForm } from './lib/server/mcp-routing';
import type { ExecutionContext, MessageBatch } from '@cloudflare/workers-types';
import { maintainMail, processJob, type JobEnv } from './lib/server/mail-jobs';
type WorkerEnv = JobEnv;
export default function createMailWorker(sveltekit: { fetch(request:Request,env:WorkerEnv,ctx:ExecutionContext):Promise<Response> }) { return {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    try { request = await normalizeOAuthForm(request); } catch { return Response.json({error:'invalid_request'}, {status:400}); }
    return sveltekit.fetch(request,env,ctx);
  },
  async queue(batch: MessageBatch<{id:string}>,env: WorkerEnv) {
    for (const message of batch.messages) {
      try { await processJob(env,message.body.id); message.ack(); }
      catch { message.retry({delaySeconds: Math.min(3600,30*2**Math.min(message.attempts,6))}); }
    }
  },
  async scheduled(_event: unknown,env: WorkerEnv) {
    try { await maintainMail(env); }
    catch { console.error(JSON.stringify({event:'mail_maintenance_failed'})); }
  }
}; }
