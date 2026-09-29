'use server';
import { revalidatePath } from 'next/cache';
import { canManageGroup } from '@/lib/access';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { query, queryOne, setMeta, withTransaction } from '@/lib/db';
import { id, oneOf, str, strOrNull } from '@/lib/forms';
import { notify } from '@/lib/notifications';
import { canManageGroups } from '@/lib/roles';

async function notifyGroupRole(userId, groupId, memberRole, actorId) {
    const g = await queryOne('SELECT name, name_local FROM admin_groups WHERE id = :groupId', { groupId });
    if (!g) return;
    await notify(userId, {
        type: memberRole === 'admin' ? 'group.admin' : 'group.member',
        data: { group: g.name, group_local: g.name_local },
        link: `/groups/${groupId}`,
        actorId,
    });
}

const FORBIDDEN = { error: 'common.forbidden' };

export async function saveGroup(prev, fd) {
    const actor = await getCurrentUser();
    const groupId = id(fd, 'id');
    // Creating needs the app-level role; editing is open to that group's own admins too.
    const allowed = groupId ? await canManageGroup(actor, groupId) : actor && canManageGroups(actor.role);
    if (!allowed) return FORBIDDEN;

    const name = str(fd, 'name', 150);
    if (!name) return { fieldErrors: { name: 'common.required' } };
    const nameLocal = strOrNull(fd, 'name_local', 150);
    const description = str(fd, 'description', 4000);

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
        }
        await setMeta('admin_groups', gid, { description }, q);
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
    const memberRole = oneOf(fd, 'member_role', ['member', 'admin'], 'member');
    if (!groupId || !(await canManageGroup(actor, groupId))) return FORBIDDEN;
    if (!userId) return { fieldErrors: { user_id: 'common.required' } };
    if (!(await queryOne('SELECT id FROM users_list WHERE id = :userId', { userId }))) {
        return { fieldErrors: { user_id: 'common.required' } };
    }
    await query(
        `INSERT INTO admin_group_members (group_id, user_id, member_role, added_by)
         VALUES (:groupId, :userId, :memberRole, :by)
         ON DUPLICATE KEY UPDATE member_role = VALUES(member_role)`,
        { groupId, userId, memberRole, by: actor.id },
    );
    await audit(actor.id, memberRole === 'admin' ? 'group.admin' : 'group.member.add', 'group', groupId, { userId });
    await notifyGroupRole(userId, groupId, memberRole, actor.id);
    revalidatePath(`/groups/${groupId}`);
    return { ok: true, message: 'common.saved' };
}

export async function setGroupMemberRole(groupId, userId, memberRole) {
    const actor = await getCurrentUser();
    const gid = Number(groupId);
    const uid = Number(userId);
    if (!['member', 'admin'].includes(memberRole) || !(await canManageGroup(actor, gid))) return FORBIDDEN;
    // A group admin demoting themselves could leave the group with nobody able to run it;
    // only an app-level group manager may do that.
    if (uid === actor.id && memberRole === 'member' && !canManageGroups(actor.role)) return FORBIDDEN;
    await query(
        'UPDATE admin_group_members SET member_role = :memberRole WHERE group_id = :gid AND user_id = :uid',
        { memberRole, gid, uid },
    );
    await audit(actor.id, memberRole === 'admin' ? 'group.admin' : 'group.admin.remove', 'group', gid, { userId: uid });
    // Promotion is news; a demotion is not pushed as a notification.
    if (memberRole === 'admin') await notifyGroupRole(uid, gid, 'admin', actor.id);
    revalidatePath(`/groups/${gid}`);
    return { ok: true, message: 'common.saved' };
}

export async function removeGroupMember(groupId, userId) {
    const actor = await getCurrentUser();
    const gid = Number(groupId);
    const uid = Number(userId);
    if (!(await canManageGroup(actor, gid))) return FORBIDDEN;
    if (uid === actor.id && !canManageGroups(actor.role)) return FORBIDDEN;
    await query('DELETE FROM admin_group_members WHERE group_id = :gid AND user_id = :uid', { gid, uid });
    await audit(actor.id, 'group.member.remove', 'group', gid, { userId: uid });
    revalidatePath(`/groups/${gid}`);
    return { ok: true, message: 'common.deleted' };
}
