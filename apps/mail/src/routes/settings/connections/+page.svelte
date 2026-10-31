<script lang="ts">
 import type {PageData} from './$types';
 let {data}:{data:PageData}=$props();
</script>
<svelte:head><meta name="referrer" content="same-origin"/><title>Connected assistants · Tailored Agents Mail</title></svelte:head>
<section class="connections">
<h1>Connected assistants</h1>
<p>Connections access mail owned by {data.user?.email}. CRM shared-mailbox permissions do not extend to assistants. Disconnecting stops access and pending external sends.</p>
<p>Grant only the permissions you want. Your assistant’s client must confirm each send and destructive action; permission to connect is not permission to act autonomously.</p>
{#each data.apps as app}
 <article><h2>{app.client_name}</h2><p>{app.scopes.join(', ')}</p>
 <form method="POST" action="?/revoke"><input type="hidden" name="client_id" value={app.client_id}/><button class="btn-ghost">Disconnect</button></form></article>
{:else}<p>No connected assistants.</p>{/each}
<a href="/inbox">Back to Mail</a>
</section>
<style>.connections{max-width:48rem;margin:2rem auto;padding:1.5rem}p{margin:1rem 0;line-height:1.6}article{padding:1rem;border:1px solid var(--color-line);border-radius:.75rem;margin:1rem 0}</style>
