import {ImageResponse} from 'next/og';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {getCampaignPage} from '@/lib/campaigns/data';
import {cardPortraits} from '@/lib/smart-cards/portraits';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const q=new URL(request.url).searchParams;
 const data=await getCampaignPage('freight-automation',q.get('person')??undefined,q.get('card')??undefined);
 if(!data)return new Response('Campaign unavailable',{status:404,headers:{'Cache-Control':'no-store'}});
 const portrait=cardPortraits[data.profile.slug];
 const [logo,photo]=await Promise.all([readFile(join(process.cwd(),'public/brand/tailored-agents-logo.png')),portrait?readFile(join(process.cwd(),'public',portrait.publicPath)):null]);
 return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',background:'#f4f7fc',color:'#132d4b',padding:'52px 58px',fontFamily:'Arial',position:'relative'}}><div style={{display:'flex',flexDirection:'column',width:720}}><img src={`data:image/png;base64,${logo.toString('base64')}`} width={220} height={72} alt=""/><span style={{marginTop:44,color:'#285bdb',fontSize:16,letterSpacing:3}}>FREIGHT BROKERAGES & 3PL</span><div style={{display:'flex',fontSize:61,letterSpacing:-2,lineHeight:1.08,marginTop:18,maxWidth:660}}>Freight moves. Paperwork should too.</div><div style={{display:'flex',fontSize:23,color:'#53677e',marginTop:23}}>Less document handling. More operational capacity.</div><div style={{display:'flex',fontSize:20,color:'#285bdb',marginTop:34}}>Book a workflow review with {data.profile.display_name.split(' ')[0]} →</div></div><div style={{display:'flex',flexDirection:'column',width:320,marginLeft:20,justifyContent:'center'}}>{photo&&portrait?<img src={`data:${portrait.mimeType};base64,${photo.toString('base64')}`} width={300} height={340} style={{objectFit:'cover',borderRadius:20}} alt=""/>:null}<div style={{display:'flex',fontSize:25,marginTop:22}}>{data.profile.display_name}</div><div style={{display:'flex',fontSize:16,color:'#53677e',marginTop:8}}>Tailored Agents</div></div></div>,{width:1200,height:630,headers:{'Cache-Control':'public, max-age=300','X-Robots-Tag':'noindex'}});
}
