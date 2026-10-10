'use server';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { query, queryOne, withTransaction } from '@/lib/db';
import { id, str, strOrNull } from '@/lib/forms';
import { composeName, nameCase } from '@/lib/names';
import { atLeast, canManageSettings } from '@/lib/roles';
import { applySurnameCastes } from '@/lib/surnames';

/**
 * Save one surname's caste / sub-caste (Members ⋮ → Surnames). Fields: name, name_local, caste_id,
 * subcaste_id, original_name (when editing). Creates the surname if it is new. Members with that surname and
 * no caste get it now; nobody's existing caste is changed. Editing also RENAMES: every member carrying the
 * original surname (and every married woman whose maiden surname it is) gets the new English and local
 * spelling, and their full names are rebuilt. Administrators (who manage castes) only.
 */
export async function saveSurname(prev, fd) {
    const actor = await getCurrentUser();
    if (!actor || !canManageSettings(actor.role)) return { error: 'common.forbidden' };
    const name = nameCase(str(fd, 'name', 60));
    if (!name) return { fieldErrors: { name: 'common.required' } };
    const original = str(fd, 'original_name', 60);
    const nameLocal = strOrNull(fd, 'name_local', 60);
    const renamed = original ? await renameSurname(original, name, nameLocal, actor.id) : 0;
    const casteId = id(fd, 'caste_id') || null;
    const subId = casteId ? id(fd, 'subcaste_id') || null : null;
    if (casteId && !(await queryOne('SELECT id FROM admin_castes WHERE id = :casteId AND parent_id IS NULL', { casteId })))
        return { fieldErrors: { caste_id: 'common.required' } };
    if (subId && !(await queryOne('SELECT id FROM admin_castes WHERE id = :subId AND parent_id = :casteId', { subId, casteId })))
        return { fieldErrors: { subcaste_id: 'common.required' } };
    await query(
        `INSERT INTO admin_surnames (name, name_local, caste_id, subcaste_id, created_by) VALUES (:name, :nameLocal, :casteId, :subId, :by)
         ON DUPLICATE KEY UPDATE name_local = COALESCE(VALUES(name_local), name_local), caste_id = VALUES(caste_id), subcaste_id = VALUES(subcaste_id)`,
        { name, nameLocal, casteId, subId, by: actor.id },
    );
    const filled = casteId ? await applySurnameCastes() : 0;
    await audit(actor.id, 'surname.save', 'surname', null, { name, from: original || undefined, renamed, casteId, subId, filled });
    revalidatePath('/members/surnames');
    revalidatePath('/members');
    return original ? { ok: true, message: 'surnames.renamed', vars: { count: renamed } } : { ok: true, message: 'surnames.saved', vars: { count: filled } };
}

/**
 * A surname's new spelling for everyone who carries it: users_list.surname / surname_local (and a married
 * woman's maiden_surname / maiden_surname_local) for every row with the original English surname (any
 * letter case). A full name that was the join of the parts is rebuilt from the new parts; one typed
 * differently is left as it is. The saved surname row moves to the new name (merged into it if the new name
 * is already saved). Returns how many members changed.
 */
async function renameSurname(original, name, nameLocal, actorId) {
    return withTransaction(async (q) => {
        const people = await q(
            `SELECT id, full_name, full_name_local, first_name, middle_name, surname, first_name_local, middle_name_local, surname_local,
                    maiden_surname, maiden_surname_local
               FROM users_list WHERE surname = :original OR maiden_surname = :original FOR UPDATE`,
            { original },
        );
        let changed = 0;
        for (const p of people) {
            const set = {};
            if (p.surname && p.surname.toLowerCase() === original.toLowerCase()) {
                if (p.surname !== name) set.surname = name;
                if (nameLocal && p.surname_local !== nameLocal) set.surname_local = nameLocal;
                const next = { ...p, ...set };
                if (p.full_name === composeName({ first: p.first_name ?? '', middle: p.middle_name ?? '', surname: p.surname ?? '' })) {
                    const full = composeName({ first: next.first_name ?? '', middle: next.middle_name ?? '', surname: next.surname ?? '' }).slice(0, 150);
                    if (full !== p.full_name) set.full_name = full;
                }
                const oldLocal = composeName({ first: p.first_name_local ?? '', middle: p.middle_name_local ?? '', surname: p.surname_local ?? '' });
                if ((p.full_name_local ?? '') === oldLocal) {
                    const local = composeName({
                        first: next.first_name_local ?? '',
                        middle: next.middle_name_local ?? '',
                        surname: next.surname_local ?? '',
                    }).slice(0, 150);
                    if ((local || null) !== p.full_name_local) set.full_name_local = local || null;
                }
            }
            if (p.maiden_surname && p.maiden_surname.toLowerCase() === original.toLowerCase()) {
                if (p.maiden_surname !== name) set.maiden_surname = name;
                if (nameLocal && p.maiden_surname_local !== nameLocal) set.maiden_surname_local = nameLocal;
            }
            const keys = Object.keys(set);
            if (!keys.length) continue;
            await q(`UPDATE users_list SET ${keys.map((k) => `${k} = :${k}`).join(', ')} WHERE id = :id`, { ...set, id: p.id });
            changed++;
        }
        // The saved surname row: renamed — or, when the new name is already saved, the old row goes (the upsert updates the other).
        if (original.toLowerCase() !== name.toLowerCase()) {
            const existing = await q('SELECT id FROM admin_surnames WHERE name = :name', { name });
            if (existing.length) await q('DELETE FROM admin_surnames WHERE name = :original', { original });
            else await q('UPDATE admin_surnames SET name = :name WHERE name = :original', { name, original });
        } else if (original !== name) await q('UPDATE admin_surnames SET name = :name WHERE name = :original', { name, original });
        await q("INSERT INTO admin_audit_log (actor_id, action, entity, entity_id, detail) VALUES (:by, 'surname.rename', 'surname', NULL, :detail)", {
            by: actorId,
            detail: JSON.stringify({ from: original, to: name, toLocal: nameLocal, members: changed }),
        });
        return changed;
    });
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
        .map((r) => ({
            name: r.name.trim().slice(0, 60),
            nameLocal: typeof r.name_local === 'string' && r.name_local.trim() ? r.name_local.trim().slice(0, 60) : null,
        }));
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

/**
 * Delete a saved surname that nobody carries (no member's surname or maiden surname, any letter case).
 * App admins and sub-admins. The Surnames page shows the button only on such rows; this checks again.
 */
export async function deleteSurname(name) {
    const actor = await getCurrentUser();
    if (!actor || !atLeast(actor.role, 'sub_admin')) return { error: 'common.forbidden' };
    const n = String(name ?? '')
        .trim()
        .slice(0, 60);
    if (!n) return { error: 'common.error' };
    const used = await queryOne('SELECT COUNT(*) AS c FROM users_list WHERE surname = :n OR maiden_surname = :n', { n });
    if (Number(used?.c) > 0) return { error: 'surnames.inUse' };
    const r = await query('DELETE FROM admin_surnames WHERE name = :n', { n });
    if (!r?.affectedRows) return { error: 'common.error' };
    await audit(actor.id, 'surname.delete', 'surname', null, { name: n });
    revalidatePath('/members/surnames');
    return { ok: true, message: 'surnames.deleted' };
}
