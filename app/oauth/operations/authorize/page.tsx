import styles from './consent.module.css';
import {BrandLogo} from '@/components/brand-logo';
import {headers} from 'next/headers';
import {ConsentForm} from './consent-form';
import {redirect} from 'next/navigation';
import {getDashboardAuth} from '@/lib/dashboard/auth';
import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {validateAuthorization,createConsent} from '@/lib/assistant/oauth';
import {cardRateLimit} from '@/lib/smart-cards/http';
import {hash} from '@/lib/assistant/oauth';
import {scopeLabels,isWriteScope} from '@/lib/assistant/config';
import type {Metadata} from 'next';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Connect your assistant',robots:{index:false,follow:false},referrer:'same-origin'};
export default async function Authorize({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const raw=await searchParams;let v;
 try{if(Object.values(raw).some(x=>Array.isArray(x)))throw new Error();v=await validateAuthorization(raw as Record<string,string|undefined>);}catch{return <section className={styles.page}><div className={styles.card}><BrandLogo compact/><h1>Connection link unavailable</h1><p>Start a new connection from your assistant. The application or requested permissions could not be verified.</p></div></section>;}
 const context=await getOptionalDashboardContext();
 if(!context){const q=new URLSearchParams(Object.entries(raw).filter((e):e is [string,string]=>typeof e[1]==='string'));redirect('/sign-in?next='+encodeURIComponent('/oauth/operations/authorize?'+q));}
 const session=await getDashboardAuth()?.api.getSession({headers:await headers()});if(!session)redirect('/sign-in');
 await cardRateLimit('assistant:authorize',hash(context.user.id),30,60);
 const nonce=await createConsent(v,context,session.session.id);
 return <section className={styles.page}><div className={styles.card}><BrandLogo compact/><p className={styles.eyebrow}>PRIVATE WORKSPACE ACCESS</p><h1>Connect your assistant</h1><p><strong>{v.clientName}</strong> is requesting access to Tailored Agents Operations.</p><p>Account: <strong>{context.user.email}</strong><br/>Workspace: {context.workspace.name}</p><p>This application name is supplied by the connecting client. Only continue if you started this connection.</p><ConsentForm><input type="hidden" name="nonce" value={nonce}/>{v.scopes.map(scope=><label key={scope} className={styles.permission}><input type="checkbox" name={'scope:'+scope} defaultChecked={scope==='operations:read'} disabled={context.role==='viewer'&&isWriteScope(scope)}/> {scopeLabels[scope]}</label>)}{context.role!=='viewer'&&v.scopes.some(isWriteScope)&&<label className={styles.direct}><input type="checkbox" name="directActions"/> <strong>Allow direct actions without asking me each time</strong><br/>The bot may perform supported actions using the permissions selected above, including sending texts if selected. Activity is recorded; pause or disconnect it anytime in Assistant.</label>}<p>Leave direct actions off to review each proposed change in your dashboard. Your selected permissions and existing spending limits apply in either mode. Mail sending stays in your existing Mail connection. This connection expires with the sign-in used here (up to 14 days); signing out or losing account access stops it.</p><div className={styles.actions}><button name="decision" value="allow" className={styles.primary}>Allow selected access</button>{' '}<button name="decision" value="deny">Cancel</button></div></ConsentForm></div></section>;
}
