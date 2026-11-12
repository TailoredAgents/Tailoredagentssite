<script lang="ts">
 import type {PageData,ActionData} from './$types';
 let {data,form}:{data:PageData;form:ActionData}=$props();
</script>
<svelte:head><title>Confirm permanent deletion · Tailored Agents Mail</title><meta name="referrer" content="same-origin"/></svelte:head>
<section class="ta-confirm">
{#if data.completed || (form && 'deleted' in form)}<h1>Message deleted</h1><a href="/inbox">Return to Mail</a>
{:else if data.pending}
<p class="ta-eyebrow">IRREVERSIBLE ACTION</p><h1>Permanently delete this message?</h1>
<p>Account: {data.user?.email}</p><p>From: {data.pending.from_addr}</p><p>Subject: {data.pending.subject}</p>
<p>This removes this message, its attachments and search entries from your mailbox. It cannot be restored in Mail. Stored files follow the service’s existing retention policy.</p>
<form method="POST"><label>Type DELETE to confirm <input name="confirmation" autocomplete="off" required pattern="DELETE"/></label><button class="ta-danger">Permanently delete</button></form>
{#if form && 'message' in form}<p role="alert">{form.message}</p>{/if}
<a href="/inbox">Cancel</a>
{/if}
</section>
