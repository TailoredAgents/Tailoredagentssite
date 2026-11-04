import 'server-only';
import {getCardProfile,resolveCard} from '@/lib/smart-cards/data';
import {insuranceCampaign} from './insurance';

export async function getInsurancePage(person?:string,code?:string) {
 // A permanent link's saved destination is authoritative, including reassignment.
 if(code){
  const card=await resolveCard(code);
  if(!card||card.campaign!==insuranceCampaign)return null;
  const profile=await getCardProfile(card.profile_slug);
  return profile?{profile,card}:null;
 }
 const slug=person??'austin';
 if(!['austin','jeffrey'].includes(slug))return null;
 const card=await resolveCard(`insurance-${slug}`);
 if(!card||card.campaign!==insuranceCampaign)return null;
 const profile=await getCardProfile(card.profile_slug);
 return profile?{profile,card}:null;
}
