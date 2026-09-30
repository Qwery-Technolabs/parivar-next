import 'server-only';
import { cache } from 'react';
import { inList, query, queryOne } from './db';
import { canManageMembers } from './roles';

// Family tree: people are users_list rows (a relative may have no phone and no login); links
// are users_relations — child→father / child→mother, spouse (both ways) and sibling (both
// ways, only when no shared parent is recorded). Brothers, sisters, sons and daughters are
// read from those links.

/** The relative slots on a person's Family page, in the order they are shown. */
export const RELATIVE_KINDS = ['father', 'mother', 'spouse', 'brother', 'sister', 'son', 'daughter'];
export const MARITAL_STATUSES = ['unmarried', 'married', 'engaged', 'widowed', 'divorced'];
/** Male line: the member search for these is limited to the person's surname. */
export const SAME_SURNAME_KINDS = ['father', 'brother', 'son'];

/** A relative's gender follows from the slot (a spouse: the opposite of the person's). */
export function genderFor(kind, personGender) {
    if (kind === 'spouse') return personGender === 'female' ? 'male' : personGender === 'male' ? 'female' : null;
    return ['father', 'brother', 'son'].includes(kind) ? 'male' : 'female';
}

/** How many links away the family search reaches; far more than any real family needs. */
const MAX_PEOPLE = 2000;

/**
 * Everyone connected to `userId` through any family link (parents, children, spouses,
 * siblings — as far as it goes), including the person. One query per step outward.
 * Cached per request.
 * @returns {Promise<Set<number>>}
 */
export const familyIds = cache(async (userId) => {
    const seen = new Set([Number(userId)]);
    let level = [Number(userId)];
    while (level.length && seen.size < MAX_PEOPLE) {
        const l = inList(level, 'f');
        const rows = await query(
            `SELECT user_id AS a, relative_id AS b FROM users_relations WHERE user_id IN (${l.sql}) OR relative_id IN (${l.sql})`,
            l.params,
        );
        const next = [];
        for (const { a, b } of rows) {
            for (const x of [a, b]) {
                if (!seen.has(x)) {
                    seen.add(x);
                    next.push(x);
                }
            }
        }
        level = next;
    }
    return seen;
});

/**
 * May `viewer` see this person's family and details (phone, birth date, marital status)?
 * Themselves, app-level member managers, whoever added them, and anyone connected to them
 * in the family tree.
 * @param {{ id: number, role: string }} viewer
 * @param {{ id: number, created_by?: number|null }} person
 */
export async function canSeeFamily(viewer, person) {
    if (!viewer || !person) return false;
    if (viewer.id === person.id || canManageMembers(viewer.role)) return true;
    if (person.created_by && person.created_by === viewer.id) return true;
    return (await familyIds(viewer.id)).has(person.id);
}

/** May `actor` add or remove relatives of this person? The same people who may see the family. */
export const canEditFamily = canSeeFamily;

const COLS = `u.id, u.full_name, u.full_name_local, u.first_name, u.middle_name, u.surname,
    u.first_name_local, u.middle_name_local, u.surname_local, u.gender, u.dob, u.marital_status,
    u.status, u.phone, u.created_by, u.last_login_at`;

/** One person with the columns the family pages need. */
export async function getPerson(id) {
    return queryOne(`SELECT ${COLS} FROM users_list u WHERE u.id = :id`, { id });
}

/**
 * A person's relatives by slot: father, mother, spouses, brothers, sisters, sons, daughters.
 * Siblings = children of either recorded parent, plus explicit sibling links.
 */
export async function getRelatives(id) {
    const [parents, spouses, children, viaParents, explicit] = await Promise.all([
        query(
            `SELECT r.relation, ${COLS} FROM users_relations r JOIN users_list u ON u.id = r.relative_id
              WHERE r.user_id = :id AND r.relation IN ('father', 'mother')`,
            { id },
        ),
        query(
            `SELECT ${COLS} FROM users_relations r JOIN users_list u ON u.id = r.relative_id
              WHERE r.user_id = :id AND r.relation = 'spouse' ORDER BY u.full_name`,
            { id },
        ),
        query(
            `SELECT DISTINCT ${COLS} FROM users_relations r JOIN users_list u ON u.id = r.user_id
              WHERE r.relative_id = :id AND r.relation IN ('father', 'mother') ORDER BY u.dob IS NULL, u.dob, u.full_name`,
            { id },
        ),
        query(
            `SELECT DISTINCT ${COLS} FROM users_relations mine
               JOIN users_relations theirs ON theirs.relative_id = mine.relative_id AND theirs.relation = mine.relation AND theirs.user_id <> :id
               JOIN users_list u ON u.id = theirs.user_id
              WHERE mine.user_id = :id AND mine.relation IN ('father', 'mother')`,
            { id },
        ),
        query(
            `SELECT ${COLS} FROM users_relations r JOIN users_list u ON u.id = r.relative_id
              WHERE r.user_id = :id AND r.relation = 'sibling'`,
            { id },
        ),
    ]);
    const siblings = [...new Map([...viaParents, ...explicit].map((p) => [p.id, p])).values()].sort(
        (a, b) => (a.dob ?? '9999').localeCompare(b.dob ?? '9999') || a.full_name.localeCompare(b.full_name),
    );
    return {
        father: parents.find((p) => p.relation === 'father') ?? null,
        mother: parents.find((p) => p.relation === 'mother') ?? null,
        spouse: spouses,
        brother: siblings.filter((p) => p.gender !== 'female'),
        sister: siblings.filter((p) => p.gender === 'female'),
        son: children.filter((p) => p.gender !== 'female'),
        daughter: children.filter((p) => p.gender === 'female'),
    };
}

/** Would making `candidateId` a parent of `childId` loop the tree (is it already below the child)? */
async function isBelow(candidateId, childId) {
    let level = [childId];
    const seen = new Set(level);
    for (let depth = 0; depth < 30 && level.length; depth++) {
        const l = inList(level, 'd');
        const rows = await query(`SELECT user_id FROM users_relations WHERE relative_id IN (${l.sql}) AND relation IN ('father', 'mother')`, l.params);
        const next = [];
        for (const r of rows) {
            if (r.user_id === candidateId) return true;
            if (!seen.has(r.user_id)) {
                seen.add(r.user_id);
                next.push(r.user_id);
            }
        }
        level = next;
    }
    return false;
}

/** Checks before linking: returns an error key, or null when the link is fine. */
export async function linkProblem(person, kind, relativeId) {
    if (relativeId === person.id) return 'relations.selfError';
    if (kind === 'father' || kind === 'mother') return (await isBelow(relativeId, person.id)) ? 'relations.cycleError' : null;
    if (kind === 'son' || kind === 'daughter') return (await isBelow(person.id, relativeId)) ? 'relations.cycleError' : null;
    return null;
}

/**
 * Link `relativeId` into `person`'s family as `kind`, inside a transaction (`q`). Keeps the
 * family consistent: a new father becomes the mother's spouse (and the other way round); a
 * brother or sister gets the person's recorded parents (or a sibling link when none are
 * recorded); a son or daughter also gets the person's spouse as the other parent when there
 * is exactly one; a spouse link marks both married.
 */
export async function linkRelative(q, person, kind, relativeId) {
    const rel = Number(relativeId);
    const parentsOf = async (id) => q(`SELECT relative_id, relation FROM users_relations WHERE user_id = :id AND relation IN ('father', 'mother')`, { id });
    const setParent = async (child, parent, relation) => {
        await q('DELETE FROM users_relations WHERE user_id = :child AND relation = :relation', { child, relation });
        await q('INSERT INTO users_relations (user_id, relative_id, relation) VALUES (:child, :parent, :relation)', { child, parent, relation });
    };
    const both = async (a, b, relation) => {
        for (const [x, y] of [[a, b], [b, a]]) {
            await q('INSERT IGNORE INTO users_relations (user_id, relative_id, relation) VALUES (:x, :y, :relation)', { x, y, relation });
        }
    };
    const married = async (ids) => {
        const l = inList(ids, 'm');
        await q(`UPDATE users_list SET marital_status = 'married' WHERE id IN (${l.sql}) AND (marital_status IS NULL OR marital_status = 'unmarried')`, l.params);
    };

    if (kind === 'father' || kind === 'mother') {
        await setParent(person.id, rel, kind);
        const other = (await parentsOf(person.id)).find((p) => p.relation !== kind);
        if (other) {
            await both(rel, other.relative_id, 'spouse');
            await married([rel, other.relative_id]);
        }
        // Explicit siblings without this parent get it too — they share the person's parents.
        const sibs = await q(`SELECT relative_id FROM users_relations WHERE user_id = :id AND relation = 'sibling'`, { id: person.id });
        for (const s of sibs) {
            const has = (await parentsOf(s.relative_id)).some((p) => p.relation === kind);
            if (!has) await q('INSERT INTO users_relations (user_id, relative_id, relation) VALUES (:c, :p, :r)', { c: s.relative_id, p: rel, r: kind });
        }
        return;
    }
    if (kind === 'spouse') {
        await both(person.id, rel, 'spouse');
        await married([person.id, rel]);
        return;
    }
    if (kind === 'brother' || kind === 'sister') {
        const parents = await parentsOf(person.id);
        if (!parents.length) {
            await both(person.id, rel, 'sibling');
            return;
        }
        const theirs = await parentsOf(rel);
        for (const p of parents) {
            if (!theirs.some((x) => x.relation === p.relation)) {
                await q('INSERT INTO users_relations (user_id, relative_id, relation) VALUES (:c, :p, :r)', { c: rel, p: p.relative_id, r: p.relation });
            }
        }
        return;
    }
    // son / daughter
    const parentRel = person.gender === 'female' ? 'mother' : 'father';
    await setParent(rel, person.id, parentRel);
    const spouses = await q(`SELECT relative_id FROM users_relations WHERE user_id = :id AND relation = 'spouse'`, { id: person.id });
    if (spouses.length === 1) {
        const otherRel = parentRel === 'father' ? 'mother' : 'father';
        const has = (await parentsOf(rel)).some((p) => p.relation === otherRel);
        if (!has) await q('INSERT INTO users_relations (user_id, relative_id, relation) VALUES (:c, :p, :r)', { c: rel, p: spouses[0].relative_id, r: otherRel });
    }
}
