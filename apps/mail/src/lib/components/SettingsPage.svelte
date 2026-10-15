<script lang="ts">
 import {onMount,untrack} from 'svelte';
 import {page} from '$app/stores';
 import {invalidateAll} from '$app/navigation';
 import {setThemePreference,type ThemePreference} from '$lib/theme';
 import type {SettingsSection} from '$lib/settings-section';
 let {data,section='all'}:{data:{signature:string};section?:SettingsSection}=$props();
 let signature=$state(untrack(()=>data.signature)),notice=$state(''),error=$state('');
 let blocked=$state<{address:string}[]>([]),address=$state(''),labelName=$state(''),color=$state('blue');
 let currentPassword=$state(''),newPassword=$state('');
 const show=(name:string)=>section==='all'||section===name;
 async function action(url:string,method:string,body:unknown){
  error='';notice='';try{const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const b=await r.json();if(!r.ok){error=b.error;return false;}await invalidateAll();return true;}catch{error='Could not connect. Please try again.';return false;}
 }
 async function loadBlocked(){const r=await fetch('/api/settings/blocked');if(r.ok)blocked=(await r.json()).senders;}
 onMount(()=>{void loadBlocked();});
 async function block(){if(await action('/api/settings/blocked','POST',{address})){address='';await loadBlocked();}}
 async function password(){if(await action('/api/settings/password','POST',{currentPassword,newPassword}))window.location.href='/login';}
</script>
<svelte:head><title>Settings · Tailored Agents Mail</title></svelte:head>
<div class="ta-page">
 <a href="/inbox">← Inbox</a><h1>Settings</h1>
 {#if error}<p role="alert" class="ta-warning">{error}</p>{/if}
 {#if notice}<p role="status">{notice}</p>{/if}
 {#if show('general')}
 <section class="ta-panel"><h2>Your signature</h2><p>This text is added to messages you send.</p>
 <form onsubmit={async(e)=>{e.preventDefault();if(await action('/api/settings/signature','PATCH',{signature}))notice='Signature saved.';}}>
 <label>Signature<textarea bind:value={signature} maxlength="10000" rows="5"></textarea></label><button class="ta-button">Save signature</button></form></section>
 <section class="ta-panel"><h2>Blocked senders</h2><p>New messages from these addresses go to Junk.</p><form class="ta-inline" onsubmit={(e)=>{e.preventDefault();void block();}}><label>Email address<input type="email" required bind:value={address}/></label><button class="ta-button">Block sender</button></form>
 {#each blocked as sender}<div class="ta-inline"><span>{sender.address}</span><button onclick={async()=>{if(await action('/api/settings/blocked','DELETE',{address:sender.address}))await loadBlocked();}}>Unblock</button></div>{/each}</section>
 <section class="ta-panel"><h2>Change your password</h2><p>Use a phrase of at least 12 characters. You will sign in again afterward.</p><form onsubmit={(e)=>{e.preventDefault();void password();}}><label>Current password<input type="password" autocomplete="current-password" required bind:value={currentPassword}/></label><label>New password<input type="password" autocomplete="new-password" minlength="12" maxlength="128" required bind:value={newPassword}/></label><button class="ta-button">Change password</button></form></section>
 {/if}
 {#if show('appearance')}<section class="ta-panel"><h2>Appearance</h2><div class="ta-inline">{#each ['light','dark','system'] as mode}<button class="ta-button" onclick={()=>setThemePreference(mode as ThemePreference)}>{mode==='system'?'Match my device':mode==='light'?'Light':'Dark'}</button>{/each}</div></section>{/if}
 {#if show('labels')}<section class="ta-panel"><h2>Labels</h2><p>Give messages your own labels to keep work organized.</p><form class="ta-inline" onsubmit={async(e)=>{e.preventDefault();if(await action('/api/labels','POST',{name:labelName,color}))labelName='';}}><label>Label name<input required maxlength="40" bind:value={labelName}/></label><label>Color<select bind:value={color}>{#each ['blue','green','purple','orange','red','gray'] as c}<option>{c}</option>{/each}</select></label><button class="ta-button">Create label</button></form>
 {#each $page.data.labels??[] as label}<div class="ta-inline"><span>{label.name}</span><button onclick={()=>action(`/api/labels/${label.id}`,'DELETE',{})}>Remove label</button></div>{/each}</section>{/if}
 {#if show('shortcuts')}<section class="ta-panel"><h2>Keyboard shortcuts</h2><p>These work when you are not typing in a text box.</p><dl><dt>C</dt><dd>Compose</dd><dt>R / A / F</dt><dd>Reply / Reply all / Forward</dd><dt>E / D / S / U</dt><dd>Archive / Trash / Star / Mark unread</dd><dt>Command or Ctrl + K</dt><dd>Search</dd><dt>Command or Ctrl + Enter</dt><dd>Send the open message</dd><dt>Escape</dt><dd>Close</dd></dl><h2>Search tips</h2><p>Try <code>from:someone@example.com</code>, <code>to:you@tailoredagents.com</code>, <code>subject:invoice</code>, <code>after:2026-01-01</code>, <code>before:2026-02-01</code>, or <code>has:attachment</code>. Combine these with words from the message.</p></section>{/if}
</div>
