import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ platform }) => ({ domain: platform?.env.MAIL_DOMAIN ?? 'tailoredagents.com' });
