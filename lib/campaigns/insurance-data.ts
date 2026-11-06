import 'server-only';
import {getCampaignPage} from './data';

export async function getInsurancePage(person?:string,code?:string) {
 return getCampaignPage('commercial-insurance',person,code);
}
