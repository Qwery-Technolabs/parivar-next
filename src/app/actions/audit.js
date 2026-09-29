'use server';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { canManageSettings } from '@/lib/roles';

const ENTITIES = ['user', 'group', 'fundraise', 'blood', 'event', 'caste', 'settings'];

/**
 * Delete the activity-log entries matching a filter (type, member and/or search; none = all).
 * Administrators only. The clearing itself is logged afterwards — who, how many, which
 * filter — so the log never loses entries without a trace.
 */
export async function clearAuditLog(entity, q, actor = null) {
    const user = await getCurrentUser();
    if (!user || !canManageSettings(user.role)) return { error: 'common.forbidden' };
    const conds = [];
    const params = {};
    if (ENTITIES.includes(entity)) {
        conds.push('a.entity = :entity');
        params.entity = entity;
    }
    const actorId = Number(actor);
    if (Number.isInteger(actorId) && actorId > 0) {
        conds.push('a.actor_id = :actor');
        params.actor = actorId;
    }
    const search = String(q ?? '').trim().slice(0, 100);
    if (search) {
        conds.push('(a.action LIKE :q OR u.full_name LIKE :q OR u.full_name_local LIKE :q)');
        params.q = `%${search}%`;
    }
    const where = conds.length ? conds.join(' AND ') : '1=1';
    const r = await query(`DELETE a FROM admin_audit_log a LEFT JOIN users_list u ON u.id = a.actor_id WHERE ${where}`, params);
    await audit(user.id, 'audit.clear', 'settings', null, { count: r.affectedRows, entity: params.entity ?? 'all', member: params.actor ?? undefined, q: search || undefined });
    revalidatePath('/settings');
    return { ok: true, count: r.affectedRows };
}
