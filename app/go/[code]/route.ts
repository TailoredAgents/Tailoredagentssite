import {NextResponse} from 'next/server';
import {resolveCard} from '@/lib/smart-cards/data';
import {CARD_ORIGIN} from '@/lib/smart-cards/types';
import {campaignDetails} from '@/lib/campaigns/catalog';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{code:string}>}){
 const card=await resolveCard((await params).code);
 if(!card)return new Response('This card is unavailable. Please visit tailoredagents.com or contact the person who shared it.',{status:410,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});
 const url=new URL(campaignDetails(card.campaign)?.path??`/c/${card.profile_slug}`,process.env.NODE_ENV==='production'?CARD_ORIGIN:new URL(request.url).origin);
 if(card.campaign)url.searchParams.set('person',card.profile_slug);
 url.searchParams.set('card',card.code);url.searchParams.set('via',new URL(request.url).searchParams.get('via')==='qr'?'qr':'nfc');
 if(card.campaign){url.searchParams.set('utm_source','field-outreach');url.searchParams.set('utm_medium',url.searchParams.get('via')!);url.searchParams.set('utm_campaign',card.campaign);url.searchParams.set('utm_content',card.code);}
 const response=NextResponse.redirect(url,307);response.headers.set('Cache-Control','no-store');response.headers.set('X-Robots-Tag','noindex');return response;
}
