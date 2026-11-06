import 'server-only';
import {getCardProfile,resolveCard} from '@/lib/smart-cards/data';
import {campaigns,type CampaignId} from './catalog';

export async function getCampaignPage(campaign:CampaignId,person?:string,code?:string){
 const config=campaigns[campaign];
 if(!code&&!config.people.some(p=>p===(person??'austin')))return null;
 const card=await resolveCard(code??`${config.prefix}-${person??'austin'}`);
 if(!card||card.campaign!==campaign)return null;
 const profile=await getCardProfile(card.profile_slug);
 return profile?{profile,card}:null;
}
