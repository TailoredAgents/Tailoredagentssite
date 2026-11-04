'use client';
import type {CardSource} from './types';

export function cardSession() {
 try { let id=sessionStorage.getItem('ta_card_session'); if(!id){id=crypto.randomUUID();sessionStorage.setItem('ta_card_session',id);}return id; }
 catch { return crypto.randomUUID(); }
}
export function trackCard(source:CardSource,event:string) {
 if(navigator.doNotTrack==='1'||(navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl)return;
 void fetch('/api/smart-cards/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...source,event,id:crypto.randomUUID(),sessionId:cardSession()}),keepalive:true}).catch(()=>undefined);
}
