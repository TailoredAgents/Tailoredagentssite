import type {CampaignId} from '@/lib/campaigns/catalog';
export type CardProfile = { slug:string; display_name:string; title:string; email:string; phone:string; intro:string; published:boolean };
export type Card = { code:string; profile_slug:string; label:string; kind:'personal'|'giveaway'; active:boolean; campaign?:CampaignId|null };
export type CardChannel = 'nfc'|'qr'|'direct';
export type ChatMessage = { role:'user'|'assistant'; content:string };
export const CARD_WORKSPACE = '00000000-0000-4000-8000-000000000001';
export const CARD_ORIGIN = 'https://www.tailoredagents.com';
export function cardUrl(code:string, channel:'nfc'|'qr') { return `${CARD_ORIGIN}/go/${encodeURIComponent(code)}?via=${channel}`; }

export type CardSource={profile:string;card?:string;channel:CardChannel;campaign?:CampaignId|null};
