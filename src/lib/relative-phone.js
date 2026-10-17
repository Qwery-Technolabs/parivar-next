import 'server-only';
import { relationPath } from './family';
import { atLeast } from './roles';
import { getSetting } from './settings';

/** Close relatives: at most this many family steps from the relative (father = 1, Kaka = 2, cousin = 3 …). */
const CLOSE_STEPS = 4;

/**
 * May `actor` give a phone number (and with it a login) to a relative who has none — Settings → General
 * "Who can add a relative's phone number" (admin `relative_phone_by`, any of):
 *   admins    app administrators and sub-admins
 *   added_by  whoever added that relative (for a new relative: the one adding them)
 *   close     close relatives — up to CLOSE_STEPS family steps from that relative
 *   anyone    anyone who may edit that person / family (the callers check that right first)
 * A super admin always may. The callers have already checked the edit right; this narrows it.
 * @param {{ id: number, role: string }} actor
 * @param {{ target?: { id: number, created_by?: number|null } | null, familyOf?: { id: number } | null, steps?: number|null }} opts
 *   target: an existing person without a phone; familyOf: the person a NEW relative is added to (one step further);
 *   steps: actor → (target ?? familyOf) steps when already known (the profile page has it; null = not related),
 *   left out = looked up.
 */
export async function canAddRelativePhone(actor, { target = null, familyOf = null, steps } = {}) {
    if (!actor) return false;
    if (actor.role === 'super_admin') return true;
    const allowed = new Set(await getSetting('admin', 'relative_phone_by'));
    if (allowed.has('anyone')) return true;
    if (allowed.has('admins') && atLeast(actor.role, 'sub_admin')) return true;
    if (allowed.has('added_by') && (target ? target.created_by === actor.id : true)) return true;
    if (allowed.has('close')) {
        const base = target ?? familyOf;
        if (!base) return false;
        const extra = target ? 0 : 1; // a new relative is one step beyond the person they are added to
        if (base.id === actor.id) return extra <= CLOSE_STEPS;
        const n = steps !== undefined ? steps : ((await relationPath(actor.id, base.id))?.steps.length ?? null); // null = not related
        return n != null && n + extra <= CLOSE_STEPS;
    }
    return false;
}
