'use server';
import { refresh } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { getRequest, REQUEST_STATUSES } from '@/lib/blood';
import { query, setMeta, withTransaction } from '@/lib/db';
import { date, id, oneOf, str } from '@/lib/forms';
import { donorIdsFor, notifyMany } from '@/lib/notifications';
import { normalizePhone } from '@/lib/phone';
import { getSetting } from '@/lib/settings';
import { BLOOD_DONORS_FOR, BLOOD_GROUPS, canManageMembers } from '@/lib/roles';

/** Any signed-in member may post a requirement — the need is often urgent and personal. */
export async function createBloodRequest(prev, fd) {
    const user = await getCurrentUser();
    if (!user) return { error: 'common.forbidden' };

    const bloodGroup = oneOf(fd, 'blood_group', BLOOD_GROUPS);
    const units = Number.parseInt(String(fd.get('units') ?? '1'), 10);
    const patient = str(fd, 'patient_name', 150);
    const contact = normalizePhone(fd.get('contact_phone'));
    const neededRaw = str(fd, 'needed_by');
    const neededBy = neededRaw ? date(fd, 'needed_by') : null;

    const fieldErrors = {};
    if (!bloodGroup) fieldErrors.blood_group = 'common.required';
    if (!Number.isInteger(units) || units < 1 || units > 20) fieldErrors.units = 'blood.errors.units';
    if (!patient) fieldErrors.patient_name = 'common.required';
    if (!contact) fieldErrors.contact_phone = 'auth.errors.phoneInvalid';
    if (neededRaw && !neededBy) fieldErrors.needed_by = 'blood.errors.date';
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    const newId = await withTransaction(async (q) => {
        const r = await q(
            `INSERT INTO blood_requests (blood_group, units, patient_name, hospital, city, contact_phone, needed_by, created_by)
             VALUES (:bloodGroup, :units, :patient, :hospital, :city, :contact, :neededBy, :by)`,
            {
                bloodGroup,
                units,
                patient,
                hospital: str(fd, 'hospital', 200) || null,
                city: str(fd, 'city', 100) || null,
                contact,
                neededBy,
                by: user.id,
            },
        );
        await setMeta('blood_requests', r.insertId, { notes: str(fd, 'notes', 2000) }, q);
        return r.insertId;
    });
    await audit(user.id, 'blood.create', 'blood', newId, { blood_group: bloodGroup, units });
    // Everyone who can GIVE to this group and opted in as a donor hears about it.
    if (await getSetting('blood', 'notify_donors')) await notifyMany(await donorIdsFor(BLOOD_DONORS_FOR[bloodGroup]), {
        type: 'blood.request',
        data: { group: bloodGroup, patient, city: str(fd, 'city', 100) || null },
        link: '/blood',
        actorId: user.id,
    });
    refresh();
    return { ok: true, message: 'blood.created' };
}

/** Fulfil / cancel / reopen: the person who posted it, or member managers. */
export async function setBloodRequestStatus(prev, fd) {
    const user = await getCurrentUser();
    const reqId = id(fd, 'id');
    const status = oneOf(fd, 'status', REQUEST_STATUSES);
    if (!user || !reqId || !status) return { error: 'common.forbidden' };

    const req = await getRequest(reqId);
    if (!req) return { error: 'common.error' };
    if (req.created_by !== user.id && !canManageMembers(user.role)) return { error: 'common.forbidden' };
    if (req.status === status) return { ok: true };

    await query('UPDATE blood_requests SET status = :status WHERE id = :id', { status, id: reqId });
    await audit(user.id, 'blood.status', 'blood', reqId, { from: req.status, to: status });
    refresh();
    return { ok: true, message: 'common.saved' };
}
