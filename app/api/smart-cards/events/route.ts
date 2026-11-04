import {randomUUID} from 'node:crypto';
import {privacyRequested} from '@/lib/analytics/measurement';
import {publicRequestKey} from '@/lib/operations/public-inquiries';
import {getDatabasePool} from '@/lib/dashboard/db';
import {cardError,cardRateLimit,json,readCardRequest,CardError} from '@/lib/smart-cards/http';
import {eventSchema} from '@/lib/smart-cards/validation';
import {validateCardSource} from '@/lib/smart-cards/data';
import {CARD_WORKSPACE} from '@/lib/smart-cards/types';
export async function POST(request:Request){try{const raw=await readCardRequest(request,2000);if(privacyRequested(request.headers))return json({recorded:false});await cardRateLimit('card-event',publicRequestKey(request.headers),120,60);const parsed=eventSchema.safeParse(raw);if(!parsed.success)throw new CardError('Invalid event.');const v=parsed.data;const source=await validateCardSource(v.profile,v.card);await getDatabasePool().query(`INSERT INTO smart_card_events(id,workspace_id,profile_slug,card_code,session_id,channel,event_name,campaign) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`,[v.id||randomUUID(),CARD_WORKSPACE,v.profile,v.card??null,v.sessionId,v.card?v.channel:'direct',v.event,source.campaign]);return json({recorded:true});}catch(e){return cardError(e);}}
