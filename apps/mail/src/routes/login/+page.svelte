<script lang="ts">
  import { onMount } from 'svelte';
  let mounted = $state(false);
  onMount(() => { mounted = true; });
  import { goto,invalidateAll } from '$app/navigation';
  let email=$state(''); let password=$state(''); let busy=$state(false); let error=$state('');
  async function submit(event: SubmitEvent) {
    event.preventDefault(); busy=true; error='';
    try {
      const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      const body=await response.json(); if(!response.ok){error=body.error;return;}
      await invalidateAll(); await goto(body.user.must_change_password?'/account/setup':'/inbox');
    } catch {error='Could not connect. Please try again.';} finally {busy=false;}
  }
</script>
<svelte:head><title>Sign in · Tailored Agents Mail</title></svelte:head>
<main class="ta-welcome"><section class="ta-auth-card">
  <div class="ta-wordmark"><span>TA</span> TAILORED AGENTS</div>
  <p class="ta-eyebrow">A LITTLE MORE FOCUS.</p><h1>Your day starts here.</h1>
  <p>Sign in to your private team inbox.</p>
  <form onsubmit={submit}>
    <label>Email address<input type="email" autocomplete="username" placeholder="you@tailoredagents.com" bind:value={email} required /></label>
    <label>Password<input type="password" autocomplete="current-password" bind:value={password} required maxlength="128" /></label>
    {#if error}<p role="alert" class="ta-error">{error}</p>{/if}
    <button class="ta-primary" disabled={!mounted || busy}>{busy?'Signing in…':'Sign in'}</button>
    <p style="font-size:12px">Forgot your password? Ask your team owner to reset it.</p>
  </form>
</section></main>
