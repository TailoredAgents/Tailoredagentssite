import {readDraftContent} from '$lib/server/drafts';
import { json, type RequestHandler } from '@sveltejs/kit';
import { deleteDraft, getDraft } from '$lib/server/mail-store';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	const db = platform?.env.DB;
	if (!db || !locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const draft = await getDraft(db, locals.user.id, params.id!);
	if (!draft) {
		return json({ error: 'Not found' }, { status: 404 });
	}

    let full;
    try{full=draft.content_key?await readDraftContent(platform!.env.ATTACHMENTS,draft.content_key):null;}catch{return json({error:'Saved draft or attachment temporarily unavailable. Contact the owner.'},{status:503});}

	return json({
		attachments: full?.attachments ?? [],
        context: full?.context,
		id: draft.id,
		to_addr: draft.to_addr,
		cc_addr: draft.cc_addr,
		bcc_addr: draft.bcc_addr,
		subject: draft.subject,
		body_html: full?.html ?? draft.body_html,
		body_text: full?.text ?? draft.body_text,
		from_addr: draft.from_addr,
		address_id: draft.address_id
	});
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	const db = platform?.env.DB;
	if (!db || !locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	await deleteDraft(db, locals.user.id, params.id!);

	return json({ ok: true });
};
