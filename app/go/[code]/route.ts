import {NextResponse} from 'next/server';
import {resolveCard} from '@/lib/smart-cards/data';
import {CARD_ORIGIN} from '@/lib/smart-cards/types';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{code:string}>}){
 const card=await resolveCard((await params).code);
 if(!card)return new Response('This card is unavailable. Please visit tailoredagents.com or contact the person who shared it.',{status:410,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});
 const url=new URL(`/c/${card.profile_slug}`,process.env.NODE_ENV==='production'?CARD_ORIGIN:new URL(request.url).origin);
 url.searchParams.set('card',card.code);url.searchParams.set('via',new URL(request.url).searchParams.get('via')==='qr'?'qr':'nfc');
 const response=NextResponse.redirect(url,307);response.headers.set('Cache-Control','no-store');response.headers.set('X-Robots-Tag','noindex');return response;
}
