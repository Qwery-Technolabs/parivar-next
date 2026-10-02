'use server';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { id, str, strOrNull } from '@/lib/forms';
import { canManageSettings } from '@/lib/roles';
import { forget } from '@/lib/memo';

const FORBIDDEN = { error: 'common.forbidden' };

async function actor() {
    const user = await getCurrentUser();
    return user && canManageSettings(user.role) ? user : null;
}

/** Create or rename a caste / sub-caste. */
export async function saveCaste(prev, fd) {
    const user = await actor();
    if (!user) return FORBIDDEN;
    const casteId = id(fd, 'id');
    const parentId = id(fd, 'parent_id');
    const name = str(fd, 'name', 100);
    const nameLocal = strOrNull(fd, 'name_local', 100);
    const sortOrder = Math.min(9999, Math.max(0, Number.parseInt(String(fd.get('sort_order') ?? '0'), 10) || 0));
    if (!name) return { fieldErrors: { name: 'common.required' } };

    if (parentId) {
        // One level only: the parent must itself be a top-level caste.
        const parent = await queryOne('SELECT id, parent_id FROM admin_castes WHERE id = :parentId', { parentId });
        if (!parent || parent.parent_id != null) return { fieldErrors: { name: 'castes.errors.parent' } };
    }
    const dup = await queryOne(
        `SELECT id FROM admin_castes WHERE name = :name AND parent_id <=> :parentId AND id <> :casteId`,
        { name, parentId, casteId: casteId ?? 0 },
    );
    if (dup) return { fieldErrors: { name: 'castes.errors.duplicate' } };

    let savedId = casteId;
    if (casteId) {
        // parent_id is fixed after creation: moving a sub-caste would silently change the
        // caste of every member who picked it.
        await query('UPDATE admin_castes SET name = :name, name_local = :nameLocal, sort_order = :sortOrder WHERE id = :casteId', {
            name,
            nameLocal,
            sortOrder,
            casteId,
        });
    } else {
        const r = await query(
            `INSERT INTO admin_castes (parent_id, name, name_local, sort_order, created_by)
             VALUES (:parentId, :name, :nameLocal, :sortOrder, :by)`,
            { parentId, name, nameLocal, sortOrder, by: user.id },
        );
        savedId = r.insertId;
    }
    await audit(user.id, casteId ? 'caste.update' : 'caste.create', 'caste', savedId, { name, parentId });
    revalidatePath('/members/castes');
    forget('castes'); // cached lists (lib/memo)
    return { ok: true, message: 'common.saved' };
}

/** Hide from pickers (members keep it) or show again. */
export async function setCasteStatus(casteId, status) {
    const user = await actor();
    if (!user || !['active', 'inactive'].includes(status)) return FORBIDDEN;
    const cid = Number(casteId);
    await query('UPDATE admin_castes SET status = :status WHERE id = :cid OR parent_id = :cid2', {
        status,
        cid,
        // Deactivating a caste also hides its sub-castes; reactivating restores only the caste.
        cid2: status === 'inactive' ? cid : -1,
    });
    await audit(user.id, 'caste.status', 'caste', cid, { status });
    revalidatePath('/members/castes');
    forget('castes'); // cached lists (lib/memo)
    return { ok: true, message: 'common.saved' };
}

/** Delete only when unused — a caste on member records is deactivated instead. */
export async function deleteCaste(casteId) {
    const user = await actor();
    if (!user) return FORBIDDEN;
    const cid = Number(casteId);
    const used = await queryOne(
        `SELECT
            (SELECT COUNT(*) FROM users_list WHERE caste_id = :cid OR subcaste_id = :cid) AS members,
            (SELECT COUNT(*) FROM admin_castes WHERE parent_id = :cid) AS children`,
        { cid },
    );
    if (used.members > 0) return { error: 'castes.errors.inUse' };
    if (used.children > 0) return { error: 'castes.errors.hasChildren' };
    await query('DELETE FROM admin_castes WHERE id = :cid', { cid });
    await audit(user.id, 'caste.delete', 'caste', cid);
    revalidatePath('/members/castes');
    forget('castes'); // cached lists (lib/memo)
    return { ok: true, message: 'common.deleted' };
}
