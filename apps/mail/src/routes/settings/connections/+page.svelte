<script lang="ts">
 import type {PageData} from './$types';
 let {data}:{data:PageData}=$props();
 const scopeNames:Record<string,string>={'mail:read':'Read mail','mail:send':'Send mail','mail:manage':'Manage mailbox'};
</script>
<svelte:head><meta name="referrer" content="same-origin"/><title>Connected assistants · Tailored Agents Mail</title></svelte:head>
<section class="connections ta-page">
<p class="ta-eyebrow">ACCOUNT ACCESS</p>
<h1>Connected assistants</h1>
<p>Connections access mail owned by {data.user?.email}. CRM shared-mailbox permissions do not extend to assistants. Disconnecting stops access and pending external sends.</p>
<p>Grant only the permissions you want. Your assistant’s client must confirm each send and destructive action; permission to connect is not permission to act autonomously.</p>
{#each data.apps as app}
 <article><h2>{app.client_name}</h2><ul class="ta-permission-list">{#each app.scopes as scope}<li title={scope}>{scopeNames[scope]??scope}</li>{/each}</ul>
 <form method="POST" action="?/revoke"><input type="hidden" name="client_id" value={app.client_id}/><button class="ta-secondary ta-danger-outline">Disconnect</button></form></article>
{:else}<p>No connected assistants.</p>{/each}
<a href="/inbox">Back to Mail</a>
</section>
<style>p{margin:1rem 0;line-height:1.7}article{padding:22px;border:1px solid var(--color-line);border-radius:14px;margin:20px 0;background:var(--color-surface)}h2{font-size:18px;font-weight:600;margin-bottom:14px}</style>
