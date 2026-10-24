'use server';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { canManageSettings, canViewAudit } from '@/lib/roles';

// 'login' = sign-ins (lib/auth createSession).
const ENTITIES = ['login', 'user', 'group', 'fundraise', 'blood', 'event', 'caste', 'settings'];

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
    const search = String(q ?? '')
        .trim()
        .slice(0, 100);
    if (search) {
        conds.push('(a.action LIKE :q OR u.full_name LIKE :q OR u.full_name_local LIKE :q)');
        params.q = `%${search}%`;
    }
    const where = conds.length ? conds.join(' AND ') : '1=1';
    const r = await query(`DELETE a FROM admin_audit_log a LEFT JOIN users_list u ON u.id = a.actor_id WHERE ${where}`, params);
    await audit(user.id, 'audit.clear', 'settings', null, {
        count: r.affectedRows,
        entity: params.entity ?? 'all',
        member: params.actor ?? undefined,
        q: search || undefined,
    });
    revalidatePath('/settings');
    return { ok: true, count: r.affectedRows };
}

const ACTIVITY_PAGE = 30;
/**
 * Members list ⋮ → Activity history: what this member did (actor) — sign-ins (auth.login) and every change they
 * made — newest first, 30 at a time (`before` = the last id shown, for “Show more”). Sub-admins and up, like the
 * Activity log in Settings. Administrators may clear it there (filter by member) or in the pop-up.
 */
export async function loadMemberActivity(userId, before = null) {
    const user = await getCurrentUser();
    const uid = Number(userId);
    if (!user || !canViewAudit(user.role) || !Number.isInteger(uid) || uid <= 0) return { error: 'common.forbidden' };
    const b = Number(before);
    const older = Number.isInteger(b) && b > 0;
    // The page size is a constant, inlined on purpose (design-system.md §9).
    const rows = await query(
        `SELECT a.id, a.action, a.entity, a.entity_id, a.detail, a.created_at
           FROM admin_audit_log a
          WHERE a.actor_id = :uid ${older ? 'AND a.id < :b' : ''}
          ORDER BY a.id DESC
          LIMIT ${ACTIVITY_PAGE + 1}`,
        older ? { uid, b } : { uid },
    );
    return {
        rows: rows.slice(0, ACTIVITY_PAGE).map((r) => ({
            id: Number(r.id),
            action: r.action,
            entity: r.entity,
            entity_id: r.entity_id,
            detail: typeof r.detail === 'string' ? r.detail : r.detail ? JSON.stringify(r.detail) : null,
            at: String(r.created_at),
        })),
        more: rows.length > ACTIVITY_PAGE,
        canClear: canManageSettings(user.role),
    };
}
