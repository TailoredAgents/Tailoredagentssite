import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getCardProfile,resolveCard} from '@/lib/smart-cards/data';
import {SmartCardProfile} from '@/components/smart-cards/profile';
import {cardShareMetadata} from '@/lib/smart-cards/share-metadata';
import '../smart-cards.css';
export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>;searchParams:Promise<{card?:string;via?:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const profile=await getCardProfile((await params).slug);if(!profile)return{title:'Contact unavailable',robots:{index:false,follow:false}};return cardShareMetadata(profile);}
export default async function CardPage({params,searchParams}:Props){const profile=await getCardProfile((await params).slug);if(!profile)notFound();const q=await searchParams;const card=typeof q.card==='string'?await resolveCard(q.card):null;const valid=card?.profile_slug===profile.slug;return <SmartCardProfile profile={profile} card={valid?card.code:undefined} channel={valid?(q.via==='qr'?'qr':'nfc'):'direct'}/>;}
