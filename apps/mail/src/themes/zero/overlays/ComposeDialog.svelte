<script lang="ts">
	import {focusTrap} from '$lib/utils/focus-trap';
	import { untrack, onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { htmlToPlainText, isHtmlEmpty } from '$lib/utils/html';
	import type { MailAddress, OutboundAttachmentInput } from '$lib/types';
	import Icon from '../icons/Icon.svelte';
	import ComposerActions from './ComposerActions.svelte';
	import { t } from '$lib/i18n';

	let suggestions = $state<string[]>([]);
	onMount(()=>{void fetch('/api/recipients').then(r=>r.json()).then(b=>{suggestions=b.addresses??[];}).catch(()=>{});});

	let {
		addresses,
		draftId = null,
		onClose
	}: {
		addresses: MailAddress[];
		draftId?: string | null;
		onClose: () => void;
	} = $props();

	const defaultAddressId = $derived(
		addresses.find((address) => address.is_default)?.id ?? addresses[0]?.id ?? ''
	);
	let chosenAddressId = $state('');
	const fromAddressId = $derived(chosenAddressId || defaultAddressId);

	let activeDraft = $state<string | null>(null);
	let ready = $state(false);
	let context = $state<import('$lib/server/drafts').DraftContext>();
	let savedSnapshot = $state('');
	let savedFilesSnapshot = '';
	let uploadPercent = $state(0);
	let to = $state('');
	let cc = $state('');
	let bcc = $state('');
	let subject = $state('');
	let html = $state('');
	let attachments = $state<OutboundAttachmentInput[]>([]);
	let showCc = $state(false);
	let showBcc = $state(false);
	let error = $state('');
	let sending = $state(false);
	// One key per message: a resubmit after a dropped response can't send twice.
	let sendKey: string = crypto.randomUUID();
	let savingDraft = $state(false);

	$effect(() => {
		const id = draftId ?? crypto.randomUUID();
		activeDraft = id;
		ready = !draftId;
		sendKey = `draft:${id}`;
	});

	$effect(() => {
		const id = draftId;
		if (!id) return;
		void fetch(`/api/drafts/${id}`)
			.then(async (response) => {
				const draft = (await response.json()) as {
					id?: string;
                    context?: import('$lib/server/drafts').DraftContext;
					to_addr?: string;
					cc_addr?: string | null;
					bcc_addr?: string | null;
					subject?: string;
					body_html?: string | null;
					body_text?: string | null;
					address_id?: string | null;
					attachments?: OutboundAttachmentInput[];
					error?: string;
				};
				if (!response.ok || !draft.id) {
					error = draft.error ?? t('compose.couldNotLoadDraft');
					return;
				}
				activeDraft = draft.id;
                context = draft.context;
				to = draft.to_addr ?? '';
				cc = draft.cc_addr ?? '';
				bcc = draft.bcc_addr ?? '';
				subject = draft.subject ?? '';
				html = draft.body_html || draft.body_text || '';
				attachments = draft.attachments ?? [];
				ready = true;
				if (draft.address_id) chosenAddressId = draft.address_id;
				showCc = Boolean(draft.cc_addr);
				showBcc = Boolean(draft.bcc_addr);
			})
			.catch(() => {
				error = t('compose.couldNotLoadDraft');
			});
	});

	const hasDraftText = $derived(Boolean(to.trim() || cc.trim() || bcc.trim() || subject.trim() || !isHtmlEmpty(html) || attachments.length));

	const snapshot = $derived(JSON.stringify({fromAddressId,to,cc,bcc,subject,html,attachments,context}));
	$effect(() => {
		const current = snapshot;
		if (!ready || !hasDraftText || sending || savingDraft || current === savedSnapshot) return;
		const timer = setTimeout(() => { void untrack(() => saveDraft()); },1200);
		return () => clearTimeout(timer);
	});
	function uploadDraft(payload: string): Promise<Response> {
		return new Promise((resolve,reject) => {
			const xhr = new XMLHttpRequest(); xhr.open('POST','/api/drafts'); xhr.setRequestHeader('Content-Type','application/json');
			xhr.upload.onprogress = (event) => { if (event.lengthComputable) uploadPercent = Math.round(event.loaded/event.total*100); };
			xhr.onload = () => resolve(new Response(xhr.responseText,{status:xhr.status,headers:{'Content-Type':'application/json'}}));
			xhr.onerror = () => reject(new Error('Network error')); xhr.send(payload);
		});
	}

	async function saveDraft(): Promise<boolean> {
		if (!ready || savingDraft || !hasDraftText) return false;
		const savingSnapshot = snapshot;
        const filesSnapshot = JSON.stringify(attachments);
		uploadPercent = 0;
		savingDraft = true;
		error = '';
		try {
			const response = await uploadDraft(JSON.stringify({
					id: activeDraft, context,
					fromAddressId,
					to,
					cc: cc.trim() || undefined,
					bcc: bcc.trim() || undefined,
					subject,
					html,
					text: isHtmlEmpty(html) ? '' : htmlToPlainText(html), attachments: filesSnapshot===savedFilesSnapshot?undefined:attachments
			}));
			const body = (await response.json()) as { id?: string; error?: string };
			if (!response.ok) {
				error = body.error ?? t('compose.couldNotSaveDraft');
				return false;
			}
			activeDraft = body.id ?? activeDraft;
			savedSnapshot = savingSnapshot;
            savedFilesSnapshot = filesSnapshot;
			return true;
		} catch {
			error = t('common.networkError');
			return false;
		} finally {
			savingDraft = false;
		}
	}

	async function send(event: SubmitEvent) {
		event.preventDefault();
		if (sending || savingDraft || !ready) return;
		if (!await saveDraft()) return;
		if (isHtmlEmpty(html) && !context?.mode.startsWith('forward')) {
			error = t('compose.writeMessage');
			return;
		}
		sending = true;
		error = '';
		try {
			const endpoint = context ? (context.mode==='forwardAll' ? `/api/mail/thread/${encodeURIComponent(context.targetId)}/forward` : `/api/mail/${encodeURIComponent(context.targetId)}${context.mode==='forward'?'/forward':''}`) : '/api/mail';
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Idempotency-Key': sendKey },
				body: JSON.stringify({
					draftId: activeDraft ?? undefined,
                    includeAttachments: context?.includeAttachments,
					fromAddressId,
					to,
					cc: cc.trim() || undefined,
					bcc: bcc.trim() || undefined,
					subject,
					html,
					text: htmlToPlainText(html),
					attachments
				})
			});
			const body = (await response.json()) as { error?: string };
			if (!response.ok) {
				error = body.error ?? t('compose.failedToSend');
				return;
			}
			if (context && activeDraft) await fetch(`/api/drafts/${activeDraft}`,{method:'DELETE'});
			sendKey = crypto.randomUUID();
			await invalidateAll();
			onClose();
		} catch {
			error = t('common.networkError');
		} finally {
			sending = false;
		}
	}

	async function close() {
		if (savingDraft || sending) return;
		if (hasDraftText && !await saveDraft()) return;
		onClose();
	}

	function onKey(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			event.preventDefault();
			(event.target as HTMLElement | null)?.closest('form')?.requestSubmit();
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			void close();
		}
	}
</script>
<datalist id="mail-recipient-suggestions">{#each suggestions as address}<option value={address}></option>{/each}</datalist>

<div use:focusTrap class="z-overlay" onkeydown={onKey} role="dialog" aria-modal="true" tabindex="-1">
	<div class="z-compose-stage">
		<button type="button" class="z-esc" aria-label={t('common.close')} onclick={close}>
			<Icon name="X" size={14} />
			<span>esc</span>
		</button>

		<form class="z-composer" onsubmit={send}>
			<div class="z-composer-fields">
				<div class="z-composer-row">
					<span class="z-composer-label">{t('compose.toColon')}</span>
					<input class="z-composer-input" bind:value={to} list="mail-recipient-suggestions" aria-label="To" required placeholder={t('compose.emailPlaceholder')} />
					<div class="z-composer-row-actions">
						<button type="button" class="z-composer-link" onclick={() => (showCc = !showCc)}>{t('compose.cc')}</button>
						<button type="button" class="z-composer-link" onclick={() => (showBcc = !showBcc)}>{t('compose.bcc')}</button>
						<Tooltip text={t('common.close')}>
							<button type="button" class="z-composer-link" aria-label={t('common.close')} onclick={close}>
								<Icon name="X" size={14} />
							</button>
						</Tooltip>
					</div>
				</div>
				{#if showCc}
					<div class="z-composer-row">
						<span class="z-composer-label">{t('compose.ccColon')}</span>
						<input class="z-composer-input" bind:value={cc} list="mail-recipient-suggestions" aria-label="CC" placeholder={t('compose.ccPlaceholder')} />
					</div>
				{/if}
				{#if showBcc}
					<div class="z-composer-row">
						<span class="z-composer-label">{t('compose.bccColon')}</span>
						<input class="z-composer-input" bind:value={bcc} list="mail-recipient-suggestions" aria-label="BCC" placeholder={t('compose.bccPlaceholder')} />
					</div>
				{/if}
				<div class="z-composer-row">
						<span class="z-composer-label">{t('compose.subjectColon')}</span>
						<input class="z-composer-input" bind:value={subject} required placeholder={t('compose.subject')} />
				</div>
				{#if addresses.length > 1}
					<div class="z-composer-row">
						<span class="z-composer-label">{t('compose.fromColon')}</span>
						<select
							class="z-composer-input"
							value={fromAddressId}
							onchange={(event) => (chosenAddressId = event.currentTarget.value)}
						>
							{#each addresses as address (address.id)}
								<option value={address.id}>
									{address.label ? `${address.label} · ${address.address}` : address.address}
								</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>

			<div class="z-composer-body">
				<RichTextEditor bind:html embedded minHeight={200} placeholder={t('compose.writeMessagePlaceholder')} />
			</div>

			<p class="ta-save-status" aria-live="polite">{savingDraft ? `Saving… ${uploadPercent}%` : savedSnapshot === snapshot && hasDraftText ? 'Saved' : hasDraftText ? 'Unsaved changes' : 'Drafts save automatically'}</p>
			<ComposerActions bind:attachments {sending} disabled={savingDraft || !ready} {error}>
				{#snippet extra()}
					<button
						type="button"
						class="z-text-btn"
						onclick={saveDraft}
						disabled={savingDraft || !hasDraftText}
					>
						{savingDraft ? t('common.saving') : t('compose.saveDraft')}
					</button>
				{/snippet}
			</ComposerActions>
		</form>
	</div>
</div>
