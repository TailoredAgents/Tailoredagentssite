import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {createHash} from 'node:crypto';
import {getCampaignPage} from '@/lib/campaigns/data';
import {freightPath} from '@/lib/campaigns/freight';
import {cardPortraits} from '@/lib/smart-cards/portraits';
import {CARD_ORIGIN} from '@/lib/smart-cards/types';
import {FreightLanding} from '@/components/campaigns/freight-landing';
import '../../c/smart-cards.css';
import '../commercial-insurance/insurance.css';
import './freight.css';
export const dynamic='force-dynamic';
type Props={searchParams:Promise<Record<string,string|string[]|undefined>>};
function one(v:string|string[]|undefined){return typeof v==='string'?v:undefined;}
async function resolve(props:Props){const q=await props.searchParams;return {data:await getCampaignPage('freight-automation',one(q.person),one(q.card)),channel:q.via==='qr'?'qr' as const:q.via==='nfc'?'nfc' as const:'direct' as const};}
export async function generateMetadata(props:Props):Promise<Metadata>{
 const {data}=await resolve(props);
 if(!data)return {title:'Campaign unavailable',robots:{index:false,follow:false}};
 const {profile,card}=data;
 const title=`Freight & 3PL workflow review with ${profile.display_name} | Tailored Agents`;
 const description='Custom freight document and operations automation alongside your TMS. Explore a sample load, estimate staff capacity and book a 20-minute workflow review.';
 const version=createHash('sha256').update(JSON.stringify(["freight-workflow-v1",profile.display_name,cardPortraits[profile.slug]?.image.src])).digest('hex').slice(0,12);
 const image={url:`${CARD_ORIGIN}${freightPath}/share-image?card=${card.code}&v=${version}`,width:1200,height:630,alt:`Freight & 3PL workflow review with ${profile.display_name}`};
 return {title:{absolute:title},description,alternates:{canonical:freightPath},openGraph:{title,description,type:'website',url:`${CARD_ORIGIN}${freightPath}?person=${profile.slug}`,images:[image]},twitter:{card:'summary_large_image',title,description,images:[image]}};
}
export default async function FreightPage(props:Props){
 const {data,channel}=await resolve(props);if(!data)notFound();
 return <FreightLanding key={`${data.card.code}:${data.profile.slug}:${channel}`} profile={data.profile} source={{profile:data.profile.slug,card:data.card.code,channel,campaign:'freight-automation'}}/>;
}
