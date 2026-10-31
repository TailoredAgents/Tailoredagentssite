<script lang="ts">
 import type {PageData,ActionData} from './$types';
 let {data,form}:{data:PageData;form:ActionData}=$props();
 const request=$derived(data.request);
 const invalid=$derived(form?.invalid??data.invalid);
 const choices=[
  {scope:'mail:read',title:'Read mail',detail:'Search and read conversations, sent mail, drafts and attachments. Reading does not mark mail read.'},
  {scope:'mail:send',title:'Send mail',detail:'Send, reply and forward from addresses you own. Sending cannot be recalled. Ask your assistant to confirm each send.'},
  {scope:'mail:manage',title:'Manage mailbox',detail:'Create and edit drafts, mark read/unread, archive, label, move to Trash and restore. Permanent deletion needs a separate confirmation in Mail.'}
 ];
</script>
<svelte:head><meta name="referrer" content="same-origin"/><title>Connect an assistant · Tailored Agents Mail</title><meta name="robots" content="noindex"/></svelte:head>
<main class="consent">
{#if request && !invalid}
 <p class="eyebrow">TAILORED AGENTS MAIL</p>
 <h1>Connect {request.client.client_name}</h1>
 <p>The client supplied this name. Check the callback address before granting access.</p>
 <p class="callback">Callback: {request.redirectUri}</p>
 <section><h2>Your account</h2><strong>{data.user?.name} · {data.user?.email}</strong>
 <p><strong>Mailboxes:</strong> {data.addresses.map(a=>a.address).join(', ')||'No owned addresses'}</p>
 <p>Access includes existing and future mail owned by this account. CRM shared-address grants are separate; this does not expose another user's mailbox.</p></section>
 <form method="POST">
  <h2>Choose permissions</h2>
  <p>Read-only is selected by default. You can explicitly select all three.</p>
  {#each choices as choice}
   <label class="permission"><input type="checkbox" name="grant_scope" value={choice.scope} checked={choice.scope==='mail:read'} aria-label={choice.title}/><span><strong>{choice.title}</strong><small>{choice.detail}</small></span></label>
  {/each}
  <p>Connecting is not permission to send unsolicited mail or act autonomously. Your assistant's client must ask before sending or performing destructive actions.</p>
  <input type="hidden" name="user_id" value={data.user?.id}/>
  <input type="hidden" name="client_id" value={request.client.client_id}/>
  <input type="hidden" name="redirect_uri" value={request.redirectUri}/>
  <input type="hidden" name="response_type" value="code"/>
  <input type="hidden" name="scope" value={request.scope.join(' ')}/>
  <input type="hidden" name="code_challenge" value={request.codeChallenge}/>
  <input type="hidden" name="code_challenge_method" value="S256"/>
  <input type="hidden" name="resource" value={request.resource}/>
  {#if request.state!==null}<input type="hidden" name="state" value={request.state}/>{/if}
  <div class="actions"><button name="decision" value="deny" class="btn-ghost">Cancel</button><button name="decision" value="allow" class="btn-primary">Allow selected permissions</button></div>
 </form>
 <a href="/settings/connections">Manage or disconnect assistants</a>
{:else}
 <h1>Connection unavailable</h1><p>{invalid?.message??'Open the connection again from your assistant.'}</p><a href="/inbox">Return to Mail</a>
{/if}
</main>
<style>
 .consent {width:calc(100% - 2rem);max-width:38rem;margin:2rem auto;padding:1.5rem;border:1px solid var(--color-line);border-radius:1rem;background:var(--color-surface)}
 h1 {font-size:1.6rem;font-weight:650;margin:1rem 0} h2 {font-size:1rem;font-weight:650;margin:1rem 0}
 p {font-size:.875rem;line-height:1.6;margin:.75rem 0;color:var(--color-text-secondary)}
 section {padding:1rem;background:var(--color-surface-muted);border-radius:.75rem;margin:1rem 0}
 .eyebrow {font-size:.7rem;letter-spacing:.12em} .callback {overflow-wrap:anywhere}
 .permission {display:flex;align-items:flex-start;gap:.75rem;padding:1rem;border:1px solid var(--color-line);border-radius:.75rem;margin:.5rem 0;cursor:pointer}
 input[type=checkbox] {margin-top:.25rem;width:1rem;height:1rem;flex-shrink:0}
 small {display:block;font-size:.8rem;line-height:1.5;margin-top:.25rem;color:var(--color-text-secondary)}
 .actions {display:flex;gap:.75rem;flex-wrap:wrap;margin:1.5rem 0} button {padding:.75rem 1rem}
 a {font-size:.875rem;text-decoration:underline}
</style>
