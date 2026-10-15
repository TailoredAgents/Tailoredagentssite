<script lang="ts">
 import {invalidateAll} from '$app/navigation';import EmailBody from '$lib/components/EmailBody.svelte';
 let {data}=$props();let opened=$state('');let html=$state('');let text=$state('');let userId=$state('');let error=$state('');let notice=$state('');
 async function open(id:string){const r=await fetch(`/api/admin/unassigned/${id}`);const body=await r.json();if(!r.ok){error=body.error;return;}opened=id;html=body.html??'';text=body.text??'';}
 async function assign(){const r=await fetch(`/api/admin/unassigned/${opened}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId})});const body=await r.json();if(!r.ok){error=body.error;return;}notice='Assignment queued. The message and its files will appear in their inbox.';opened='';await invalidateAll();}
</script>
<svelte:head><title>Unassigned mail · Tailored Agents Mail</title></svelte:head>
<div class="ta-panel"><p class="ta-eyebrow">OWNER ONLY</p><h1>Unassigned mail</h1><p>Messages sent to addresses that do not have an active inbox. Review a message and choose who should receive it.</p>
 {#if error}<p role="alert" class="ta-error">{error}</p>{/if}{#if notice}<p role="status">{notice}</p>{/if}
 {#if !data.items.length}<div class="ta-card"><h2>All mail has a home.</h2><p>No unassigned messages right now.</p></div>{/if}
 {#each data.items as item}<div class="ta-card"><button onclick={()=>open(String(item.provider_id))}><strong>{String(item.subject)}</strong></button><p>From {String(item.sender)} · To {String(item.recipient)}</p>
 {#if opened===item.provider_id}{#if html}<EmailBody {html}/>{:else}<pre style="white-space:pre-wrap">{text}</pre>{/if}<label>Deliver to<select bind:value={userId}><option value="">Choose a teammate</option>{#each data.users as user}<option value={user.id}>{user.name} · {user.email}</option>{/each}</select></label><button class="ta-primary" disabled={!userId} onclick={assign}>Assign message</button>{/if}</div>{/each}
</div>
