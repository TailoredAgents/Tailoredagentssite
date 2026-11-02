import {assistantOrigin,resourceUri,scopes,json} from '@/lib/assistant/config';
export const dynamic='force-dynamic';
export async function GET(){return json({resource:resourceUri(),authorization_servers:[assistantOrigin()],scopes_supported:scopes,bearer_methods_supported:['header'],resource_name:'Tailored Agents Operations',resource_documentation:assistantOrigin()+'/dashboard/assistant'});}
