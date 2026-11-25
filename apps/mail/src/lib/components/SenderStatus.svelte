<script lang="ts">
  import type { MessageSecurity } from '$lib/mail/security';
  let { security }: { security?: MessageSecurity } = $props();
</script>

{#if security}
  <div class="sender-status">
    <details>
      <summary class:verified={security.verification === 'verified'} class:failed={security.verification === 'failed'}>
        {security.verification === 'verified' ? 'Domain verified' : security.verification === 'failed' ? 'Sender authentication failed' : 'Sender not verified'}
        {#if security.senderDisposition === 'safe'} · Your safe sender{/if}
      </summary>
      <p>{security.verification === 'verified'
        ? 'The receiving server confirmed this message passed domain authentication. This verifies the sending domain, not the identity of a person or the safety of the content.'
        : security.verification === 'failed'
        ? 'The receiving server could not authenticate the claimed sending domain. This may be spoofing or a forwarding/configuration problem.'
        : 'No passing domain authentication result is available. Older messages may not have this evidence; this alone does not mean junk.'}</p>
      <p>SPF: {security.authentication.spf} · DKIM: {security.authentication.dkim} · DMARC: {security.authentication.dmarc}</p>
    </details>
    {#if security.junkReason}<p class="reason">{security.junkReason} Use Not junk to correct this and remember the sender.</p>{/if}
  </div>
{/if}

<style>
  .sender-status { margin-bottom: .75rem; font-size: .8125rem; color: var(--color-text-secondary); }
  summary { cursor: pointer; width: fit-content; font-weight: 600; }
  summary.verified { color: light-dark(#166534, #86efac); }
  summary.failed { color: light-dark(#9a3412, #fdba74); }
  p { margin: .4rem 0; line-height: 1.5; overflow-wrap: anywhere; }
  .reason { padding: .6rem .75rem; border-inline-start: 3px solid #c78835; background: var(--color-surface-muted); border-radius: .25rem; }
</style>
