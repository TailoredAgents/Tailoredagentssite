import {headers} from 'next/headers';
import {ConsentForm} from './consent-form';
import {redirect} from 'next/navigation';
import {getDashboardAuth} from '@/lib/dashboard/auth';
import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {validateAuthorization,createConsent} from '@/lib/assistant/oauth';
import {cardRateLimit} from '@/lib/smart-cards/http';
import {hash} from '@/lib/assistant/oauth';
import {scopeLabels} from '@/lib/assistant/config';
import type {Metadata} from 'next';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Connect your assistant',robots:{index:false,follow:false},referrer:'same-origin'};
export default async function Authorize({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const raw=await searchParams;let v;
 try{if(Object.values(raw).some(x=>Array.isArray(x)))throw new Error();v=await validateAuthorization(raw as Record<string,string|undefined>);}catch{return <section style={{padding:32}}><h1>Connection link unavailable</h1><p>Start a new connection from your assistant. The application or requested permissions could not be verified.</p></section>;}
 const context=await getOptionalDashboardContext();
 if(!context){const q=new URLSearchParams(Object.entries(raw).filter((e):e is [string,string]=>typeof e[1]==='string'));redirect('/sign-in?next='+encodeURIComponent('/oauth/operations/authorize?'+q));}
 const session=await getDashboardAuth()?.api.getSession({headers:await headers()});if(!session)redirect('/sign-in');
 await cardRateLimit('assistant:authorize',hash(context.user.id),30,60);
 const nonce=await createConsent(v,context,session.session.id);
 return <section style={{maxWidth:680,margin:'40px auto',padding:24,fontFamily:'system-ui',lineHeight:1.65}}><h1>Connect your assistant</h1><p><strong>{v.clientName}</strong> is requesting access to Tailored Agents Operations.</p><p>Account: <strong>{context.user.email}</strong><br/>Workspace: {context.workspace.name}</p><p>This application name is supplied by the connecting client. Only continue if you started this connection.</p><ConsentForm><input type="hidden" name="nonce" value={nonce}/>{v.scopes.map(scope=><label key={scope} style={{display:'block',margin:'18px 0'}}><input type="checkbox" name={'scope:'+scope} defaultChecked={scope==='operations:read'} disabled={context.role==='viewer'&&scope.endsWith(':write')}/> {scopeLabels[scope]}</label>)}<p>Changes are prepared for review in your Assistant dashboard. Mail sending stays in your existing Mail connection. This connection expires with the sign-in used here (up to 14 days); signing out or losing account access stops it.</p><button name="decision" value="allow" style={{padding:12}}>Allow selected access</button>{' '}<button name="decision" value="deny" style={{padding:12}}>Cancel</button></ConsentForm></section>;
}
