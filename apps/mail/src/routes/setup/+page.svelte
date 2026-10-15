<script lang="ts">
  import { onMount } from 'svelte';
  let mounted = $state(false);
  onMount(() => { mounted = true; });
  import { goto, invalidateAll } from '$app/navigation';
  let { data } = $props();
  let name = $state('Jeffrey'); let localPart = $state('jeffrey'); let password = $state(''); let secret = $state('');
  let error = $state(''); let busy = $state(false);
  async function submit(event: SubmitEvent) {
    event.preventDefault(); busy = true; error = '';
    try {
      const response = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, localPart, password, secret }) });
      const body = await response.json();
      if (!response.ok) { error = body.error; return; }
      await invalidateAll(); await goto('/inbox');
    } catch { error = 'Could not connect. Your information has not been lost; please try again.'; }
    finally { busy = false; }
  }
</script>
<svelte:head><title>Welcome · Tailored Agents Mail</title></svelte:head>
<main class="ta-welcome"><section class="ta-auth-card">
  <div class="ta-wordmark"><span>TA</span> TAILORED AGENTS</div>
  <p class="ta-eyebrow">YOUR TEAM. YOUR INBOX.</p><h1>Welcome to better workdays.</h1>
  <p>Create the owner account for your team’s private mail.</p>
  <form onsubmit={submit}>
    <label>Owner setup key<input type="password" autocomplete="off" bind:value={secret} required /></label>
    <label>Your name<input autocomplete="name" bind:value={name} required maxlength="128" /></label>
    <label>Your email address<div class="ta-address"><input bind:value={localPart} required  aria-label="Email name" /><span>@{data.domain}</span></div></label>
    <label>Password<input type="password" autocomplete="new-password" bind:value={password} minlength="12" maxlength="128" required /></label>
    <small>A memorable phrase of at least 12 characters works well.</small>
    {#if error}<p role="alert" class="ta-error">{error}</p>{/if}
    <button class="ta-primary" disabled={!mounted || busy}>{busy ? 'Creating your inbox…' : 'Create my inbox'}</button>
  </form>
</section></main>
