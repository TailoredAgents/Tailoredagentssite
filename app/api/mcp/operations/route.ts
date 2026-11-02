import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {authenticate} from '@/lib/assistant/oauth';
import {createOperationsServer} from '@/lib/assistant/server';
import {body,checkOrigin,endpoint,limitRequest} from '@/lib/assistant/http';
import {AssistantError,assistantOrigin,json,privateHeaders} from '@/lib/assistant/config';
import {requireScopes} from '@/lib/assistant/access';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(request:Request){
 return endpoint(async()=>{
  checkOrigin(request);await limitRequest(request,'mcp',180);
  let p;
  try{p=await authenticate(request);requireScopes(p,[]);}catch(e){if(!(e instanceof AssistantError)||e.status!==401)throw e;return Response.json({error:'invalid_token',error_description:'Connect Tailored Agents Operations to continue.'},{status:401,headers:{...privateHeaders,'WWW-Authenticate':`Bearer resource_metadata="${assistantOrigin()}/.well-known/oauth-protected-resource/api/mcp/operations", error="invalid_token"`}});}
  const parsed=await body(request);
  const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  const server=createOperationsServer(p);
  try{await server.connect(transport);const response=await transport.handleRequest(request,{parsedBody:parsed});for(const [key,value] of Object.entries(privateHeaders))response.headers.set(key,value);return response;}finally{await server.close();}
 });
}
// Stateless JSON responses: no SSE subscription or session deletion needed.
export function GET(){return Response.json({error:'method_not_allowed'},{status:405,headers:{...privateHeaders,Allow:'POST','WWW-Authenticate':`Bearer resource_metadata="${assistantOrigin()}/.well-known/oauth-protected-resource/api/mcp/operations"`}});}
export function DELETE(){return json({error:'method_not_allowed'},405);}
