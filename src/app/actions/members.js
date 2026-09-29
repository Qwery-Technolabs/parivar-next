'use server';
import { revalidatePath } from 'next/cache';
import { canManageGroup } from '@/lib/access';
import { audit } from '@/lib/audit';
import { getCurrentUser, hashPassword, passwordProblem, revokeUserSessions } from '@/lib/auth';
import { queryOne, setMeta, withTransaction } from '@/lib/db';
import { bool, date, id, oneOf, str, strOrNull } from '@/lib/forms';
import { isDescendant, MEMBER_META_KEYS } from '@/lib/members';
import { getSetting } from '@/lib/settings';
import { notify } from '@/lib/notifications';
import { normalizePhone } from '@/lib/phone';
import { assignableRoles, BLOOD_GROUPS, canChangeRole, canEditUser, canManageMembers } from '@/lib/roles';

const FORBIDDEN = { error: 'common.forbidden' };

function readMember(fd) {
    return {
        full_name: str(fd, 'full_name', 150),
        full_name_gu: strOrNull(fd, 'full_name_gu', 150),
        phoneRaw: str(fd, 'phone', 30),
        phone: normalizePhone(fd.get('phone')),
        gender: oneOf(fd, 'gender', ['male', 'female', 'other']),
        dob: date(fd, 'dob'),
        blood_group: oneOf(fd, 'blood_group', BLOOD_GROUPS),
        village: strOrNull(fd, 'village', 100),
        caste_id: id(fd, 'caste_id'),
        subcaste_id: id(fd, 'subcaste_id'),
        status: oneOf(fd, 'status', ['active', 'inactive', 'deceased'], 'active'),
        is_blood_donor: bool(fd, 'is_blood_donor') ? 1 : 0,
        role: str(fd, 'role', 20),
        password: String(fd.get('password') ?? ''),
        meta: Object.fromEntries(MEMBER_META_KEYS.map((k) => [k, str(fd, k, k === 'bio' || k === 'address' ? 2000 : 150)])),
    };
}

function validate(m, { requirePhone = true } = {}) {
    const fieldErrors = {};
    if (!m.full_name) fieldErrors.full_name = 'common.required';
    if (requirePhone && !m.phone) fieldErrors.phone = 'auth.errors.phoneInvalid';
    if (m.password) {
        const p = passwordProblem(m.password);
        if (p) fieldErrors.password = p;
    }
    return Object.keys(fieldErrors).length ? { fieldErrors } : null;
}

/**
 * The caste must exist and be top-level; the sub-caste must be a child of THAT caste.
 * A caste already on the member stays valid even if since deactivated.
 */
async function casteProblem(m, current = {}) {
    if (!m.caste_id) {
        m.subcaste_id = null;
        return null;
    }
    const c = await queryOne('SELECT id, parent_id, status FROM admin_castes WHERE id = :id', { id: m.caste_id });
    if (!c || c.parent_id != null || (c.status !== 'active' && c.id !== current.caste_id)) return { caste_id: 'castes.errors.invalid' };
    if (m.subcaste_id) {
        const sc = await queryOne('SELECT parent_id, status FROM admin_castes WHERE id = :id', { id: m.subcaste_id });
        if (!sc || sc.parent_id !== m.caste_id || (sc.status !== 'active' && m.subcaste_id !== current.subcaste_id))
            return { subcaste_id: 'castes.errors.invalid' };
    }
    return null;
}

async function phoneTaken(phone, exceptId = 0) {
    return Boolean(await queryOne('SELECT id FROM users_list WHERE phone = :phone AND id <> :exceptId', { phone, exceptId }));
}

export async function createMember(prev, fd) {
    const actor = await getCurrentUser();
    if (!actor || !canManageMembers(actor.role)) return FORBIDDEN;
    const m = readMember(fd);
    const bad = validate(m);
    if (bad) return bad;
    const role = assignableRoles(actor.role).includes(m.role) ? m.role : 'sabhyo';
    if (await phoneTaken(m.phone)) return { fieldErrors: { phone: 'auth.errors.phoneTaken' } };
    const casteErr = await casteProblem(m);
    if (casteErr) return { fieldErrors: casteErr };

    const hash = m.password ? await hashPassword(m.password) : null;
    const language = await getSetting('admin', 'default_language');
    const newId = await withTransaction(async (q) => {
        const r = await q(
            `INSERT INTO users_list (phone, password_hash, full_name, full_name_gu, gender, dob, blood_group, village,
                                     caste_id, subcaste_id, role, status, is_blood_donor, language, created_by)
             VALUES (:phone, :hash, :full_name, :full_name_gu, :gender, :dob, :blood_group, :village,
                     :caste_id, :subcaste_id, :role, :status, :is_blood_donor, :language, :by)`,
            { ...m, hash, role, language, by: actor.id },
        );
        await setMeta('users_list', r.insertId, m.meta, q);
        return r.insertId;
    });
    await audit(actor.id, 'user.create', 'user', newId, { role });
    revalidatePath('/members');
    return { ok: true, message: 'members.created', id: newId };
}

export async function updateMember(prev, fd) {
    const actor = await getCurrentUser();
    const targetId = id(fd, 'id');
    const target = targetId && (await queryOne('SELECT id, role, phone, caste_id, subcaste_id FROM users_list WHERE id = :targetId', { targetId }));
    if (!actor || !target || !canEditUser(actor, target)) return FORBIDDEN;

    const m = readMember(fd);
    const bad = validate(m);
    if (bad) return bad;
    if (m.phone !== target.phone && (await phoneTaken(m.phone, target.id))) {
        return { fieldErrors: { phone: 'auth.errors.phoneTaken' } };
    }
    const casteErr = await casteProblem(m, target);
    if (casteErr) return { fieldErrors: casteErr };
    // Role only changes when the actor may make exactly that change; otherwise it is left alone.
    const roleChanged = m.role && m.role !== target.role && canChangeRole(actor, target, m.role);
    const role = roleChanged ? m.role : target.role;
    const hash = m.password ? await hashPassword(m.password) : null;

    await withTransaction(async (q) => {
        await q(
            `UPDATE users_list SET phone = :phone, full_name = :full_name, full_name_gu = :full_name_gu, gender = :gender,
                    dob = :dob, blood_group = :blood_group, village = :village, caste_id = :caste_id,
                    subcaste_id = :subcaste_id, role = :role, status = :status,
                    is_blood_donor = :is_blood_donor ${hash ? ', password_hash = :hash' : ''}
              WHERE id = :id`,
            { ...m, role, id: target.id, ...(hash ? { hash } : {}) },
        );
        await setMeta('users_list', target.id, m.meta, q);
    });

    // A password reset or a deactivation must end sessions already open on other devices.
    if (hash || m.status !== 'active') await revokeUserSessions(target.id, actor.id === target.id);
    if (roleChanged) await audit(actor.id, 'user.role', 'user', target.id, { from: target.role, to: role });
    if (hash && actor.id !== target.id) await audit(actor.id, 'user.password_reset', 'user', target.id);
    await audit(actor.id, 'user.update', 'user', target.id);
    revalidatePath('/members');
    revalidatePath(`/members/${target.id}`);
    return { ok: true, message: hash && actor.id !== target.id ? 'members.passwordReset' : 'common.saved', id: target.id };
}

// ── relations ─────────────────────────────────────────────────────────────────

/**
 * relation (from the form): father | mother | spouse | child
 * Stored edges are only father / mother / spouse; "child" is written as the child's
 * father-or-mother edge, picked by the parent's gender.
 */
export async function addRelation(prev, fd) {
    const actor = await getCurrentUser();
    const personId = id(fd, 'person_id');
    const relativeId = id(fd, 'relative_id');
    const relation = oneOf(fd, 'relation', ['father', 'mother', 'spouse', 'child']);
    const person = personId && (await queryOne('SELECT id, role, gender FROM users_list WHERE id = :personId', { personId }));
    if (!actor || !person || !canEditUser(actor, person)) return FORBIDDEN;
    if (!relation) return { fieldErrors: { relation: 'common.required' } };
    if (!relativeId) return { fieldErrors: { relative_id: 'common.required' } };
    if (relativeId === personId) return { fieldErrors: { relative_id: 'relations.selfError' } };
    const relative = await queryOne('SELECT id, gender FROM users_list WHERE id = :relativeId', { relativeId });
    if (!relative) return { fieldErrors: { relative_id: 'common.required' } };

    let child;
    let parent;
    let parentRel;
    if (relation === 'father' || relation === 'mother') {
        child = person.id;
        parent = relative.id;
        parentRel = relation;
    } else if (relation === 'child') {
        child = relative.id;
        parent = person.id;
        parentRel = person.gender === 'female' ? 'mother' : 'father';
    }

    if (parentRel) {
        // A parent must not already be a descendant of the child, or the tree loops forever.
        if (await isDescendant(parent, child)) return { fieldErrors: { relative_id: 'relations.cycleError' } };
        await withTransaction(async (q) => {
            // One father and one mother: replacing is how a wrong link gets corrected.
            await q('DELETE FROM users_relations WHERE user_id = :child AND relation = :parentRel', { child, parentRel });
            await q('INSERT INTO users_relations (user_id, relative_id, relation) VALUES (:child, :parent, :parentRel)', {
                child,
                parent,
                parentRel,
            });
        });
    } else {
        // Spouse is symmetric; both directions are stored so either side reads it with one lookup.
        await withTransaction(async (q) => {
            for (const [a, b] of [[person.id, relative.id], [relative.id, person.id]]) {
                await q(
                    `INSERT IGNORE INTO users_relations (user_id, relative_id, relation) VALUES (:a, :b, 'spouse')`,
                    { a, b },
                );
            }
        });
    }
    await audit(actor.id, 'user.relation.add', 'user', person.id, { relation, relativeId });
    revalidatePath(`/members/${person.id}`);
    revalidatePath(`/members/${relative.id}`);
    return { ok: true, message: 'common.saved' };
}

/** Remove the edge between two people, whichever direction/kind it is. */
export async function removeRelation(personId, relativeId) {
    const actor = await getCurrentUser();
    const person = await queryOne('SELECT id, role FROM users_list WHERE id = :personId', { personId: Number(personId) });
    if (!actor || !person || !canEditUser(actor, person)) return FORBIDDEN;
    const a = Number(personId);
    const b = Number(relativeId);
    await withTransaction(async (q) => {
        await q(
            `DELETE FROM users_relations
              WHERE (user_id = :a AND relative_id = :b) OR (user_id = :b AND relative_id = :a)`,
            { a, b },
        );
    });
    await audit(actor.id, 'user.relation.remove', 'user', a, { relativeId: b });
    revalidatePath(`/members/${a}`);
    revalidatePath(`/members/${b}`);
    return { ok: true, message: 'common.deleted' };
}

// ── groups, from the directory ────────────────────────────────────────────────

/** "Make group admin" / "Add to group" from the Parivar Jano list. Upserts membership. */
export async function assignToGroup(prev, fd) {
    const actor = await getCurrentUser();
    const userId = id(fd, 'user_id');
    const groupId = id(fd, 'group_id');
    const memberRole = oneOf(fd, 'member_role', ['member', 'admin'], 'member');
    if (!groupId) return { fieldErrors: { group_id: 'common.required' } };
    if (!actor || !userId || !(await canManageGroup(actor, groupId))) return FORBIDDEN;

    const [user, group] = await Promise.all([
        queryOne('SELECT full_name FROM users_list WHERE id = :userId', { userId }),
        queryOne('SELECT name, name_gu FROM admin_groups WHERE id = :groupId', { groupId }),
    ]);
    if (!user || !group) return { error: 'common.error' };

    await withTransaction((q) =>
        q(
            `INSERT INTO admin_group_members (group_id, user_id, member_role, added_by)
             VALUES (:groupId, :userId, :memberRole, :by)
             ON DUPLICATE KEY UPDATE member_role = VALUES(member_role)`,
            { groupId, userId, memberRole, by: actor.id },
        ),
    );
    await audit(actor.id, memberRole === 'admin' ? 'group.admin' : 'group.member.add', 'group', groupId, { userId });
    await notify(userId, {
        type: memberRole === 'admin' ? 'group.admin' : 'group.member',
        data: { group: group.name, group_gu: group.name_gu },
        link: `/groups/${groupId}`,
        actorId: actor.id,
    });
    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/members/${userId}`);
    return memberRole === 'admin'
        ? { ok: true, message: 'members.madeAdmin', vars: { name: user.full_name, group: group.name } }
        : { ok: true, message: 'common.saved' };
}
