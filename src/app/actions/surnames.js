'use server';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { id, str, strOrNull } from '@/lib/forms';
import { canManageSettings } from '@/lib/roles';
import { applySurnameCastes } from '@/lib/surnames';

/**
 * Save one surname's caste / sub-caste (Members ⋮ → Surnames). Fields: name, name_local, caste_id,
 * subcaste_id. Creates the surname if it is new. Members with that surname and no caste get it
 * now; nobody's existing caste is changed. Administrators (who manage castes) only.
 */
export async function saveSurname(prev, fd) {
    const actor = await getCurrentUser();
    if (!actor || !canManageSettings(actor.role)) return { error: 'common.forbidden' };
    const name = str(fd, 'name', 60);
    if (!name) return { fieldErrors: { name: 'common.required' } };
    const casteId = id(fd, 'caste_id') || null;
    const subId = casteId ? id(fd, 'subcaste_id') || null : null;
    if (casteId && !(await queryOne('SELECT id FROM admin_castes WHERE id = :casteId AND parent_id IS NULL', { casteId })))
        return { fieldErrors: { caste_id: 'common.required' } };
    if (subId && !(await queryOne('SELECT id FROM admin_castes WHERE id = :subId AND parent_id = :casteId', { subId, casteId })))
        return { fieldErrors: { subcaste_id: 'common.required' } };
    await query(
        `INSERT INTO admin_surnames (name, name_local, caste_id, subcaste_id, created_by) VALUES (:name, :nameLocal, :casteId, :subId, :by)
         ON DUPLICATE KEY UPDATE name_local = COALESCE(VALUES(name_local), name_local), caste_id = VALUES(caste_id), subcaste_id = VALUES(subcaste_id)`,
        { name, nameLocal: strOrNull(fd, 'name_local', 60), casteId, subId, by: actor.id },
    );
    const filled = casteId ? await applySurnameCastes() : 0;
    await audit(actor.id, 'surname.save', 'surname', null, { name, casteId, subId, filled });
    revalidatePath('/members/surnames');
    revalidatePath('/members');
    return { ok: true, message: 'surnames.saved', vars: { count: filled } };
}

/**
 * Several surnames → one caste / sub-caste at once (the tick boxes on the Surnames page).
 * Fields: rows = JSON [{ name, name_local }], caste_id, subcaste_id.
 */
export async function saveSurnamesBulk(prev, fd) {
    const actor = await getCurrentUser();
    if (!actor || !canManageSettings(actor.role)) return { error: 'common.forbidden' };
    let rows = [];
    try {
        rows = JSON.parse(String(fd.get('rows') ?? '[]'));
    } catch {
        rows = [];
    }
    rows = rows
        .filter((r) => r && typeof r.name === 'string' && r.name.trim())
        .slice(0, 500)
        .map((r) => ({ name: r.name.trim().slice(0, 60), nameLocal: typeof r.name_local === 'string' && r.name_local.trim() ? r.name_local.trim().slice(0, 60) : null }));
    if (!rows.length) return { error: 'surnames.pickSome' };
    const casteId = id(fd, 'caste_id') || null;
    const subId = casteId ? id(fd, 'subcaste_id') || null : null;
    if (!casteId || !(await queryOne('SELECT id FROM admin_castes WHERE id = :casteId AND parent_id IS NULL', { casteId })))
        return { fieldErrors: { caste_id: 'common.required' } };
    if (subId && !(await queryOne('SELECT id FROM admin_castes WHERE id = :subId AND parent_id = :casteId', { subId, casteId })))
        return { fieldErrors: { subcaste_id: 'common.required' } };
    for (const r of rows) {
        await query(
            `INSERT INTO admin_surnames (name, name_local, caste_id, subcaste_id, created_by) VALUES (:name, :nameLocal, :casteId, :subId, :by)
             ON DUPLICATE KEY UPDATE name_local = COALESCE(VALUES(name_local), name_local), caste_id = VALUES(caste_id), subcaste_id = VALUES(subcaste_id)`,
            { ...r, casteId, subId, by: actor.id },
        );
    }
    const filled = await applySurnameCastes();
    await audit(actor.id, 'surname.save', 'surname', null, { names: rows.map((r) => r.name), casteId, subId, filled });
    revalidatePath('/members/surnames');
    revalidatePath('/members');
    return { ok: true, message: 'surnames.savedMany', vars: { surnames: rows.length, count: filled } };
}
