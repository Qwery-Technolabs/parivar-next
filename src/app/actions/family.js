'use server';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser, hashPassword } from '@/lib/auth';
import { query, queryOne, setMeta, withTransaction } from '@/lib/db';
import { canEditFamily, fillCastes, fillFatherNames, genderFor, getPerson, linkProblem, linkRelative, MARITAL_STATUSES, RELATIVE_KINDS } from '@/lib/family';
import { date, id, oneOf, str, strOrNull } from '@/lib/forms';
import { composeName } from '@/lib/names';
import { normalizePhone } from '@/lib/phone';
import { applySurnameCastes } from '@/lib/surnames';

const FORBIDDEN = { error: 'common.forbidden' };

function refresh(...ids) {
    for (const i of ids) {
        revalidatePath(`/members/${i}`);
        revalidatePath(`/members/${i}/tree`);
    }
    revalidatePath('/members');
}

/**
 * Add a relative from a person's Family page. Fields: person_id, kind (father … daughter), and
 *   mode = member → relative_id (someone already in the app), or
 *   mode = new    → first/middle/surname (+ *_local), phone (optional), dob, alive, marital_status.
 * A new person with a phone number gets a login (password = that number, changed on first
 * sign-in); without one they are listed in the family and the Members list but cannot sign in.
 * Anyone who may see the person's family may add to it (themselves, their family, whoever
 * added them, member managers).
 */
export async function addRelative(prev, fd) {
    const actor = await getCurrentUser();
    const person = await getPerson(id(fd, 'person_id'));
    if (!actor || !person || !(await canEditFamily(actor, person))) return FORBIDDEN;
    const kind = oneOf(fd, 'kind', RELATIVE_KINDS);
    if (!kind) return { fieldErrors: { kind: 'common.required' } };
    const gender = genderFor(kind, person.gender);

    let relativeId;
    if (fd.get('mode') === 'member') {
        relativeId = id(fd, 'relative_id');
        if (!relativeId || !(await queryOne('SELECT id FROM users_list WHERE id = :relativeId', { relativeId }))) {
            return { fieldErrors: { relative_id: 'common.required' } };
        }
    } else {
        const first = str(fd, 'first_name', 60);
        const middle = str(fd, 'middle_name', 60);
        const surname = str(fd, 'surname', 60);
        const fieldErrors = {};
        if (!first) fieldErrors.first_name = 'common.required';
        if (!surname) fieldErrors.surname = 'common.required';
        const rawPhone = str(fd, 'phone', 20);
        const phone = rawPhone ? normalizePhone(rawPhone) : null;
        if (rawPhone && !phone) fieldErrors.phone = 'auth.errors.phoneInvalid';
        const rawDob = str(fd, 'dob');
        const dob = date(fd, 'dob');
        if (rawDob && !dob) fieldErrors.dob = 'fundraise.errors.date';
        if (Object.keys(fieldErrors).length) return { fieldErrors };

        const late = fd.get('alive') === 'late';
        // Parents are married by default; the form preselects it and the server keeps the rule.
        const marital = oneOf(fd, 'marital_status', MARITAL_STATUSES, kind === 'father' || kind === 'mother' || kind === 'spouse' ? 'married' : null);
        // A married (widowed / divorced) woman: main name = husband's name + in-laws' surname; maiden parts beside it.
        const marriedWoman = gender === 'female' && ['married', 'widowed', 'divorced'].includes(marital ?? '');
        const maiden = marriedWoman
            ? {
                  middle: strOrNull(fd, 'maiden_middle_name', 60),
                  surname: strOrNull(fd, 'maiden_surname', 60),
                  middleLocal: strOrNull(fd, 'maiden_middle_name_local', 60),
                  surnameLocal: strOrNull(fd, 'maiden_surname_local', 60),
              }
            : { middle: null, surname: null, middleLocal: null, surnameLocal: null };
        const local = {
            first: str(fd, 'first_name_local', 60),
            middle: str(fd, 'middle_name_local', 60),
            surname: str(fd, 'surname_local', 60),
        };

        // A number that already belongs to someone: link that person instead of creating a twin.
        const existing = phone ? await queryOne('SELECT id FROM users_list WHERE phone = :phone', { phone }) : null;
        if (existing) {
            relativeId = existing.id;
        } else {
            const withLogin = Boolean(phone) && !late;
            const r = await query(
                `INSERT INTO users_list (phone, password_hash, full_name, full_name_local, first_name, middle_name, surname,
                                         first_name_local, middle_name_local, surname_local, maiden_middle_name, maiden_surname,
                                         maiden_middle_name_local, maiden_surname_local, gender, dob, marital_status, status, role, created_by)
                 VALUES (:phone, :hash, :fullName, :fullNameLocal, :first, :middle, :surname,
                         :firstLocal, :middleLocal, :surnameLocal, :maidenMiddle, :maidenSurname,
                         :maidenMiddleLocal, :maidenSurnameLocal, :gender, :dob, :marital, :status, 'sabhyo', :by)`,
                {
                    phone,
                    hash: withLogin ? await hashPassword(phone) : null,
                    fullName: composeName({ first, middle, surname }),
                    fullNameLocal: composeName(local) || null,
                    first,
                    middle: middle || null,
                    surname,
                    firstLocal: local.first || null,
                    middleLocal: local.middle || null,
                    surnameLocal: local.surname || null,
                    maidenMiddle: maiden.middle,
                    maidenSurname: maiden.surname,
                    maidenMiddleLocal: maiden.middleLocal,
                    maidenSurnameLocal: maiden.surnameLocal,
                    gender,
                    dob,
                    marital,
                    status: late ? 'deceased' : 'active',
                    by: actor.id,
                },
            );
            relativeId = r.insertId;
            await setMeta('users_list', relativeId, {
                added_via: 'family',
                ...(withLogin ? { must_change_password: '1', invited_by: String(actor.id) } : {}),
            });
            await audit(actor.id, 'user.create', 'user', relativeId, { via: 'family', kind, withLogin });
        }
    }

    const problem = await linkProblem(person, kind, relativeId);
    if (problem) return { fieldErrors: { [fd.get('mode') === 'member' ? 'relative_id' : 'first_name']: problem } };
    await withTransaction(async (q) => {
        await linkRelative(q, person, kind, relativeId);
        // Father's name follows the father: fill empty middle names of the people just linked.
        await fillFatherNames(q, [person.id, relativeId]);
        // Caste follows the family (father → husband → spouse → mother → siblings → children); never overwrites.
        await fillCastes(q);
        // Still no caste: the surname's (Members ⋮ → Surnames).
        await applySurnameCastes([person.id, relativeId], q);
    });
    await audit(actor.id, 'user.relation.add', 'user', person.id, { relativeId, kind });
    refresh(person.id, relativeId);
    return { ok: true, message: 'family.added' };
}

/** Remove the link between a person and one relative (the people stay). */
export async function removeRelative(personId, relativeId) {
    const actor = await getCurrentUser();
    const person = await getPerson(Number(personId));
    if (!actor || !person || !(await canEditFamily(actor, person))) return FORBIDDEN;
    const a = person.id;
    const b = Number(relativeId);
    await withTransaction((q) =>
        q('DELETE FROM users_relations WHERE (user_id = :a AND relative_id = :b) OR (user_id = :b AND relative_id = :a)', { a, b }),
    );
    await audit(actor.id, 'user.relation.remove', 'user', a, { relativeId: b });
    refresh(a, b);
    return { ok: true, message: 'family.removed' };
}
