import type { RequestHandler } from '@sveltejs/kit';
import { readBearerToken } from '$lib/server/api-tokens';
import { getEmailProvider } from '$lib/server/context';
import { handleMcpRequest } from '$lib/server/mcp';
import { bearerChallenge, getUserByOAuthToken, mcpResourceUri } from '$lib/server/oauth';
import { publicMailOrigin } from '$lib/server/mcp-routing';
import { apiSendPolicy } from '$lib/server/send-policy';
const handle: RequestHandler = async ({request,platform,url}) => {
 const origin = publicMailOrigin(platform?.env,url);
 const headers = {'Cache-Control':'no-store','WWW-Authenticate':bearerChallenge(origin)};
 if (url.origin !== origin || (request.headers.has('origin') && request.headers.get('origin') !== origin)) return new Response('Invalid origin',{status:403});
 const db = platform?.env.DB;
 if (!db) return new Response('Unavailable',{status:503});
 const bearer = readBearerToken(request);
 const resource = mcpResourceUri(origin);
 const auth = bearer ? await getUserByOAuthToken(db,bearer,resource) : null;
 if (!auth) return Response.json({error:'invalid_token'},{status:401,headers});
 if (request.method !== 'POST') return new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
 return handleMcpRequest(request,{
  db,bucket:platform?.env.ATTACHMENTS,provider:()=>getEmailProvider(platform),
  user:auth.user,scopes:auth.scopes,origin,sendPolicy:apiSendPolicy(platform?.env),
  authorization:{familyId:auth.familyId,resource},
  beforeDelivery:async()=>{
   const current = await getUserByOAuthToken(db,bearer!,resource);
   if (!current?.scopes.includes('mail:send')) throw new Error('Send authorization expired or revoked');
  }
 });
};
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
