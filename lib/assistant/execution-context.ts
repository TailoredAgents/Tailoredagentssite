import 'server-only';
import {AsyncLocalStorage} from 'node:async_hooks';
// Only the authenticated MCP/action executor establishes this server-side context.
export const assistantExecution = new AsyncLocalStorage<{userId:string;sessionId:string;grantId:string;direct?:boolean;reviewedEmailActionId?:string}>();
