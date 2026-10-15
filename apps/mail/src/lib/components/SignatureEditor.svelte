<script lang="ts">
 import { untrack } from 'svelte';
 import { invalidateAll } from '$app/navigation';
 import { MAX_EMAIL_SIGNATURE_LENGTH, MAX_SIGNATURE_BANNER_BYTES, normalizeBannerLink, signatureBannerUrl, type SignatureBanner } from '$lib/email-signature';

 let { signature, banner }: { signature: string; banner: SignatureBanner | null } = $props();
 let text = $state(untrack(() => signature));
 let savedBanner = $state(untrack(() => banner));
 let alt = $state(untrack(() => banner?.alt ?? ''));
 let link = $state(untrack(() => banner?.link ?? ''));
 let upload = $state<{ filename: string; content: string; width: number } | null>(null);
 let removed = $state(false), busy = $state(false), reading = $state(false);
 let error = $state(''), notice = $state(''), imageError = $state(false), dirty = $state(false);
 let fileInput: HTMLInputElement;
 const imageSource = $derived(removed ? '' : upload ? `data:${upload.filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'};base64,${upload.content}` : savedBanner ? signatureBannerUrl(savedBanner.id) : '');
 const previewWidth = $derived(Math.min(upload?.width ?? savedBanner?.width ?? 600,600));
 const previewLink = $derived.by(() => { try { return normalizeBannerLink(link); } catch { return ''; } });

 function edited() { dirty = true; notice = ''; }
 async function chooseImage(event: Event) {
  const file = (event.currentTarget as HTMLInputElement).files?.[0];
  if (!file) return;
  error = ''; notice = ''; reading = true;
  try {
   if (!['image/png','image/jpeg'].includes(file.type)) throw new Error('Choose a PNG or JPG image.');
   if (file.size > MAX_SIGNATURE_BANNER_BYTES) throw new Error('Choose a banner no larger than 1 MB.');
   const dataUrl = await new Promise<string>((resolve,reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The image could not be read. Try again.')); reader.readAsDataURL(file);
   });
   const image = new Image(); image.src = dataUrl;
   try { await image.decode(); } catch { throw new Error('This image could not be opened. Try another PNG or JPG.'); }
   if (image.naturalWidth > 6000 || image.naturalHeight > 6000 || image.naturalWidth * image.naturalHeight > 16000000) throw new Error('Choose a smaller image, up to 6,000 pixels per side and 16 million pixels in total.');
   upload = { filename: file.name.replace(/\.[^.]*$/, '') + (file.type === 'image/png' ? '.png' : '.jpg'), content: dataUrl.split(',')[1], width: image.naturalWidth };
   removed = false; imageError = false; edited();
  } catch (cause) { error = cause instanceof Error ? cause.message : 'The image could not be opened.'; }
  finally { reading = false; fileInput.value = ''; }
 }

 async function save(event: SubmitEvent) {
  event.preventDefault(); error = ''; notice = ''; busy = true;
  try {
   const response = await fetch('/api/settings/signature', { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({
    signature: text, bannerAlt: alt, bannerLink: link,
    ...(removed ? { banner: null } : upload ? { banner: { filename: upload.filename, content: upload.content } } : {})
   }) });
   const result = await response.json().catch(() => { throw new Error('Could not connect. Your changes are still here. Please try saving again.'); });
   if (!response.ok) throw new Error(result.error || 'Your signature could not be saved.');
   text = result.signature; savedBanner = result.banner; upload = null; removed = false; imageError = false;
   alt = result.banner?.alt ?? ''; link = result.banner?.link ?? ''; dirty = false;
   notice = 'Signature saved. It will be added to emails you send.';
   await invalidateAll();
  } catch (cause) { error = cause instanceof Error && !(cause instanceof TypeError) ? cause.message : 'Could not connect. Your changes are still here. Please try saving again.'; }
  finally { busy = false; }
 }
</script>

<section class="ta-panel signature-editor">
 <div class="signature-heading"><div><h2>Your signature</h2><p>Add your contact details and a banner to the end of new emails, replies, and forwards.</p></div><span class="signature-tag">PERSONAL TO YOU</span></div>
 <form onsubmit={save}>
  <fieldset disabled={busy || reading}>
   <label>Signature text<textarea bind:value={text} oninput={edited} maxlength={MAX_EMAIL_SIGNATURE_LENGTH} rows="4" placeholder="Your name&#10;Your role · Tailored Agents&#10;Your phone number"></textarea></label>
   <div class="banner-upload">
    <div><strong>Banner or logo</strong><p>PNG or JPG, up to 1 MB. A wide image around 1,200 × 300 pixels works well.</p><small>The banner counts toward your email’s 20 MB attachment limit.</small></div>
    <input bind:this={fileInput} id="signature-banner-file" class="file-picker" type="file" tabindex="-1" accept="image/png,image/jpeg" aria-label="Upload signature banner" onchange={chooseImage} />
    <div class="banner-actions"><button class="ta-button" type="button" onclick={() => fileInput.click()}>{reading ? 'Reading image…' : imageSource ? 'Replace banner' : 'Upload banner'}</button>
    {#if imageSource}<button class="ta-button" type="button" onclick={() => { removed = true; upload = null; alt = ''; link = ''; imageError = false; edited(); }}>Remove banner</button>{/if}</div>
   </div>
   {#if imageSource}
    <div class="banner-details"><div><label>Image description<input bind:value={alt} oninput={edited} maxlength="160" placeholder="Tailored Agents — your name and contact details" aria-describedby="signature-alt-hint" /></label><small id="signature-alt-hint">Shown if an email reader cannot display the image.</small></div>
    <div><label>Banner link (optional)<input bind:value={link} oninput={edited} maxlength="2048" placeholder="https://tailoredagents.com" aria-describedby="signature-link-hint" /></label><small id="signature-link-hint">Where someone goes when they click your banner.</small></div></div>
   {/if}
   <div class="signature-preview-label">SIGNATURE PREVIEW</div>
   <div class="signature-preview">
    {#if text.trim()}<div class="signature-text">{text}</div>{/if}
    {#if imageSource}
     <div class="signature-image" style:width={`${previewWidth}px`}>
      {#if previewLink}<a href={previewLink} target="_blank" rel="noopener noreferrer"><img src={imageSource} alt={alt || 'Email signature'} onerror={() => imageError = true} /></a>
      {:else}<img src={imageSource} alt={alt || 'Email signature'} onerror={() => imageError = true} />{/if}
     </div>
    {:else if !text.trim()}<p class="empty-preview">Your signature will appear here.</p>{/if}
   </div>
   {#if imageError}<p class="ta-error" role="alert">Your banner could not be displayed. Try uploading it again.</p>{/if}
   <div class="signature-footer"><button class="ta-primary" type="submit">{busy ? 'Saving…' : 'Save signature'}</button>{#if dirty}<span>Unsaved changes</span>{/if}</div>
  </fieldset>
  {#if error}<p class="ta-error" role="alert">{error}</p>{/if}
  {#if notice}<p class="signature-success" role="status">{notice}</p>{/if}
 </form>
</section>

<style>
 .signature-editor { min-width:0; }
 .signature-heading { display:flex; gap:20px; align-items:flex-start; justify-content:space-between; }
 .signature-heading p,.banner-upload p { margin:6px 0; }
 .signature-tag { flex-shrink:0; font-size:10px; font-weight:700; letter-spacing:.08em; padding:7px 9px; border-radius:6px; background:var(--color-accent-soft,#eaf2ff); color:var(--color-text-secondary); }
 fieldset { padding:0; margin:20px 0 0; border:0; min-width:0; }
 fieldset:disabled { opacity:.75; }
 .banner-upload { border:1px dashed var(--z-border,#d7e1ee); border-radius:12px; padding:18px; margin:18px 0; }
 small { display:block; font-size:12px; color:var(--color-text-secondary); line-height:1.5; margin-top:5px; }
 .banner-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
 .file-picker { position:absolute; width:1px; height:1px; padding:0; border:0; overflow:hidden; clip-path:inset(50%); }
 .banner-details { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
 .banner-details label { min-width:0; }
 .signature-preview-label { font-size:11px; letter-spacing:.08em; font-weight:700; margin:24px 0 10px; color:var(--color-text-secondary); }
 .signature-preview { background:white; color:#17243b; border:1px solid #d7e1ee; padding:24px; border-radius:12px; min-height:90px; overflow-wrap:anywhere; }
 .signature-text { white-space:pre-wrap; font:15px/1.6 Arial,sans-serif; }
 .signature-image { max-width:100%; margin-top:12px; }
 .signature-image img { display:block; width:100%; height:auto; }
 .empty-preview { color:#63738b; margin:0; }
 .signature-footer { display:flex; align-items:center; gap:16px; margin-top:20px; }
 .signature-footer span { font-size:12px; color:var(--color-text-secondary); }
 .signature-success { font-size:14px; margin-top:12px; }
 @media(max-width:640px) { .banner-details { grid-template-columns:1fr; } .signature-tag { display:none; } .signature-preview { padding:16px; } }
</style>
