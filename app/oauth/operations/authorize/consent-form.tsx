'use client';
import {useState,type ReactNode,type FormEvent} from 'react';

export function ConsentForm({children}:{children:ReactNode}){
 const [pending,setPending]=useState(false),[error,setError]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(pending)return;
  const form=event.currentTarget;
  const button=(event.nativeEvent as SubmitEvent).submitter;
  const fields=new FormData(form,button);
  setPending(true);setError('');
  try{
   const response=await fetch('/oauth/operations/consent',{method:'POST',credentials:'same-origin',headers:{accept:'application/json','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(Array.from(fields,([key,value])=>[key,String(value)]))});
   const result=await response.json();
   if(!response.ok||typeof result.redirectTo!=='string')throw new Error();
   // The server validates this registered callback and binds it to the consumed
   // consent. A normal navigation avoids CSP form-action blocking the redirect.
   window.location.assign(result.redirectTo);
  }catch{setError('The connection could not finish. Start a fresh connection from your assistant and try again.');setPending(false);}
 }
 return <form method="post" action="/oauth/operations/consent" onSubmit={submit} aria-busy={pending}>
  <fieldset disabled={pending} style={{border:0,padding:0,margin:0}}>{children}</fieldset>
  {pending&&<p role="status">Returning to your assistant…</p>}
  {error&&<p role="alert">{error}</p>}
 </form>;
}
