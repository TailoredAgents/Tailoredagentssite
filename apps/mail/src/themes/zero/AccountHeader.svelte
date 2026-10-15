<script lang="ts">
 import {setThemePreference} from '$lib/theme';
 import type {ThemeShellData} from '$lib/ui-theme/types';
 let {data,collapsed,onLogout}: {data:ThemeShellData;collapsed:boolean;onLogout:()=>Promise<void>;onLogoutAll?:()=>Promise<void>}=$props();
 let open=$state(false);
</script>
<div class="ta-account">
 <a href="/inbox" class="ta-brand" aria-label="Tailored Agents Mail"><img src="/tailored-icon.svg" alt="" width="34" height="34"/>{#if !collapsed}<span>TAILORED AGENTS<small>MAIL</small></span>{/if}</a>
 <button class="ta-account-button" aria-label="Your account" aria-expanded={open} onclick={()=>open=!open}>{#if !collapsed}<span><strong>{data.user.name}</strong><small>{data.user.email}</small></span>{/if}<span>•••</span></button>
 {#if open}<div class="ta-account-menu">
 {#if data.user.is_admin}<a href="/admin" onclick={()=>open=false}>Manage team</a>{/if}
 <a href="/settings/general" onclick={()=>open=false}>Settings</a>
 <button onclick={()=>{setThemePreference(document.documentElement.dataset.theme==='dark'?'light':'dark');open=false;}}>Switch light / dark</button>
 <button onclick={()=>onLogout()}>Sign out</button>
 </div>{/if}
</div>
<style>
 .ta-account{padding:20px 16px 14px;position:relative}.ta-brand{display:flex;align-items:center;gap:10px;color:var(--z-fg);text-decoration:none}.ta-brand img{flex-shrink:0}.ta-brand span{font-size:10px;font-weight:750;letter-spacing:1px}.ta-brand small{display:block;margin-top:4px;color:var(--z-muted);font-size:9px;letter-spacing:2px}.ta-account-button{margin-top:22px;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;width:100%;color:var(--z-fg);cursor:pointer;min-height:44px}.ta-account-button strong{font-size:13px;font-weight:600}.ta-account-button small{font-size:11px;display:block;margin-top:4px;color:var(--z-muted);word-break:break-all}.ta-account-menu{position:absolute;top:100%;left:12px;right:12px;z-index:30;background:var(--z-panel);border:1px solid var(--z-border);border-radius:12px;padding:8px;box-shadow:0 12px 32px #0002}.ta-account-menu a,.ta-account-menu button{display:block;text-align:left;width:100%;padding:10px;border-radius:6px;font-size:13px;cursor:pointer;min-height:44px}.ta-account-menu a:hover,.ta-account-menu button:hover{background:var(--z-hover)}
</style>
