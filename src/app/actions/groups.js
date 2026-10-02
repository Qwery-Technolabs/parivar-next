'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { canEditGroupDetails, groupStanding } from '@/lib/access';
import { canActOnRole, canAdminister, GROUP_ROLES, GROUP_STATUSES, GROUP_VISIBILITY } from '@/lib/group-roles';
import { audit } from '@/lib/audit';
import { sanitizeAvatar } from '@/lib/group-avatar';
import { getCurrentUser } from '@/lib/auth';
import { deleteUnusedInvitee, ensureInvitedUser } from '@/lib/invite';
import { postMemberNote } from '@/lib/chat';
import { query, queryOne, setMeta, withTransaction } from '@/lib/db';
import { id, oneOf, str, strOrNull } from '@/lib/forms';
import { normalizePhone } from '@/lib/phone';
import { notify } from '@/lib/notifications';
import { canManageGroups } from '@/lib/roles';
import { syncGroupJoin } from '@/lib/meetings';

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
    // Creating needs the app-level role; editing is open to that group's own admins and sub-admins too.
    const allowed = groupId ? await canEditGroupDetails(actor, groupId) : actor && canManageGroups(actor.role);
    if (!allowed) return FORBIDDEN;

    const name = str(fd, 'name', 150);
    if (!name) return { fieldErrors: { name: 'common.required' } };
    const nameLocal = strOrNull(fd, 'name_local', 150);
    const description = str(fd, 'description', 4000);
    // Icon / emoji / ≤2-letter text on a colour; unknown values are dropped (see lib/group-avatar).
    // Who may post in the discussion: everyone, or only admins, sub-admins and speakers.
    // Group roles that may post; admin always may. Every role ticked = the default (stored as absence).
    const chatRoles = GROUP_ROLES.filter((r) => r === 'admin' || fd.getAll('chat_roles').includes(r));
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
        // Defaults (every role posts, public) are stored as absence.
        await setMeta(
            'admin_groups',
            gid,
            {
                description,
                ...avatar,
                chat_roles: chatRoles.length === GROUP_ROLES.length ? '' : chatRoles.join(','),
                chat_mode: '', // the older setting, replaced by chat_roles
                visibility: visibility === 'public' ? '' : visibility,
            },
            q,
        );
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
    await syncGroupJoin(groupId); // upcoming "Everyone" meetings + "everyone" Mandals take them now
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
    await syncGroupJoin(groupId); // upcoming "Everyone" meetings + "everyone" Mandals take them now
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

/**
 * Remove someone from a group. With deleteAccount, an invited person who never signed in and
 * is in no other group also loses the account (lib/invite.js deleteUnusedInvitee decides).
 */
export async function removeGroupMember(groupId, userId, deleteAccount = false) {
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
    const deleted = deleteAccount === true && (await deleteUnusedInvitee(actor, uid));
    revalidatePath(`/groups/${gid}`);
    if (deleted) revalidatePath('/members');
    return { ok: true, message: deleted ? 'groups.invite.removedDeleted' : 'common.deleted' };
}

/** Danger zone: set a group's status (active / inactive / archived). The group's admins and app-level group managers. */
export async function setGroupStatus(groupId, status) {
    const actor = await getCurrentUser();
    if (!actor || !GROUP_STATUSES.includes(status)) return FORBIDDEN;
    const { standing } = await groupStanding(actor, groupId);
    if (!canAdminister(standing)) return FORBIDDEN;
    const g = await queryOne('SELECT id, name, status FROM admin_groups WHERE id = :groupId', { groupId });
    if (!g) return FORBIDDEN;
    await query('UPDATE admin_groups SET status = :status WHERE id = :groupId', { status, groupId });
    await audit(actor.id, 'group.update', 'group', groupId, { name: g.name, status: { from: g.status, to: status } });
    revalidatePath('/groups');
    revalidatePath(`/groups/${groupId}`);
    return { ok: true, message: `groups.danger.done.${status}` };
}

/**
 * Delete an ARCHIVED group for good: its meetings, discussion, member list and links go with it.
 * App-level group managers only. Refused while it is the home group of a fundraise.
 */
export async function deleteGroup(groupId) {
    const actor = await getCurrentUser();
    if (!actor || !canManageGroups(actor.role)) return FORBIDDEN;
    const g = await queryOne('SELECT id, name, status FROM admin_groups WHERE id = :groupId', { groupId });
    if (!g || g.status !== 'archived') return FORBIDDEN;
    const home = await queryOne('SELECT COUNT(*) AS n FROM fundraise_campaigns WHERE group_id = :groupId', { groupId });
    if (Number(home.n) > 0) return { error: 'groups.danger.hasFundraises' };
    await withTransaction(async (q) => {
        await q(`DELETE FROM events_list WHERE group_id = :groupId AND event_type = 'meeting'`, { groupId });
        await q(`DELETE FROM chat_messages WHERE scope = 'group' AND scope_id = :groupId`, { groupId });
        await q(`DELETE FROM chat_reads WHERE scope = 'group' AND scope_id = :groupId`, { groupId });
        await q('DELETE FROM admin_groups WHERE id = :groupId', { groupId }); // members, meta, fundraise links cascade
    });
    await audit(actor.id, 'group.delete', 'group', groupId, { name: g.name });
    revalidatePath('/groups');
    redirect('/groups');
}
