'use server';
import { revalidatePath } from 'next/cache';
import { canAdministerGroup, groupStanding } from '@/lib/access';
import { canActOnRole, CHAT_MODES, GROUP_ROLES, GROUP_VISIBILITY } from '@/lib/group-roles';
import { audit } from '@/lib/audit';
import { sanitizeAvatar } from '@/lib/group-avatar';
import { getCurrentUser } from '@/lib/auth';
import { ensureInvitedUser } from '@/lib/invite';
import { postMemberNote } from '@/lib/chat';
import { query, queryOne, setMeta, withTransaction } from '@/lib/db';
import { id, oneOf, str, strOrNull } from '@/lib/forms';
import { normalizePhone } from '@/lib/phone';
import { notify } from '@/lib/notifications';
import { canManageGroups } from '@/lib/roles';

async function notifyGroupRole(userId, groupId, memberRole, actorId) {
    const g = await queryOne('SELECT name, name_local FROM admin_groups WHERE id = :groupId', { groupId });
    if (!g) return;
    await notify(userId, {
        type: memberRole === 'admin' ? 'group.admin' : memberRole === 'sub_admin' ? 'group.sub_admin' : 'group.member',
        data: { group: g.name, group_local: g.name_local },
        link: `/groups/${groupId}`,
        actorId,
    });
}

const FORBIDDEN = { error: 'common.forbidden' };

export async function saveGroup(prev, fd) {
    const actor = await getCurrentUser();
    const groupId = id(fd, 'id');
    // Creating needs the app-level role; editing is open to that group's own admins too (not sub-admins).
    const allowed = groupId ? await canAdministerGroup(actor, groupId) : actor && canManageGroups(actor.role);
    if (!allowed) return FORBIDDEN;

    const name = str(fd, 'name', 150);
    if (!name) return { fieldErrors: { name: 'common.required' } };
    const nameLocal = strOrNull(fd, 'name_local', 150);
    const description = str(fd, 'description', 4000);
    // Icon / emoji / ≤2-letter text on a colour; unknown values are dropped (see lib/group-avatar).
    // Who may post in the discussion: everyone, or only admins, sub-admins and speakers.
    const chatMode = oneOf(fd, 'chat_mode', CHAT_MODES, 'all');
    const visibility = oneOf(fd, 'visibility', GROUP_VISIBILITY, 'public');
    const avatar = sanitizeAvatar(str(fd, 'avatar_kind', 10), str(fd, 'avatar_value', 40), str(fd, 'avatar_color', 10));

    const savedId = await withTransaction(async (q) => {
        let gid = groupId;
        if (gid) {
            await q('UPDATE admin_groups SET name = :name, name_local = :nameLocal WHERE id = :gid', { name, nameLocal, gid });
        } else {
            const r = await q('INSERT INTO admin_groups (name, name_local, created_by) VALUES (:name, :nameLocal, :by)', {
                name,
                nameLocal,
                by: actor.id,
            });
            gid = r.insertId;
            // The creator runs the group by default. Other admins may demote them later like anyone else.
            await q(
                `INSERT INTO admin_group_members (group_id, user_id, member_role, added_by) VALUES (:gid, :uid, 'admin', :uid)`,
                { gid, uid: actor.id },
            );
        }
        // 'all' is the default, stored as absence.
        await setMeta('admin_groups', gid, { description, ...avatar, chat_mode: chatMode === 'all' ? '' : chatMode, visibility: visibility === 'public' ? '' : visibility }, q);
        return gid;
    });
    await audit(actor.id, groupId ? 'group.update' : 'group.create', 'group', savedId, { name });
    revalidatePath('/groups');
    revalidatePath(`/groups/${savedId}`);
    return { ok: true, message: groupId ? 'common.saved' : 'groups.created', id: savedId };
}

export async function addGroupMember(prev, fd) {
    const actor = await getCurrentUser();
    const groupId = id(fd, 'group_id');
    const userId = id(fd, 'user_id');
    const memberRole = oneOf(fd, 'member_role', GROUP_ROLES, 'member');
    if (!groupId || !actor) return FORBIDDEN;
    const { standing } = await groupStanding(actor, groupId);
    if (!userId) return { fieldErrors: { user_id: 'common.required' } };
    if (!(await queryOne('SELECT id FROM users_list WHERE id = :userId', { userId }))) {
        return { fieldErrors: { user_id: 'common.required' } };
    }
    const already = await queryOne('SELECT member_role FROM admin_group_members WHERE group_id = :groupId AND user_id = :userId', { groupId, userId });
    // A sub-admin adds members and speakers only, and never changes an admin's or sub-admin's role.
    if (!canActOnRole(standing, already?.member_role ?? null, memberRole)) return FORBIDDEN;
    await query(
        `INSERT INTO admin_group_members (group_id, user_id, member_role, added_by)
         VALUES (:groupId, :userId, :memberRole, :by)
         ON DUPLICATE KEY UPDATE member_role = VALUES(member_role)`,
        { groupId, userId, memberRole, by: actor.id },
    );
    await audit(actor.id, memberRole === 'admin' ? 'group.admin' : 'group.member.add', 'group', groupId, { userId });
    await notifyGroupRole(userId, groupId, memberRole, actor.id);
    if (!already) await postMemberNote(groupId, actor.id, 'added', [userId]);
    revalidatePath(`/groups/${groupId}`);
    return { ok: true, message: 'common.saved' };
}

/**
 * Add someone to a group by mobile number, registered or not.
 *   registered            → added like any member
 *   listed, no password   → added, and may now log in with the number as password
 *   unknown number        → a member account is created (name + number), added to the group
 * In the last two cases the first password is the phone number itself and they must choose
 * their own on first sign-in (users_listmeta.must_change_password). Until they sign in,
 * the Members tab shows them as "Not joined yet"; an admin can remove them like anyone.
 */
export async function inviteGroupMember(prev, fd) {
    const actor = await getCurrentUser();
    const groupId = id(fd, 'group_id');
    if (!groupId || !actor) return FORBIDDEN;
    const memberRole = oneOf(fd, 'member_role', GROUP_ROLES, 'member');
    const { standing } = await groupStanding(actor, groupId);
    if (!canActOnRole(standing, null, memberRole)) return FORBIDDEN;
    const phone = normalizePhone(fd.get('phone'));
    const fullName = str(fd, 'full_name', 150);
    if (!phone) return { fieldErrors: { phone: 'auth.errors.phoneInvalid' } };

    const user = await ensureInvitedUser(actor, phone, fullName);
    if (user.error) return { fieldErrors: { phone: user.error } };
    const created = user.status === 'created';

    const already = await queryOne('SELECT member_role FROM admin_group_members WHERE group_id = :groupId AND user_id = :uid', { groupId, uid: user.id });
    if (already && already.member_role === memberRole) return { error: 'groups.invite.alreadyIn' };
    if (already && !canActOnRole(standing, already.member_role, memberRole)) return FORBIDDEN;
    await query(
        `INSERT INTO admin_group_members (group_id, user_id, member_role, added_by)
         VALUES (:groupId, :uid, :memberRole, :by)
         ON DUPLICATE KEY UPDATE member_role = VALUES(member_role)`,
        { groupId, uid: user.id, memberRole, by: actor.id },
    );
    await audit(actor.id, 'group.member.add', 'group', groupId, { userId: user.id, invited: created });
    if (!created) await notifyGroupRole(user.id, groupId, memberRole, actor.id);
    if (!already) await postMemberNote(groupId, actor.id, 'added', [user.id]);
    revalidatePath(`/groups/${groupId}`);
    revalidatePath('/members');
    return { ok: true, message: created ? 'groups.invite.created' : 'common.saved', vars: { phone } };
}

export async function setGroupMemberRole(groupId, userId, memberRole) {
    const actor = await getCurrentUser();
    const gid = Number(groupId);
    const uid = Number(userId);
    if (!actor || !GROUP_ROLES.includes(memberRole)) return FORBIDDEN;
    const { standing } = await groupStanding(actor, gid);
    const row = await queryOne('SELECT member_role FROM admin_group_members WHERE group_id = :gid AND user_id = :uid', { gid, uid });
    if (!row) return { error: 'common.error' };
    if (!canActOnRole(standing, row.member_role, memberRole)) return FORBIDDEN;
    // A group admin demoting themselves could leave the group with nobody able to run it;
    // only an app-level group manager may do that.
    if (uid === actor.id && memberRole !== row.member_role && standing !== 'app') return { error: 'groups.errors.selfDemote' };
    await query(
        'UPDATE admin_group_members SET member_role = :memberRole WHERE group_id = :gid AND user_id = :uid',
        { memberRole, gid, uid },
    );
    await audit(actor.id, 'group.role', 'group', gid, { userId: uid, from: row.member_role, to: memberRole });
    // Promotion is news; a demotion is not pushed as a notification.
    if (GROUP_ROLES.indexOf(memberRole) < GROUP_ROLES.indexOf(row.member_role)) await notifyGroupRole(uid, gid, memberRole, actor.id);
    revalidatePath(`/groups/${gid}`);
    return { ok: true, message: 'common.saved' };
}

export async function removeGroupMember(groupId, userId) {
    const actor = await getCurrentUser();
    const gid = Number(groupId);
    const uid = Number(userId);
    if (!actor) return FORBIDDEN;
    const { standing } = await groupStanding(actor, gid);
    const row = await queryOne('SELECT member_role FROM admin_group_members WHERE group_id = :gid AND user_id = :uid', { gid, uid });
    if (!row) return { ok: true, message: 'common.deleted' };
    // Admins remove anyone; a sub-admin only members and speakers — never an admin.
    if (!canActOnRole(standing, row.member_role)) return FORBIDDEN;
    if (uid === actor.id && standing !== 'app') return { error: 'groups.errors.selfDemote' };
    const r = await query('DELETE FROM admin_group_members WHERE group_id = :gid AND user_id = :uid', { gid, uid });
    await audit(actor.id, 'group.member.remove', 'group', gid, { userId: uid });
    if (r.affectedRows) await postMemberNote(gid, actor.id, 'removed', [uid]);
    revalidatePath(`/groups/${gid}`);
    return { ok: true, message: 'common.deleted' };
}
