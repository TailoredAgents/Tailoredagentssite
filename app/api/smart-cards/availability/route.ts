import {publicRequestKey} from '@/lib/operations/public-inquiries';
import {cardError,cardRateLimit,json,readCardRequest} from '@/lib/smart-cards/http';
import {attributionSchema} from '@/lib/smart-cards/validation';
import {availableSlots} from '@/lib/booking/calendar';
export const runtime='nodejs';
export async function POST(request:Request){try{const v=attributionSchema.parse(await readCardRequest(request,2000));await cardRateLimit('card-times',publicRequestKey(request.headers),30,60);return json({slots:await availableSlots(v.profile,v.card)});}catch(e){return cardError(e);}}
