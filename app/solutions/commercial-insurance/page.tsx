import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {createHash} from 'node:crypto';
import {getInsurancePage} from '@/lib/campaigns/insurance-data';
import {insurancePath} from '@/lib/campaigns/insurance';
import {cardPortraits} from '@/lib/smart-cards/portraits';
import {CARD_ORIGIN} from '@/lib/smart-cards/types';
import {InsuranceLanding} from '@/components/campaigns/insurance-landing';
import '../../c/smart-cards.css';
import './insurance.css';
export const dynamic='force-dynamic';
type Props={searchParams:Promise<Record<string,string|string[]|undefined>>};
function one(v:string|string[]|undefined){return typeof v==='string'?v:undefined;}
async function resolve(props:Props){const q=await props.searchParams;return {data:await getInsurancePage(one(q.person),one(q.card)),channel:q.via==='qr'?'qr' as const:q.via==='nfc'?'nfc' as const:'direct' as const};}
export async function generateMetadata(props:Props):Promise<Metadata>{
 const {data}=await resolve(props);
 if(!data)return {title:'Campaign unavailable',robots:{index:false,follow:false}};
 const {profile,card}=data;
 const title=`Commercial insurance workflow review with ${profile.display_name} | Tailored Agents`;
 const description='Custom workflows from incoming insurance documents to approved system updates and follow-up. Explore the fictional example and book a 20-minute workflow review.';
 const version=createHash('sha256').update(JSON.stringify(["connected-workflow-v2",profile.display_name,cardPortraits[profile.slug]?.image.src])).digest('hex').slice(0,12);
 const image={url:`${CARD_ORIGIN}${insurancePath}/share-image?card=${card.code}&v=${version}`,width:1200,height:630,alt:`Commercial insurance workflow review with ${profile.display_name}`};
 return {title:{absolute:title},description,alternates:{canonical:insurancePath},openGraph:{title,description,type:'website',url:`${CARD_ORIGIN}${insurancePath}?person=${profile.slug}`,images:[image]},twitter:{card:'summary_large_image',title,description,images:[image]}};
}
export default async function InsurancePage(props:Props){
 const {data,channel}=await resolve(props);if(!data)notFound();
 return <InsuranceLanding key={`${data.card.code}:${data.profile.slug}:${channel}`} profile={data.profile} source={{profile:data.profile.slug,card:data.card.code,channel,campaign:'commercial-insurance'}}/>;
}
