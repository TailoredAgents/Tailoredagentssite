import QRCode from 'qrcode';
import {resolveCard} from '@/lib/smart-cards/data';
import {cardUrl} from '@/lib/smart-cards/types';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{code:string}>}){const code=(await params).code;if(!await resolveCard(code))return new Response('Card unavailable',{status:404});const png=new URL(request.url).searchParams.get('format')==='png';const value=cardUrl(code,'qr');const image=png?new Uint8Array(await QRCode.toBuffer(value,{width:1200,margin:4,errorCorrectionLevel:'M'})):await QRCode.toString(value,{type:'svg',margin:4,errorCorrectionLevel:'M'});return new Response(image,{headers:{'Content-Type':png?'image/png':'image/svg+xml','Content-Disposition':`attachment; filename="${code}-qr.${png?'png':'svg'}"`,'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});}
