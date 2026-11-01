import {publicRequestKey} from '@/lib/operations/public-inquiries';
import {cardError,cardRateLimit,json,readCardRequest} from '@/lib/smart-cards/http';
import {saveCardInquiry} from '@/lib/smart-cards/inquiries';
export const runtime='nodejs';
export async function POST(request:Request){try{const raw=await readCardRequest(request,10000);await cardRateLimit('card-inquiry',publicRequestKey(request.headers),5,900);const saved=await saveCardInquiry(raw);return json({booking:saved.booking,message:saved.booking?(saved.booking.status==='booked'?'Your phone consultation is confirmed. We’ll call the number you provided at the selected time.':'This booking was cancelled. Please choose a new time or contact our team.'):saved.requestKind==='appointment'?'Your appointment request is saved. Our team will contact you to agree on a time. No meeting is booked yet.':'Thank you. Your request is saved, and our team will be in touch.'},201);}catch(e){return cardError(e);}}
