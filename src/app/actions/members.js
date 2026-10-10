'use server';
import { revalidatePath } from 'next/cache';
import { groupStanding } from '@/lib/access';
import { canActOnRole } from '@/lib/group-roles';
import { audit } from '@/lib/audit';
import { getCurrentUser, hashPassword, passwordProblem, revokeUserSessions } from '@/lib/auth';
import { getMeta, inList, query, queryOne, setMeta, withTransaction } from '@/lib/db';
import { bool, date, id, oneOf, str, strOrNull } from '@/lib/forms';
import { postMemberNote } from '@/lib/chat';
import { MEMBER_META_KEYS } from '@/lib/members';
import { applySurnameCastes } from '@/lib/surnames';
import { composeName } from '@/lib/names';
import { getSetting } from '@/lib/settings';
import { notify, notifyMany } from '@/lib/notifications';
import { ensureInvitedUser } from '@/lib/invite';
import { normalizePhone } from '@/lib/phone';
import { assignableRoles, BLOOD_GROUPS, canChangeRole, canEditUser, canInviteMembers, canManageMembers, canResetPassword, canDeleteMember } from '@/lib/roles';
import { syncGroupJoin } from '@/lib/meetings';
import { redirect } from 'next/navigation';
import { forget } from '@/lib/memo';

const FORBIDDEN = { error: 'common.forbidden' };

function readMember(fd) {
    const first_name = str(fd, 'first_name', 60);
    const middle_name = str(fd, 'middle_name', 60);
    const surname = str(fd, 'surname', 60);
    const first_name_local = str(fd, 'first_name_local', 60);
    const middle_name_local = str(fd, 'middle_name_local', 60);
    const surname_local = str(fd, 'surname_local', 60);
    return {
        first_name,
        middle_name,
        surname,
        first_name_local: first_name_local || null,
        middle_name_local: middle_name_local || null,
        surname_local: surname_local || null,
        // One field everything else reads (search, lists, tree): the parts joined.
        full_name: composeName({ first: first_name, middle: middle_name, surname }).slice(0, 150),
        // The local-script name: its parts joined too (empty → null).
        full_name_local: composeName({ first: first_name_local, middle: middle_name_local, surname: surname_local }).slice(0, 150) || null,
        phoneRaw: str(fd, 'phone', 30),
        phone: normalizePhone(fd.get('phone')),
        gender: oneOf(fd, 'gender', ['male', 'female', 'other']),
        dob: date(fd, 'dob'),
        marital_status: oneOf(fd, 'marital_status', ['unmarried', 'married', 'engaged', 'widowed', 'divorced']),
        maiden_middle_name: strOrNull(fd, 'maiden_middle_name', 60),
        maiden_surname: strOrNull(fd, 'maiden_surname', 60),
        maiden_middle_name_local: strOrNull(fd, 'maiden_middle_name_local', 60),
        maiden_surname_local: strOrNull(fd, 'maiden_surname_local', 60),
        blood_group: oneOf(fd, 'blood_group', BLOOD_GROUPS),
        village: strOrNull(fd, 'village', 100),
        city: strOrNull(fd, 'city', 100),
        caste_id: id(fd, 'caste_id'),
        subcaste_id: id(fd, 'subcaste_id'),
        status: oneOf(fd, 'status', ['active', 'inactive', 'deceased'], 'active'),
        is_blood_donor: bool(fd, 'is_blood_donor') ? 1 : 0,
        role: str(fd, 'role', 20),
        password: String(fd.get('password') ?? ''),
        meta: Object.fromEntries(MEMBER_META_KEYS.map((k) => [k, str(fd, k, k === 'bio' || k === 'address' ? 2000 : 150)])),
    };
}

function validate(m, { requirePhone = true, requireMiddle = true } = {}) {
    const fieldErrors = {};
    // First name, father's name and surname are required (father's name may be unknown for an old relative).
    if (!m.first_name) fieldErrors.first_name = 'common.required';
    if (requireMiddle && !m.middle_name) fieldErrors.middle_name = 'common.required';
    if (!m.surname) fieldErrors.surname = 'common.required';
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
            `INSERT INTO users_list (phone, password_hash, full_name, full_name_local, first_name, middle_name, surname,
                                     first_name_local, middle_name_local, surname_local, gender, dob, marital_status, blood_group, village, city,
                                     caste_id, subcaste_id, role, status, is_blood_donor, language, created_by)
             VALUES (:phone, :hash, :full_name, :full_name_local, :first_name, :middle_name, :surname,
                     :first_name_local, :middle_name_local, :surname_local, :gender, :dob, :marital_status, :blood_group, :village, :city,
                     :caste_id, :subcaste_id, :role, :status, :is_blood_donor, :language, :by)`,
            { ...m, hash, role, language, by: actor.id },
        );
        await setMeta('users_list', r.insertId, m.meta, q);
        // No caste chosen: the surname's caste (Members ⋮ → Surnames).
        await applySurnameCastes([r.insertId], q);
        return r.insertId;
    });
    await audit(actor.id, 'user.create', 'user', newId, { role });
    revalidatePath('/members');
    forget('places'); // cached lists (lib/memo)
    return { ok: true, message: 'members.created', id: newId };
}

/**
 * Edit-member tabs: each tab saves only its own columns (field "section").
 *   basic     name, phone, gender, dob, village, city
 *   community caste / sub-caste, blood group, donor
 *   details   users_listmeta (position, occupation, …)
 *   access    role + status   — never on yourself
 *   password  reset           — never on yourself (own password: profile, with the current one)
 */
export async function updateMemberSection(prev, fd) {
    const actor = await getCurrentUser();
    const targetId = id(fd, 'id');
    const target =
        targetId &&
        (await queryOne(
            `SELECT id, role, phone, status, caste_id, subcaste_id, created_by, last_login_at, (password_hash IS NOT NULL) AS can_login,
                    (SELECT meta_value FROM users_listmeta WHERE user_id = users_list.id AND meta_key = 'added_via') AS added_via
               FROM users_list WHERE id = :targetId`,
            { targetId },
        ));
    const section = oneOf(fd, 'section', ['basic', 'community', 'details', 'access', 'password']);
    if (!actor || !target) return FORBIDDEN;
    // The password tab has its own, wider right; every other tab needs full edit rights.
    if (section === 'password' ? !canResetPassword(actor, target) : !canEditUser(actor, target)) return FORBIDDEN;
    const self = actor.id === target.id;
    const m = readMember(fd);
    let message = 'common.saved';

    if (section === 'basic') {
        // A family-tree relative who has no number yet: phone and father's name may stay empty.
        const relativeOnly = !target.phone;
        // Maiden parts belong to a married (widowed / divorced) woman only.
        const marriedWoman = m.gender === 'female' && ['married', 'widowed', 'divorced'].includes(m.marital_status);
        if (!marriedWoman) Object.assign(m, { maiden_middle_name: null, maiden_surname: null, maiden_middle_name_local: null, maiden_surname_local: null });
        const bad = validate({ ...m, password: '' }, { requirePhone: !relativeOnly || Boolean(m.phoneRaw), requireMiddle: !relativeOnly && !marriedWoman });
        if (bad) return bad;
        if (m.phone !== target.phone && (await phoneTaken(m.phone, target.id))) return { fieldErrors: { phone: 'auth.errors.phoneTaken' } };
        await query(
            `UPDATE users_list SET phone = :phone, full_name = :full_name, full_name_local = :full_name_local,
                    first_name = :first_name, middle_name = :middle_name, surname = :surname,
                    first_name_local = :first_name_local, middle_name_local = :middle_name_local, surname_local = :surname_local, gender = :gender,
                    dob = :dob, marital_status = :marital_status, village = :village, city = :city,
                    maiden_middle_name = :maiden_middle_name, maiden_surname = :maiden_surname,
                    maiden_middle_name_local = :maiden_middle_name_local, maiden_surname_local = :maiden_surname_local WHERE id = :id`,
            { ...m, id: target.id },
        );
        // A new surname may carry a caste (Members ⋮ → Surnames) — only when they have none.
        await applySurnameCastes([target.id]);
        // Someone without a login (a family-tree relative added with no number): giving them a number
        // turns the login on — the number is their first password, changed at first sign-in.
        if (m.phone && !target.can_login && target.status !== 'deceased') {
            await query('UPDATE users_list SET password_hash = :hash WHERE id = :id', { hash: await hashPassword(m.phone), id: target.id });
            await setMeta('users_list', target.id, { must_change_password: '1', invited_by: String(actor.id) });
            await audit(actor.id, 'user.login_enabled', 'user', target.id, {});
            message = 'members.loginEnabled';
        }
    } else if (section === 'community') {
        const casteErr = await casteProblem(m, target);
        if (casteErr) return { fieldErrors: casteErr };
        await query(
            `UPDATE users_list SET caste_id = :caste_id, subcaste_id = :subcaste_id, blood_group = :blood_group,
                    is_blood_donor = :is_blood_donor WHERE id = :id`,
            { ...m, id: target.id },
        );
    } else if (section === 'details') {
        await setMeta('users_list', target.id, m.meta);
    } else if (section === 'access') {
        // Nobody changes their own role or status — that is someone else's decision; and only member administrators
        // do (someone who added a relative edits their details, not their access).
        if (self || !canManageMembers(actor.role)) return FORBIDDEN;
        // Role only changes when the actor may make exactly that change; otherwise it is left alone.
        const roleChanged = m.role && m.role !== target.role && canChangeRole(actor, target, m.role);
        const role = roleChanged ? m.role : target.role;
        // An archived member stays archived here — only ⋮ → Restore brings them back (setMemberArchived).
        const status = target.status === 'archived' ? 'archived' : m.status;
        await query('UPDATE users_list SET role = :role, status = :status WHERE id = :id', { role, status, id: target.id });
        // A deactivation must end sessions already open on other devices.
        if (m.status !== 'active') await revokeUserSessions(target.id, false);
        if (roleChanged) await audit(actor.id, 'user.role', 'user', target.id, { from: target.role, to: role });
    } else if (section === 'password') {
        if (!m.password) return { fieldErrors: { password: 'common.required' } };
        const p = passwordProblem(m.password);
        if (p) return { fieldErrors: { password: p } };
        await query('UPDATE users_list SET password_hash = :hash WHERE id = :id', { hash: await hashPassword(m.password), id: target.id });
        await revokeUserSessions(target.id, false);
        await audit(actor.id, 'user.password_reset', 'user', target.id);
        message = 'members.passwordReset';
    } else {
        return { error: 'common.error' };
    }

    await audit(actor.id, 'user.update', 'user', target.id, { section });
    revalidatePath('/members');
    revalidatePath(`/members/${target.id}`);
    forget('places', 'castes'); // cached lists (lib/memo)
    return { ok: true, message, id: target.id };
}

// Relations (family tree) live in actions/family.js.

// ── groups, from the directory ────────────────────────────────────────────────

/**
 * Put people into groups as members or admins — the one routine behind the row menu and the
 * bulk bar on the Members page.
 *   member → added if not in the group; an existing ADMIN is never downgraded
 *   admin  → added as admin, or promoted if already a member
 * Each group is checked separately (group managers, or admins of that group); groups the
 * actor cannot manage are skipped and reported. Only real changes are notified and audited.
 */
async function applyGroupMembership(actor, userIds, groupIds, memberRole) {
    const out = { added: 0, promoted: 0, unchanged: 0, skipped: [] };
    const ul = inList(userIds, 'u');
    const users = userIds.length ? (await query(`SELECT id FROM users_list WHERE id IN (${ul.sql})`, ul.params)).map((r) => r.id) : [];
    for (const groupId of groupIds) {
        const group = await queryOne('SELECT id, name, name_local FROM admin_groups WHERE id = :groupId', { groupId });
        const { standing, team } = group ? await groupStanding(actor, groupId) : { standing: null, team: [] };
        // Adding members: admins, sub-admins and the "members" team role; making admins: that group's admins only.
        if (!group || !canActOnRole(standing, null, memberRole, team)) {
            out.skipped.push(groupId);
            continue;
        }
        const existing = new Map(
            (await query('SELECT user_id, member_role FROM admin_group_members WHERE group_id = :groupId', { groupId })).map((r) => [r.user_id, r.member_role]),
        );
        const added = [];
        const promoted = [];
        await withTransaction(async (q) => {
            for (const uid of users) {
                const had = existing.get(uid);
                if (!had) {
                    await q(`INSERT INTO admin_group_members (group_id, user_id, member_role, added_by) VALUES (:groupId, :uid, :memberRole, :by)`, {
                        groupId,
                        uid,
                        memberRole,
                        by: actor.id,
                    });
                    added.push(uid);
                } else if (memberRole === 'admin' && had !== 'admin') {
                    await q(`UPDATE admin_group_members SET member_role = 'admin' WHERE group_id = :groupId AND user_id = :uid`, { groupId, uid });
                    promoted.push(uid);
                } else {
                    out.unchanged++;
                }
            }
        });
        out.added += added.length;
        out.promoted += promoted.length;
        if (added.length) await syncGroupJoin(groupId); // upcoming "Everyone" meetings + "everyone" Mandals
        const data = { group: group.name, group_local: group.name_local };
        const link = `/groups/${groupId}`;
        const becameAdmin = memberRole === 'admin' ? [...added, ...promoted] : [];
        const becameMember = memberRole === 'admin' ? [] : added;
        if (becameAdmin.length) await notifyMany(becameAdmin, { type: 'group.admin', data, link, actorId: actor.id });
        if (becameMember.length) await notifyMany(becameMember, { type: 'group.member', data, link, actorId: actor.id });
        await postMemberNote(groupId, actor.id, 'added', added);
        if (added.length || promoted.length) {
            await audit(actor.id, memberRole === 'admin' ? 'group.admin' : 'group.member.add', 'group', groupId, { added, promoted });
        }
        revalidatePath(link);
    }
    revalidatePath('/members');
    return out;
}

/** Row menu on the Members list: one person, one group — as a member (group admins are made inside the group). */
export async function assignToGroup(prev, fd) {
    const actor = await getCurrentUser();
    const userId = id(fd, 'user_id');
    const groupId = id(fd, 'group_id');
    const memberRole = 'member';
    if (!groupId) return { fieldErrors: { group_id: 'common.required' } };
    const gs = actor ? await groupStanding(actor, groupId) : null;
    if (!actor || !userId || !canActOnRole(gs.standing, null, memberRole, gs.team)) return FORBIDDEN;
    const [user, group] = await Promise.all([
        queryOne('SELECT full_name FROM users_list WHERE id = :userId', { userId }),
        queryOne('SELECT name FROM admin_groups WHERE id = :groupId', { groupId }),
    ]);
    if (!user || !group) return { error: 'common.error' };
    await applyGroupMembership(actor, [userId], [groupId], memberRole);
    revalidatePath(`/members/${userId}`);
    return { ok: true, message: 'common.saved' };
}

/**
 * Bulk bar on the Members list: many people × one or more groups.
 * Fields: user_ids[] (at most 500), group_ids[]. Always as members — group admins are made inside the group.
 */
export async function bulkAssignToGroup(prev, fd) {
    const actor = await getCurrentUser();
    if (!actor) return FORBIDDEN;
    const userIds = [...new Set(fd.getAll('user_ids').map(Number))].filter((n) => n > 0).slice(0, 500);
    const groupIds = [...new Set(fd.getAll('group_ids').map(Number))].filter((n) => n > 0).slice(0, 50);
    const memberRole = 'member';
    if (!userIds.length) return { error: 'members.bulk.noneSelected' };
    if (!groupIds.length) return { fieldErrors: { group_ids: 'members.bulk.chooseGroups' } };
    const r = await applyGroupMembership(actor, userIds, groupIds, memberRole);
    if (r.skipped.length === groupIds.length) return FORBIDDEN;
    return {
        ok: true,
        message: r.skipped.length ? 'members.bulk.doneSkipped' : 'members.bulk.done',
        vars: { added: r.added, promoted: r.promoted, unchanged: r.unchanged, skipped: r.skipped.length },
    };
}

/**
 * Invite several people by phone number from the Members page (sub-admin and up).
 * Fields: phone[] + optional full_name[] (same order, at most 50 rows; blank rows ignored), group_ids[].
 * New numbers get a member account whose first password is the number itself; on first
 * sign-in they must set their own and then fill in their details (lib/invite.js). Numbers
 * already registered are left as they are. Everyone invited is then added to the chosen
 * groups the inviter may manage.
 */
export async function inviteMembers(prev, fd) {
    const actor = await getCurrentUser();
    if (!actor || !canInviteMembers(actor.role)) return FORBIDDEN;
    const phones = fd.getAll('phone').map((v) => String(v).trim());
    const names = fd.getAll('full_name').map((v) => String(v).trim().slice(0, 150));
    const rows = phones
        .map((raw, i) => ({ raw, name: names[i] ?? '', row: i + 1 }))
        .filter((r) => r.raw || r.name)
        .slice(0, 50);
    if (!rows.length) return { error: 'members.invite.none' };

    // Validate every row first, so one bad line does not leave half the list invited.
    const bad = [];
    const seen = new Set();
    for (const r of rows) {
        r.phone = normalizePhone(r.raw);
        if (!r.phone || seen.has(r.phone)) bad.push(r.row);
        else seen.add(r.phone);
    }
    if (bad.length) return { error: 'members.invite.badRows', vars: { rows: bad.join(', ') } };

    const out = { created: 0, existing: 0, failed: [] };
    const ids = [];
    for (const r of rows) {
        const res = await ensureInvitedUser(actor, r.phone, r.name);
        if (res.error) {
            out.failed.push(r.row);
            continue;
        }
        ids.push(res.id);
        if (res.status === 'existing') out.existing++;
        else out.created++;
    }
    const groupIds = [...new Set(fd.getAll('group_ids').map(Number))].filter((n) => n > 0).slice(0, 50);
    if (ids.length && groupIds.length) await applyGroupMembership(actor, ids, groupIds, 'member');
    revalidatePath('/members');
    return {
        ok: true,
        message: out.failed.length ? 'members.invite.doneFailed' : 'members.invite.done',
        vars: { created: out.created, existing: out.existing, rows: out.failed.join(', ') },
    };
}

/**
 * Bulk "reset password to phone" on the Members list: each selected member's password becomes
 * their own phone number, they must choose a new one at next login (must_change_password) and
 * their open sessions end. Same rule as a single reset: sub-admin and up, never yourself, never
 * someone ranked above you — those rows are skipped and counted.
 */
export async function bulkResetPasswords(prev, fd) {
    const actor = await getCurrentUser();
    if (!actor) return FORBIDDEN;
    const userIds = [...new Set(fd.getAll('user_ids').map(Number))].filter((n) => n > 0).slice(0, 500);
    if (!userIds.length) return { error: 'members.bulk.noneSelected' };
    const list = inList(userIds, 'u');
    const targets = await query(`SELECT id, role, phone FROM users_list WHERE id IN (${list.sql})`, list.params);
    let reset = 0;
    let skipped = userIds.length - targets.length;
    for (const target of targets) {
        if (!canResetPassword(actor, target) || !target.phone) {
            skipped++;
            continue;
        }
        await query('UPDATE users_list SET password_hash = :hash WHERE id = :id', { hash: await hashPassword(target.phone), id: target.id });
        await setMeta('users_list', target.id, { must_change_password: '1' });
        await revokeUserSessions(target.id, false);
        await audit(actor.id, 'user.password_reset', 'user', target.id, { to: 'phone', bulk: true });
        reset++;
    }
    if (!reset) return { error: 'members.bulk.resetNone' };
    revalidatePath('/members');
    return { ok: true, message: skipped ? 'members.bulk.resetDoneSkipped' : 'members.bulk.resetDone', vars: { reset, skipped } };
}

/**
 * Delete a member for good (canDeleteMember: super admins / administrators, never themselves).
 * Their memberships, family links, roles, sessions and notifications go with them; money they gave
 * stays in the ledgers under their name and their chat messages stay without an author.
 * `fromProfile`: called from their own page, which would no longer exist — go to Members.
 * Two steps, never one: only an ARCHIVED member can be deleted (setMemberArchived first).
 */
export async function deleteMember(userId, fromProfile = false) {
    const actor = await getCurrentUser();
    const target = await queryOne('SELECT id, role, status, full_name, phone FROM users_list WHERE id = :userId', { userId: Number(userId) });
    if (!actor || !target || !canDeleteMember(actor, target)) return { error: 'common.forbidden' };
    if (target.status !== 'archived') return { error: 'members.archiveFirst' };
    await query('DELETE FROM users_list WHERE id = :id', { id: target.id });
    forget('places', 'castes'); // cached lists (lib/memo)
    await audit(actor.id, 'user.delete', 'user', target.id, { name: target.full_name, phone: target.phone, role: target.role });
    revalidatePath('/members');
    if (fromProfile) redirect('/members');
    return { ok: true, message: 'members.deleted' };
}

/**
 * Archive ⇄ restore a member (same people as delete: canDeleteMember). Archived = hidden from
 * everyone but administrators (lists, pickers, birthdays, blood), cannot sign in (sessions end),
 * and the only state from which Delete is offered. The status before archiving is kept in
 * meta `status_before_archive`, so Restore brings back "Late" or "Inactive" as it was.
 */
export async function setMemberArchived(userId, archive) {
    const actor = await getCurrentUser();
    const target = await queryOne('SELECT id, role, status, full_name FROM users_list WHERE id = :userId', { userId: Number(userId) });
    if (!actor || !target || !canDeleteMember(actor, target)) return { error: 'common.forbidden' };
    if (archive && target.status !== 'archived') {
        await setMeta('users_list', target.id, { status_before_archive: target.status });
        await query("UPDATE users_list SET status = 'archived' WHERE id = :id", { id: target.id });
        await revokeUserSessions(target.id, false);
        await audit(actor.id, 'user.archive', 'user', target.id, { name: target.full_name, from: target.status });
    } else if (!archive && target.status === 'archived') {
        const before = (await getMeta('users_list', target.id)).status_before_archive;
        const status = MEMBER_STATUSES.includes(before) ? before : 'active';
        await query('UPDATE users_list SET status = :status WHERE id = :id', { status, id: target.id });
        await setMeta('users_list', target.id, { status_before_archive: '' });
        await audit(actor.id, 'user.restore', 'user', target.id, { name: target.full_name, to: status });
    }
    revalidatePath('/members');
    revalidatePath(`/members/${target.id}`);
    return { ok: true, message: archive ? 'members.archived' : 'members.restored' };
}

// Fields Bulk edit may change, and their columns.
const BULK_FIELDS = ['village', 'city', 'caste', 'blood_group', 'donor', 'role', 'status'];
const MEMBER_STATUSES = ['active', 'inactive', 'deceased'];

/**
 * Members ⋮ bulk bar → Bulk edit: the same changes for every ticked person (app admins / sub-admins).
 * Fields: user_ids[], change[] (which fields, BULK_FIELDS) and each one's value — village, city,
 * caste_id + subcaste_id, blood_group, is_blood_donor ('1' / '0'), role, status. Each person is checked
 * like the Edit page: nobody above the actor's rank is touched, a role is set only where the actor may
 * give it, and nobody changes their own role or status. Empty village / city / caste clears it.
 */
export async function bulkEditMembers(prev, fd) {
    const actor = await getCurrentUser();
    if (!actor || !canManageMembers(actor.role)) return FORBIDDEN;
    const userIds = [...new Set(fd.getAll('user_ids').map(Number))].filter((n) => n > 0).slice(0, 500);
    if (!userIds.length) return { error: 'members.bulk.noneSelected' };
    const change = [...new Set(fd.getAll('change').map(String))].filter((f) => BULK_FIELDS.includes(f));
    if (!change.length) return { error: 'members.bulkEdit.nothing' };

    const set = {};
    if (change.includes('village')) set.village = strOrNull(fd, 'village', 100);
    if (change.includes('city')) set.city = strOrNull(fd, 'city', 100);
    if (change.includes('caste')) {
        const m = { caste_id: id(fd, 'caste_id'), subcaste_id: id(fd, 'subcaste_id') };
        const bad = await casteProblem(m);
        if (bad) return { fieldErrors: bad };
        set.caste_id = m.caste_id;
        set.subcaste_id = m.subcaste_id;
    }
    if (change.includes('blood_group')) {
        const g = str(fd, 'blood_group', 5);
        if (g && !BLOOD_GROUPS.includes(g)) return { fieldErrors: { blood_group: 'common.required' } };
        set.blood_group = g || null;
    }
    if (change.includes('donor')) set.is_blood_donor = fd.get('is_blood_donor') === '1' ? 1 : 0;
    const newRole = change.includes('role') ? oneOf(fd, 'role', assignableRoles(actor.role), null) : null;
    if (change.includes('role') && !newRole) return { fieldErrors: { role: 'common.required' } };
    const newStatus = change.includes('status') ? oneOf(fd, 'status', MEMBER_STATUSES, null) : null;
    if (change.includes('status') && !newStatus) return { fieldErrors: { status: 'common.required' } };

    const list = inList(userIds, 'u');
    const targets = await query(`SELECT id, role, status FROM users_list WHERE id IN (${list.sql})`, list.params);
    let updated = 0;
    let skipped = userIds.length - targets.length;
    for (const target of targets) {
        if (!canEditUser(actor, target)) {
            skipped++;
            continue;
        }
        const row = { ...set };
        const self = target.id === actor.id;
        // Role and status: never your own, and a role only where you may give it.
        if (newRole && !self && newRole !== target.role && canChangeRole(actor, target, newRole)) row.role = newRole;
        // Archived members keep their status (only ⋮ → Restore brings them back).
        if (newStatus && !self && target.status !== 'archived') row.status = newStatus;
        const cols = Object.keys(row);
        if (!cols.length) {
            skipped++;
            continue;
        }
        await query(`UPDATE users_list SET ${cols.map((c) => `${c} = :${c}`).join(', ')} WHERE id = :id`, { ...row, id: target.id });
        if (row.status && row.status !== 'active') await revokeUserSessions(target.id, false);
        await audit(actor.id, 'user.bulk_edit', 'user', target.id, { ...row, ...(row.role ? { from_role: target.role } : {}) });
        updated++;
    }
    if (!updated) return { error: 'members.bulkEdit.none' };
    forget('places', 'castes'); // cached lists (lib/memo)
    revalidatePath('/members');
    return { ok: true, message: skipped ? 'members.bulkEdit.doneSkipped' : 'members.bulkEdit.done', vars: { updated, skipped } };
}
