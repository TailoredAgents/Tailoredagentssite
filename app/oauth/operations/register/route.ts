import {registerClient} from '@/lib/assistant/oauth';
import {body,checkOrigin,endpoint,limitRequest} from '@/lib/assistant/http';
import {json} from '@/lib/assistant/config';
export const runtime='nodejs';
export async function POST(request:Request){return endpoint(async()=>{checkOrigin(request);await limitRequest(request,'register',10);return json(await registerClient(await body(request,10000)),201);});}
