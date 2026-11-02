import {z} from 'zod';
import {revokeToken} from '@/lib/assistant/oauth';
import {body,checkOrigin,endpoint,limitRequest} from '@/lib/assistant/http';
import {json} from '@/lib/assistant/config';
export const runtime='nodejs';
export async function POST(request:Request){return endpoint(async()=>{checkOrigin(request);await limitRequest(request,'revoke',30);const v=z.object({token:z.string().max(200),client_id:z.string().max(100)}).parse(await body(request,4096));await revokeToken(v.token,v.client_id);return json({});});}
