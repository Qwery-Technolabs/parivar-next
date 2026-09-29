import 'server-only';
import { query } from './db';

/**
 * Record an admin action. Never throws — a failed audit write must not undo the action
 * the person already saw succeed.
 * @param {number|null} actorId
 * @param {string} action   dotted verb, e.g. 'user.role', 'group.admin', 'fundraise.expense.add'
 * @param {string} entity   'user' | 'group' | 'fundraise' | 'blood' | 'event'
 * @param {number|null} entityId
 * @param {object} [detail]
 */
export async function audit(actorId, action, entity, entityId, detail) {
    try {
        await query(
            `INSERT INTO admin_audit_log (actor_id, action, entity, entity_id, detail)
             VALUES (:actorId, :action, :entity, :entityId, :detail)`,
            { actorId, action, entity, entityId, detail: detail ? JSON.stringify(detail) : null },
        );
    } catch (err) {
        console.error('audit write failed', action, err.message);
    }
}
