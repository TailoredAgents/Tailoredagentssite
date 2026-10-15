<script lang="ts">
 import {invalidateAll} from '$app/navigation';let {data}=$props();let error=$state('');
 async function retry(id:unknown){const response=await fetch('/api/admin/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});const body=await response.json();error=response.ok?'':body.error;await invalidateAll();}
</script>
<svelte:head><title>Mail status · Tailored Agents Mail</title></svelte:head>
<div class="ta-panel"><p class="ta-eyebrow">OWNER SETTINGS</p><h1>Mail status</h1><p>Delivery checks and recovery for {data.domain}.</p>
 <div class="ta-card"><strong>{data.configured?'Email credentials are configured':'Email credentials still need setup'}</strong><p>{data.messages} saved messages. <button class="ta-secondary" onclick={()=>invalidateAll()}>Refresh status</button></p></div>
 <div class="ta-card"><strong>{data.storageAvailable?'File storage is reachable':'File storage needs attention'}</strong><p>{data.pendingFiles} files still downloading.</p><p>Last successful check for missed incoming mail: {data.lastReceiveCheck??'Not run yet'}</p></div>
 {#if error}<p role="alert" class="ta-error">{error}</p>{/if}
 {#if data.maintenanceError}<p role="alert" class="ta-error">{data.maintenanceError}</p>{/if}
 <section class="ta-card"><h2>Incoming mail and delivery updates</h2>{#if !data.jobs.length}<p>Nothing is waiting for attention.</p>{/if}
 {#each data.jobs as job}<div class="ta-team-row"><div><strong>{String(job.kind)}</strong><small>{String(job.state)} · {String(job.attempts)} attempts · {String(job.updated_at)}</small></div>{#if job.state==='attention'||job.state==='retry'}<button onclick={()=>retry(job.id)}>Try again</button>{/if}</div>{/each}</section>
 <section class="ta-card"><h2>Outgoing messages awaiting confirmation</h2>{#if !data.sends.length}<p>No unconfirmed sends.</p>{/if}{#each data.sends as send}<p>Send reference: {String(send.id)}<br/>Last checked: {String(send.updated_at)}</p>{/each}
 <p>For a send still uncertain after 23 hours, check <a href="https://resend.com/emails" target="_blank" rel="noreferrer">Resend’s delivery history</a> before sending another copy.</p></section>
 <section class="ta-card"><h2>Recovery</h2><p>Trash is kept for 30 days. Deleted file copies are retained for 32 more days to support database restoration. The deployment guide explains how to restore and verify a backup.</p></section>
</div>
