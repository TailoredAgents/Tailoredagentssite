import {ImageResponse} from 'next/og';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {getCardProfile} from '@/lib/smart-cards/data';
import {cardPortraits} from '@/lib/smart-cards/portraits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, {params}: {params: Promise<{slug: string}>}) {
  const profile = await getCardProfile((await params).slug);
  if (!profile) return new Response('Profile unavailable', {status: 404, headers: {'Cache-Control': 'no-store'}});
  const portrait = cardPortraits[profile.slug];
  const [logo, photo] = await Promise.all([
    readFile(join(process.cwd(), 'public/brand/tailored-agents-logo.png')),
    portrait ? readFile(join(process.cwd(), 'public', portrait.publicPath)) : null,
  ]);
  const initials = profile.display_name.split(/\s+/).map(part => part[0]).slice(0, 2).join('');
  return new ImageResponse(
    <div style={{display: 'flex', width: '100%', height: '100%', background: '#f4f6fa', color: '#172b42', fontFamily: 'Arial, sans-serif', padding: '54px 58px', position: 'relative'}}>
      <div style={{display: 'flex', position: 'absolute', right: 0, top: 0, width: 405, height: 630, background: '#e4ebf6'}}/>
      <div style={{display: 'flex', flexDirection: 'column', width: 650, paddingRight: 44, justifyContent: 'space-between'}}>
        <img src={`data:image/png;base64,${logo.toString('base64')}`} width={234} height={77} alt="Tailored Agents"/>
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <div style={{display: 'flex', color: '#245ade', fontSize: 18, fontWeight: 700, letterSpacing: 3, marginBottom: 18}}>CONNECT WITH</div>
          <div style={{display: 'flex', fontSize: profile.display_name.length > 28 ? 42 : 60, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1}}>{profile.display_name}</div>
          <div style={{display: 'flex', marginTop: 17, fontSize: 26, lineHeight: 1.2, color: '#53677d'}}>{profile.title}</div>
          <div style={{display: 'flex', marginTop: 31, fontSize: 21, color: '#245ade'}}>Save my contact. Meet our AI.</div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', borderTop: '1px solid #d1dbea', paddingTop: 21, gap: 9}}>
          <div style={{display: 'flex', fontSize: 18, color: '#53677d'}}>Websites · Software · AI &amp; automation</div>
          <div style={{display: 'flex', fontSize: 23, fontWeight: 700}}>tailoredagents.com/c/{profile.slug}</div>
        </div>
      </div>
      <div style={{display: 'flex', position: 'relative', flex: 1, height: 522, borderRadius: 26, overflow: 'hidden', background: 'linear-gradient(145deg, #142d47, #315fa5)', alignItems: 'center', justifyContent: 'center'}}>
        {photo ? <img src={`data:image/png;base64,${photo.toString('base64')}`} width={434} height={522} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '45% center'}} alt=""/> :
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34, color: '#f4f7ff'}}>
            <div style={{display: 'flex', width: 212, height: 212, border: '1px solid #87aae0', borderRadius: 106, alignItems: 'center', justifyContent: 'center', fontSize: 91, letterSpacing: -6}}>{initials}</div>
            <div style={{display: 'flex', fontSize: 16, letterSpacing: 2}}>PEOPLE. IDEAS. POSSIBILITIES.</div>
          </div>}
      </div>
    </div>,
    {width: 1200, height: 630, headers: {'Cache-Control': 'public, max-age=300', 'X-Robots-Tag': 'noindex'}},
  );
}
