'use server';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { query, queryOne, setMeta } from '@/lib/db';
import { id, oneOf, str, strOrNull } from '@/lib/forms';
import { canListFor, INCOME_RANGES, isEligible } from '@/lib/matrimony';
import { normalizePhone } from '@/lib/phone';

const FORBIDDEN = { error: 'common.forbidden' };

const intIn = (fd, key, min, max) => {
    const raw = str(fd, key, 5);
    if (!raw) return { value: null };
    const n = Number(raw);
    return Number.isInteger(n) && n >= min && n <= max ? { value: n } : { error: true };
};

/**
 * List (or update) a member's matrimony profile. The person themselves, anyone in their family
 * tree, or a member manager; only while they are alive, unmarried and 18+. Education and
 * occupation are saved on the member (users_listmeta) — the same fields as their profile.
 */
export async function saveMatrimonyProfile(prev, fd) {
    const actor = await getCurrentUser();
    const personId = id(fd, 'person_id');
    if (!actor || !personId || !(await canListFor(actor, personId))) return FORBIDDEN;
    if (!(await isEligible(personId))) return { error: 'matrimony.errors.notEligible' };

    const fieldErrors = {};
    const height = intIn(fd, 'height_cm', 100, 230);
    const ageMin = intIn(fd, 'pref_age_min', 18, 80);
    const ageMax = intIn(fd, 'pref_age_max', 18, 80);
    if (height.error) fieldErrors.height_cm = 'matrimony.errors.height';
    if (ageMin.error) fieldErrors.pref_age_min = 'matrimony.errors.age';
    if (ageMax.error) fieldErrors.pref_age_max = 'matrimony.errors.age';
    if (ageMin.value && ageMax.value && ageMax.value < ageMin.value) fieldErrors.pref_age_max = 'matrimony.errors.ageRange';
    const contactName = str(fd, 'contact_name', 150);
    const contactPhone = normalizePhone(fd.get('contact_phone'));
    if (!contactName) fieldErrors.contact_name = 'common.required';
    if (!contactPhone) fieldErrors.contact_phone = 'auth.errors.phoneInvalid';
    const prefCaste = id(fd, 'pref_caste_id');
    if (prefCaste && !(await queryOne('SELECT id FROM admin_castes WHERE id = :prefCaste', { prefCaste }))) fieldErrors.pref_caste_id = 'common.required';
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    const row = {
        personId,
        height: height.value,
        income: oneOf(fd, 'income_range', INCOME_RANGES),
        contactName,
        contactPhone,
        ageMin: ageMin.value,
        ageMax: ageMax.value,
        prefCaste: prefCaste || null,
        prefCity: strOrNull(fd, 'pref_city', 100),
        prefEducation: strOrNull(fd, 'pref_education', 150),
        about: strOrNull(fd, 'about', 2000),
        by: actor.id,
    };
    const existed = await queryOne('SELECT user_id FROM matrimony_profiles WHERE user_id = :personId', { personId });
    await query(
        `INSERT INTO matrimony_profiles (user_id, is_active, height_cm, income_range, contact_name, contact_phone, pref_age_min, pref_age_max,
                                         pref_caste_id, pref_city, pref_education, about, listed_by)
         VALUES (:personId, 1, :height, :income, :contactName, :contactPhone, :ageMin, :ageMax, :prefCaste, :prefCity, :prefEducation, :about, :by)
         ON DUPLICATE KEY UPDATE is_active = 1, height_cm = VALUES(height_cm), income_range = VALUES(income_range),
             contact_name = VALUES(contact_name), contact_phone = VALUES(contact_phone), pref_age_min = VALUES(pref_age_min),
             pref_age_max = VALUES(pref_age_max), pref_caste_id = VALUES(pref_caste_id), pref_city = VALUES(pref_city),
             pref_education = VALUES(pref_education), about = VALUES(about)`,
        row,
    );
    await setMeta('users_list', personId, { education: str(fd, 'education', 150), occupation: str(fd, 'occupation', 150) });
    await audit(actor.id, existed ? 'matrimony.update' : 'matrimony.list', 'user', personId, {});
    revalidatePath('/matrimony');
    revalidatePath(`/matrimony/${personId}`);
    return { ok: true, message: 'matrimony.saved', id: personId };
}

/** Take a profile off the list (details are kept, so listing again is quick). */
export async function removeMatrimonyProfile(personId) {
    const actor = await getCurrentUser();
    const pid = Number(personId);
    if (!actor || !(await canListFor(actor, pid))) return FORBIDDEN;
    await query('UPDATE matrimony_profiles SET is_active = 0 WHERE user_id = :pid', { pid });
    await audit(actor.id, 'matrimony.remove', 'user', pid, {});
    revalidatePath('/matrimony');
    revalidatePath(`/matrimony/${pid}`);
    return { ok: true, message: 'matrimony.removed' };
}
