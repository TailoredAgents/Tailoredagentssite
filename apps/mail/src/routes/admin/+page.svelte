<script lang="ts">
  import {invalidateAll} from '$app/navigation';
  let {data}=$props(); let name=$state('');let localPart=$state('');let password=$state('');let error=$state('');let notice=$state('');let busy=$state(false);let resetId=$state('');let resetPassword=$state('');let aliasUser=$state('');let aliasName=$state('');
  async function change(url:string,body:unknown) {
    busy=true;error='';notice='';
    try { const response=await fetch(url,{method:(url==='/api/admin/users'||url==='/api/addresses')?'POST':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await response.json(); if(!response.ok){error=result.error;return false;} await invalidateAll();return true;
    }catch{error='Could not connect. Please try again.';return false;}finally{busy=false;}
  }
  async function add(event:SubmitEvent){event.preventDefault();if(await change('/api/admin/users',{name,localPart,password,domainId:data.domains[0]?.id})){name='';localPart='';password='';notice='Account created. Give your teammate their temporary password privately.';}}
  async function reset(event:SubmitEvent){event.preventDefault();if(await change(`/api/admin/users/${resetId}`,{password:resetPassword})){resetId='';resetPassword='';notice='Password reset. Existing sessions have been signed out.';}}
</script>
<svelte:head><title>Your team · Tailored Agents Mail</title></svelte:head>
<div class="ta-panel"><p class="ta-eyebrow">OWNER SETTINGS</p><h1>Your team</h1><p>Each person gets a private inbox. You manage their access here.</p>
  {#if error}<p role="alert" class="ta-error">{error}</p>{/if}{#if notice}<p role="status">{notice}</p>{/if}
  <section class="ta-card"><h2>Create an account</h2><form class="ta-form-grid" onsubmit={add}>
    <label>Name<input bind:value={name} required maxlength="128" /></label>
    <label>Email name<input bind:value={localPart} placeholder="name" required /><small>@{data.domains[0]?.name ?? 'tailoredagents.com'}</small></label>
    <label>Temporary password<input type="password" bind:value={password} required minlength="12" maxlength="128" autocomplete="new-password" /></label>
    <button class="ta-primary" disabled={busy || !data.domains.length}>Create account</button>
  </form><p style="font-size:12px">They must choose a new password when they first sign in.</p></section>
  <section class="ta-card"><h2>Team members</h2>{#each data.users as user(user.id)}<div class="ta-team-row">
    <div><strong>{user.name}</strong><small>{user.email}{user.is_admin?' · Owner':''}{user.disabled_at?' · Disabled':''}</small><small>Website dashboard: {user.dashboard_access ? 'Approved' : 'Not approved'}</small></div>
    <div><button onclick={()=>{resetId=user.id;resetPassword='';}}>Reset password</button>
    {#if !user.is_admin}<button disabled={busy || !!user.disabled_at} onclick={()=>change(`/api/admin/users/${user.id}`,{dashboardAccess:!user.dashboard_access})}>{user.dashboard_access?'Remove dashboard access':'Allow dashboard access'}</button><button disabled={busy} onclick={()=>change(`/api/admin/users/${user.id}`,{disabled:!user.disabled_at})}>{user.disabled_at?'Enable access':'Disable access'}</button>{/if}</div>
  </div>{/each}</section>
  <section class="ta-card"><h2>Add an email address</h2><p>Extra addresses deliver to the selected person’s private inbox.</p><form class="ta-form-grid" onsubmit={async(e)=>{e.preventDefault();if(await change('/api/addresses',{userId:aliasUser,localPart:aliasName,domainId:data.domains[0]?.id})){aliasName='';notice='Address added.';}}}><label>Team member<select required bind:value={aliasUser}><option value="">Choose a person</option>{#each data.users.filter(u=>!u.disabled_at) as user}<option value={user.id}>{user.name}</option>{/each}</select></label><label>Email name<input required bind:value={aliasName}/><small>@{data.domains[0]?.name}</small></label><button class="ta-primary" disabled={busy}>Add address</button></form>{#each data.addresses as address}<p>{address.address} → {data.users.find(u=>u.id===address.user_id)?.name}</p>{/each}</section>
  {#if resetId}<section class="ta-card"><h2>Reset password</h2><form onsubmit={reset}><label>New temporary password<input type="password" bind:value={resetPassword} required minlength="12" maxlength="128" autocomplete="new-password" /></label><button class="ta-primary" style="margin-top:14px" disabled={busy}>Reset and sign out existing sessions</button><button type="button" class="ta-secondary" onclick={()=>resetId=''}>Cancel</button></form></section>{/if}
  <p><a href="/admin/status">Mail status and recovery →</a> &nbsp; <a href="/admin/unassigned">Unassigned mail →</a></p>
</div>
