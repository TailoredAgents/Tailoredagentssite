<script lang="ts">
 import type {PageData,ActionData} from './$types';
 let {data,form}:{data:PageData;form:ActionData}=$props();
</script>
<svelte:head><title>Confirm permanent deletion · Tailored Agents Mail</title><meta name="referrer" content="same-origin"/></svelte:head>
<section>
{#if data.completed || (form && 'deleted' in form)}<h1>Message deleted</h1><a href="/inbox">Return to Mail</a>
{:else if data.pending}
<h1>Permanently delete this message?</h1>
<p>Account: {data.user?.email}</p><p>From: {data.pending.from_addr}</p><p>Subject: {data.pending.subject}</p>
<p>This removes this message, its attachments and search entries from your mailbox. It cannot be restored in Mail. Stored files follow the service’s existing retention policy.</p>
<form method="POST"><label>Type DELETE to confirm <input name="confirmation" autocomplete="off" required pattern="DELETE"/></label><button class="btn-primary">Permanently delete</button></form>
{#if form && 'message' in form}<p role="alert">{form.message}</p>{/if}
<a href="/inbox">Cancel</a>
{/if}
</section>
<style>section{max-width:36rem;margin:3rem auto;padding:2rem}p{margin:1rem 0}form{display:grid;gap:1rem;margin:1.5rem 0}input{display:block;border:1px solid var(--color-line);padding:.5rem;margin:.5rem 0}</style>
