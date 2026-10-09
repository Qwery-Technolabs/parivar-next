import 'server-only';
import { cache } from 'react';
import { inList, query, queryOne } from './db';
import { composeName } from './names';
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
/**
 * Every family link in the app, read ONCE per request (one small query — a Samaj has a few
 * hundred links at most). The connected-family walk then runs in memory instead of one
 * database round trip per generation, which queued requests when several people were on.
 */
const allRelations = cache(async () => query('SELECT id, user_id, relative_id, relation FROM users_relations ORDER BY id'));
const allLinks = cache(async () => (await allRelations()).map((r) => ({ a: r.user_id, b: r.relative_id })));

export const familyIds = cache(async (userId) => {
    const adj = new Map();
    const add = (x, y) => (adj.get(x) ?? adj.set(x, []).get(x)).push(y);
    for (const { a, b } of await allLinks()) {
        add(a, b);
        add(b, a);
    }
    const start = Number(userId);
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length && seen.size < MAX_PEOPLE) {
        for (const n of adj.get(stack.pop()) ?? []) {
            if (!seen.has(n)) {
                seen.add(n);
                stack.push(n);
            }
        }
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
    u.first_name_local, u.middle_name_local, u.surname_local, u.maiden_middle_name, u.maiden_surname,
    u.maiden_middle_name_local, u.maiden_surname_local, u.gender, u.dob, u.marital_status,
    u.status, u.phone, u.village, u.created_by, u.last_login_at`;

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
              WHERE r.relative_id = :id AND r.relation IN ('father', 'mother') ORDER BY u.id`,
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
    const siblings = byAge([...new Map([...viaParents, ...explicit].map((p) => [p.id, p])).values()].sort((a, b) => a.id - b.id));
    return {
        father: parents.find((p) => p.relation === 'father') ?? null,
        mother: parents.find((p) => p.relation === 'mother') ?? null,
        spouse: spouses,
        brother: siblings.filter((p) => p.gender !== 'female'),
        sister: siblings.filter((p) => p.gender === 'female'),
        son: byAge(children).filter((p) => p.gender !== 'female'),
        daughter: byAge(children).filter((p) => p.gender === 'female'),
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
        for (const [x, y] of [
            [a, b],
            [b, a],
        ]) {
            await q('INSERT IGNORE INTO users_relations (user_id, relative_id, relation) VALUES (:x, :y, :relation)', { x, y, relation });
        }
    };
    const married = async (ids) => {
        const l = inList(ids, 'm');
        await q(
            `UPDATE users_list SET marital_status = 'married' WHERE id IN (${l.sql}) AND (marital_status IS NULL OR marital_status = 'unmarried')`,
            l.params,
        );
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
        if (!has)
            await q('INSERT INTO users_relations (user_id, relative_id, relation) VALUES (:c, :p, :r)', { c: rel, p: spouses[0].relative_id, r: otherRel });
    }
}

/**
 * The family line as a real tree: start from the oldest recorded ancestor up the father's line
 * (the mother's when no father is recorded), then every descendant below, generation by
 * generation — each person with their spouse(s), children under the couple; a visited set stops loops.
 * Walked in memory over the request's family links (allRelations), then ONE query for the people —
 * it used to be a query per generation up and three per generation down (≈ 40 round trips).
 * @returns {Promise<null | { rootId: number, top: object }>}  top = { ...person, spouses: [], children: [node] }
 */
export async function getLineageTree(rootId, maxDepth = 20) {
    const [root, rels] = await Promise.all([getPerson(rootId), allRelations()]);
    if (!root) return null;
    const push = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);
    const parentsOf = new Map(); // child → [{ relative_id, relation }]
    const spousesOf = new Map(); // person → [spouse ids]
    const kidsOf = new Map(); // parent → [{ id, child, parent }]
    for (const r of rels) {
        if (r.relation === 'father' || r.relation === 'mother') {
            push(parentsOf, r.user_id, r);
            push(kidsOf, r.relative_id, { id: r.id, child: r.user_id, parent: r.relative_id });
        } else if (r.relation === 'spouse') push(spousesOf, r.user_id, r.relative_id);
    }
    // Up to the oldest ancestor.
    let topId = root.id;
    const upSeen = new Set([topId]);
    for (let i = 0; i < maxDepth; i++) {
        const parents = parentsOf.get(topId) ?? [];
        const next = (parents.find((p) => p.relation === 'father') ?? parents.find((p) => p.relation === 'mother'))?.relative_id;
        if (!next || upSeen.has(next)) break;
        upSeen.add(next);
        topId = next;
    }

    // The shape first, by id: { id, spouses: [id], children: [shape] }.
    const placed = new Set([topId]); // a person appears once (as a node or as a spouse)
    const shapes = new Map(); // id → shape
    const top = { id: topId, spouses: [], children: [] };
    shapes.set(topId, top);
    let level = [topId];
    for (let depth = 0; depth < maxDepth && level.length; depth++) {
        const coupleOf = new Map(); // spouse id → the node they sit beside
        for (const a of level)
            for (const b of spousesOf.get(a) ?? []) {
                if (placed.has(b)) continue;
                placed.add(b);
                shapes.get(a).spouses.push(b);
                coupleOf.set(b, a);
            }
        // Children of anyone in a couple on this level go under that couple, in the order they were linked.
        const kids = [...level, ...coupleOf.keys()].flatMap((pid) => kidsOf.get(pid) ?? []).sort((x, y) => x.id - y.id);
        const next = [];
        for (const { child, parent } of kids) {
            if (placed.has(child)) continue;
            placed.add(child);
            const owner = shapes.get(parent) ?? shapes.get(coupleOf.get(parent));
            if (!owner) continue;
            const shape = { id: child, spouses: [], children: [] };
            shapes.set(child, shape);
            owner.children.push(shape);
            next.push(child);
        }
        level = next;
    }

    // Then everyone in it, in one query; a link to a missing person is dropped.
    const people = new Map([[root.id, root]]);
    const ids = [...placed].filter((x) => !people.has(x));
    if (ids.length) {
        const l = inList(ids, 'p');
        for (const r of await query(`SELECT ${COLS} FROM users_list u WHERE u.id IN (${l.sql})`, l.params)) people.set(r.id, r);
    }
    const build = (sh) => ({
        ...people.get(sh.id),
        spouses: sh.spouses.filter((x) => people.has(x)).map((x) => people.get(x)),
        // Children left to right, eldest first — among those with a birth date; the rest keep their place.
        children: byAge(sh.children.filter((c) => people.has(c.id)).map(build)),
    });
    return { rootId: root.id, top: build(top) };
}

/**
 * Eldest first among people with a birth date (dob); people without one keep their place (the
 * order they were added in), so a missing date never moves anyone around.
 */
export function byAge(list) {
    const dated = list.filter((p) => p.dob).sort((a, b) => String(a.dob).localeCompare(String(b.dob)));
    let i = 0;
    return list.map((p) => (p.dob ? dated[i++] : p));
}

// ── relation paths ("how are we related?") ────────────────────────────────────

/**
 * Everyone connected to `startId` and how they link: parents, children, spouses and siblings
 * (explicit links plus children of the same parent). Two queries for the whole family.
 */
async function familyGraph(startId) {
    const ids = [...(await familyIds(startId))];
    const l = inList(ids, 'k');
    const inFamily = new Set(ids);
    const [people, rows] = await Promise.all([
        query(`SELECT ${COLS} FROM users_list u WHERE u.id IN (${l.sql})`, l.params),
        // The links come from the request's cached list — no second query.
        allRelations().then((all) => all.filter((r) => inFamily.has(r.user_id))),
    ]);
    const byId = new Map(people.map((p) => [p.id, p]));
    const parents = new Map();
    const children = new Map();
    const spouses = new Map();
    const sibs = new Map();
    const push = (m, k, v) => m.set(k, [...(m.get(k) ?? []), v]);
    for (const r of rows) {
        if (r.relation === 'father' || r.relation === 'mother') {
            push(parents, r.user_id, { id: r.relative_id, relation: r.relation });
            push(children, r.relative_id, r.user_id);
        } else if (r.relation === 'spouse') push(spouses, r.user_id, r.relative_id);
        else if (r.relation === 'sibling') push(sibs, r.user_id, r.relative_id);
    }
    const g = (id) => byId.get(id)?.gender;
    /** Neighbours of one person as [id, step] — step = how that neighbour relates to them. */
    const next = (id) => {
        const out = [];
        for (const s of spouses.get(id) ?? []) out.push([s, g(s) === 'female' ? 'wife' : 'husband']);
        for (const p of parents.get(id) ?? []) out.push([p.id, p.relation]);
        const siblingIds = new Set(sibs.get(id) ?? []);
        for (const p of parents.get(id) ?? []) for (const c of children.get(p.id) ?? []) if (c !== id) siblingIds.add(c);
        for (const s of siblingIds) out.push([s, g(s) === 'female' ? 'sister' : 'brother']);
        for (const c of children.get(id) ?? []) out.push([c, g(c) === 'female' ? 'daughter' : 'son']);
        return out;
    };
    return { byId, next };
}

/** Breadth-first from `startId`: for every reachable person, the steps from start to them. */
function pathsFrom(graph, startId) {
    const steps = new Map([[startId, []]]);
    const via = new Map([[startId, null]]);
    let level = [startId];
    while (level.length) {
        const nextLevel = [];
        for (const id of level) {
            for (const [n, step] of graph.next(id)) {
                if (steps.has(n)) continue;
                steps.set(n, [...steps.get(id), step]);
                via.set(n, id);
                nextLevel.push(n);
            }
        }
        level = nextLevel;
    }
    return { steps, via };
}

/**
 * How `toId` is related to `fromId`: the chain of people from one to the other, each with the
 * step from the previous person ('father', 'sister', 'husband' …), and the path's steps.
 * null when they are not connected (or are the same person).
 * @returns {Promise<null | { chain: Array<{ person: object, step: string|null }>, steps: string[] }>}
 */
export async function relationPath(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return null;
    const graph = await familyGraph(fromId);
    if (!graph.byId.has(toId)) return null;
    const { steps, via } = pathsFrom(graph, fromId);
    if (!steps.has(toId)) return null;
    const ids = [];
    for (let cur = toId; cur != null; cur = via.get(cur)) ids.unshift(cur);
    const path = steps.get(toId);
    return { chain: ids.map((id, i) => ({ person: graph.byId.get(id), step: i === 0 ? null : path[i - 1] })), steps: path };
}

/** For each person reachable from `rootId`: the steps from root to them (for tree labels). */
export async function relationStepsFrom(rootId) {
    const graph = await familyGraph(rootId);
    return pathsFrom(graph, rootId).steps;
}

const MARRIED_LIKE = ['married', 'widowed', 'divorced'];
const marriedWoman = (p) => p.gender === 'female' && MARRIED_LIKE.includes(p.marital_status);

/**
 * Names follow the links (never overwriting what someone typed):
 *  - father's name: a child's EMPTY father's name is filled from the linked father's first name —
 *    for a married woman that is her MAIDEN father's name (+ maiden surname = his surname), since
 *    her main middle name is her husband's;
 *  - husband's name: a married woman's EMPTY main middle name / surname come from her linked
 *    husband (his first name, his surname — the in-laws').
 * Full names are rebuilt. Runs inside the same transaction as the link (`q`), for the given
 * people and everyone sharing a father with them (or whose father they are).
 */
export async function fillFatherNames(q, ids) {
    const list = [...new Set(ids.filter(Boolean).map(Number))];
    if (!list.length) return;
    const l = inList(list, 'n');
    const NAME_COLS = `u.id, u.gender, u.marital_status, u.first_name, u.middle_name, u.surname, u.first_name_local, u.middle_name_local,
        u.surname_local, u.maiden_middle_name, u.maiden_surname, u.maiden_middle_name_local, u.maiden_surname_local`;
    const save = (k) =>
        q(
            `UPDATE users_list SET middle_name = :middle_name, middle_name_local = :middle_name_local, surname = :surname, surname_local = :surname_local,
                    maiden_middle_name = :maiden_middle_name, maiden_surname = :maiden_surname,
                    maiden_middle_name_local = :maiden_middle_name_local, maiden_surname_local = :maiden_surname_local,
                    full_name = :full_name, full_name_local = :full_name_local
              WHERE id = :id`,
            {
                ...k,
                full_name: composeName({ first: k.first_name, middle: k.middle_name, surname: k.surname }).slice(0, 150) || k.first_name,
                full_name_local: composeName({ first: k.first_name_local, middle: k.middle_name_local, surname: k.surname_local }).slice(0, 150) || null,
            },
        );

    // 1) Father's name from the linked father.
    const fathers = new Set(list); // the people themselves may be fathers
    for (const r of await q(`SELECT relative_id FROM users_relations WHERE relation = 'father' AND user_id IN (${l.sql})`, l.params))
        fathers.add(r.relative_id);
    for (const fid of fathers) {
        const [father] = await q('SELECT first_name, first_name_local, surname, surname_local FROM users_list WHERE id = :fid', { fid });
        if (!father?.first_name) continue;
        const kids = await q(
            `SELECT ${NAME_COLS} FROM users_relations r JOIN users_list u ON u.id = r.user_id WHERE r.relative_id = :fid AND r.relation = 'father'`,
            { fid },
        );
        for (const k of kids) {
            if (marriedWoman(k)) {
                if (k.maiden_middle_name) continue;
                await save({
                    ...k,
                    maiden_middle_name: father.first_name,
                    maiden_middle_name_local: k.maiden_middle_name_local || father.first_name_local || null,
                    maiden_surname: k.maiden_surname || father.surname || null,
                    maiden_surname_local: k.maiden_surname_local || father.surname_local || null,
                });
            } else if (!k.middle_name) {
                await save({ ...k, middle_name: father.first_name, middle_name_local: k.middle_name_local || father.first_name_local || null });
            }
        }
    }

    // 2) Husband's name + in-laws' surname for married women among (and married to) these people.
    const wives = await q(
        `SELECT ${NAME_COLS}, h.first_name AS h_first, h.first_name_local AS h_first_local, h.surname AS h_surname, h.surname_local AS h_surname_local
           FROM users_relations r JOIN users_list u ON u.id = r.user_id JOIN users_list h ON h.id = r.relative_id
          WHERE r.relation = 'spouse' AND h.gender = 'male' AND (r.user_id IN (${l.sql}) OR r.relative_id IN (${l.sql}))`,
        l.params,
    );
    for (const w of wives) {
        if (!marriedWoman(w) || (w.middle_name && w.surname)) continue;
        await save({
            ...w,
            middle_name: w.middle_name || w.h_first,
            middle_name_local: w.middle_name_local || w.h_first_local || null,
            surname: w.surname || w.h_surname,
            surname_local: w.surname_local || w.h_surname_local || null,
        });
    }
}

/**
 * Caste follows the family: anyone in it WITHOUT a caste takes it (with the sub-caste) from the
 * nearest relative who has one — father, then husband (a married woman takes her husband's),
 * spouse, mother, brother / sister, son / daughter. Repeats until nothing changes, so a caste
 * set on one person spreads along the tree. A caste someone set is never changed. Inside the
 * link's transaction (`q`); the whole family table is small.
 */
export async function fillCastes(q) {
    const people = new Map((await q('SELECT id, gender, caste_id, subcaste_id FROM users_list')).map((p) => [p.id, p]));
    const links = await q('SELECT user_id, relative_id, relation FROM users_relations');
    const by = (rel) => {
        const m = new Map();
        for (const l of links) if (l.relation === rel) m.set(l.user_id, [...(m.get(l.user_id) ?? []), l.relative_id]);
        return m;
    };
    const fathers = by('father');
    const mothers = by('mother');
    const spouses = by('spouse');
    const sibs = by('sibling');
    const children = new Map();
    for (const l of links)
        if (l.relation === 'father' || l.relation === 'mother') children.set(l.relative_id, [...(children.get(l.relative_id) ?? []), l.user_id]);
    const siblingsOf = (id) => {
        const s = new Set(sibs.get(id) ?? []);
        for (const p of [...(fathers.get(id) ?? []), ...(mothers.get(id) ?? [])]) for (const c of children.get(p) ?? []) if (c !== id) s.add(c);
        return [...s];
    };
    const withCaste = (ids) => ids.map((i) => people.get(i)).find((p) => p?.caste_id);
    for (let pass = 0; pass < 10; pass++) {
        let changed = 0;
        for (const p of people.values()) {
            if (p.caste_id) continue;
            const sp = spouses.get(p.id) ?? [];
            const husbands = sp.filter((i) => people.get(i)?.gender === 'male');
            const src =
                withCaste(fathers.get(p.id) ?? []) ??
                (p.gender === 'female' ? withCaste(husbands) : null) ??
                withCaste(sp) ??
                withCaste(mothers.get(p.id) ?? []) ??
                withCaste(siblingsOf(p.id)) ??
                withCaste(children.get(p.id) ?? []);
            if (!src) continue;
            p.caste_id = src.caste_id;
            p.subcaste_id = src.subcaste_id;
            await q('UPDATE users_list SET caste_id = :c, subcaste_id = :s WHERE id = :id AND caste_id IS NULL', {
                c: src.caste_id,
                s: src.subcaste_id,
                id: p.id,
            });
            changed++;
        }
        if (!changed) break;
    }
}
