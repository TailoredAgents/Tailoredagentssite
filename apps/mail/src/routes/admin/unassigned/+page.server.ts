import type {PageServerLoad} from './$types';
import {listUsers} from '$lib/server/auth';
export const load:PageServerLoad=async({platform})=>({items:(await platform!.env.DB.prepare('SELECT * FROM unassigned_mail WHERE assigned_user_id IS NULL ORDER BY created_at DESC LIMIT 100').all()).results,users:(await listUsers(platform!.env.DB)).filter(u=>!u.disabled_at)});
