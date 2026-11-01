import {z} from 'zod';
import {easternInputValue} from '@/lib/time';
import {publicRequestKey} from '@/lib/operations/public-inquiries';
import {cardError,cardRateLimit,json,readCardRequest} from '@/lib/smart-cards/http';
import {attributionSchema} from '@/lib/smart-cards/validation';
import {availableSlots} from '@/lib/booking/calendar';
export const runtime='nodejs';
export async function POST(request:Request){try{const v=attributionSchema.extend({day:z.iso.date().optional()}).parse(await readCardRequest(request,2000));await cardRateLimit('card-times',publicRequestKey(request.headers),30,60);const day=v.day??easternInputValue(new Date().toISOString()).slice(0,10);return json({day,slots:await availableSlots(v.profile,v.card,day)});}catch(e){return cardError(e);}}
