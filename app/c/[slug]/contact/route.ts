import {getCardProfile} from '@/lib/smart-cards/data';
import {vcard} from '@/lib/smart-cards/validation';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){const profile=await getCardProfile((await params).slug);if(!profile)return new Response('Contact unavailable',{status:404});return new Response(vcard(profile),{headers:{'Content-Type':'text/vcard; charset=utf-8','Content-Disposition':`attachment; filename="tailored-agents-${profile.slug}.vcf"`,'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});}
