import {publicRequestKey} from '@/lib/operations/public-inquiries';
import {cardError,json,readCardRequest} from '@/lib/smart-cards/http';
import {askCardAssistant} from '@/lib/smart-cards/assistant';
export const runtime='nodejs';
export async function POST(request:Request){try{return json(await askCardAssistant(await readCardRequest(request),publicRequestKey(request.headers)));}catch(e){return cardError(e);}}
