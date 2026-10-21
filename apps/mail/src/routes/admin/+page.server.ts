import type { PageServerLoad } from './$types';
import { listUsers } from '$lib/server/auth';
import { listAllAddresses } from '$lib/server/domains';
import { listCrmGrants } from '$lib/server/crm-mail-grants';
export const load: PageServerLoad = async ({platform,locals}) => {
  const db=platform!.env.DB;
  return { users:await listUsers(db),addresses:await listAllAddresses(db),domains:locals.domains,crmGrants:await listCrmGrants(db) };
};
