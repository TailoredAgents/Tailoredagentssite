import {publicRequestKey} from '@/lib/operations/public-inquiries';
import {cardError,cardRateLimit,json,readCardRequest} from '@/lib/smart-cards/http';
import {saveCardInquiry} from '@/lib/smart-cards/inquiries';
export const runtime='nodejs';
export async function POST(request:Request){try{const raw=await readCardRequest(request,10000);await cardRateLimit('card-inquiry',publicRequestKey(request.headers),5,900);await saveCardInquiry(raw);return json({message:'Thank you. Your request is saved, and our team will be in touch.'},201);}catch(e){return cardError(e);}}
