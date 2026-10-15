import { json, type RequestHandler } from '@sveltejs/kit';
import { storeDraft, type DraftInput } from '$lib/server/drafts';
export const POST: RequestHandler = async ({ request,locals,platform }) => {
  if (!locals.user || !platform?.env.DB || !platform.env.ATTACHMENTS) return json({error:'Please sign in.'},{status:401});
  try {
    const input: DraftInput = await request.json();
    const id = await storeDraft(platform.env.DB,platform.env.ATTACHMENTS,locals.user,input);
    return json({ok:true,id});
  } catch (error) { return json({error:error instanceof Error ? error.message : 'Could not save your draft.'},{status:400}); }
};
