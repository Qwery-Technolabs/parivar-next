import 'server-only';
import { getMeta, getMetaMany, inList, query, queryOne } from './db';
import { fundraiseGroupIds } from './access';
import { canManageAllFundraises } from './roles';
import { memo } from './memo';

export const CAMPAIGN_STATUSES = ['active', 'draft', 'closed'];
// Team roles in rank order, for ORDER BY FIELD(...) (same order as access.js FUNDRAISE_TEAM_ROLES).
const ROLE_ORDER = "'admin', 'organizer', 'treasurer', 'collector', 'expenser', 'volunteer'";
// 'unpaid' = pledged, money not in yet: listed (marked Pending) but out of every collected total.
export const PAY_MODES = ['cash', 'upi', 'bank', 'cheque', 'other', 'unpaid'];
const TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;

export const AUDIENCE_KINDS = ['surname', 'caste', 'subcaste', 'city', 'village'];

/**
 * 1 when any audience rule of campaign c matches the viewer (:viewerId). Comparisons use the
 * columns' utf8mb4_unicode_ci collation, so "patel" matches "Patel" without LOWER() — which
 * would also defeat the (kind, value) index. Surname = last word of full_name.
 * city = where the member lives now (users_list.city); village = their native village.
 * caste/subcaste values are admin_castes ids stored as text; the int side is cast to match.
 */
const FOR_YOU = `EXISTS (
    SELECT 1 FROM fundraise_audience a
      JOIN users_list me ON me.id = :viewerId
     WHERE a.campaign_id = c.id AND (
           (a.kind = 'surname' AND a.value = COALESCE(me.surname, SUBSTRING_INDEX(TRIM(me.full_name), ' ', -1)))
        OR (a.kind = 'caste' AND a.value = CAST(me.caste_id AS CHAR))
        OR (a.kind = 'subcaste' AND a.value = CAST(me.subcaste_id AS CHAR))
        OR (a.kind = 'city' AND a.value = me.city)
        OR (a.kind = 'village' AND a.value = me.village)
     ))`;

/**
 * Audience = WHO SEES IT. No rows → everyone. With rows → only matching members, unless the
 * "also show everyone else, lower down" switch is on (meta audience_others = '1'). Its team and
 * the admins / sub-admins of its groups always see it; app-level managers skip this check.
 * A Mandal (kind 'mandal') ignores all that: only its group's members, its own members and its team —
 * in its group's list and in the Fundraise feed (tagged "Mandal") alike.
 */
const AUDIENCE_OK = `(
    (c.kind = 'mandal' AND (
        EXISTS (SELECT 1 FROM admin_group_members mgx WHERE mgx.group_id = c.group_id AND mgx.user_id = :viewerId)
        OR EXISTS (SELECT 1 FROM fundraise_subscribers msx WHERE msx.campaign_id = c.id AND msx.user_id = :viewerId)
        OR EXISTS (SELECT 1 FROM fundraise_members mtx WHERE mtx.campaign_id = c.id AND mtx.user_id = :viewerId)
    ))
    OR (c.kind <> 'mandal' AND (
    NOT EXISTS (SELECT 1 FROM fundraise_audience ax WHERE ax.campaign_id = c.id)
    OR EXISTS (SELECT 1 FROM fundraise_campaignsmeta mx WHERE mx.campaign_id = c.id AND mx.meta_key = 'audience_others' AND mx.meta_value = '1')
    OR ${FOR_YOU}
    OR EXISTS (SELECT 1 FROM fundraise_members tx WHERE tx.campaign_id = c.id AND tx.user_id = :viewerId)
    OR EXISTS (SELECT 1 FROM fundraise_groups gx JOIN admin_group_members gmx ON gmx.group_id = gx.group_id AND gmx.user_id = :viewerId
                AND gmx.member_role IN ('admin', 'sub_admin') WHERE gx.campaign_id = c.id)
    ))
)`;

/** The audience filter for one viewer, as { sql, params } over alias `c` (app-level managers: none). */
export function audienceFilter(user) {
    if (canManageAllFundraises(user.role)) return { sql: '1 = 1', params: {} };
    return { sql: AUDIENCE_OK, params: { viewerId: user.id } };
}

/** May this viewer open this fundraise at all (audience only — drafts are checked separately)? */
export async function canSeeCampaign(user, campaignId) {
    const f = audienceFilter(user);
    const row = await queryOne(`SELECT 1 AS ok FROM fundraise_campaigns c WHERE c.id = :campaignId AND ${f.sql}`, { campaignId, ...f.params });
    return Boolean(row);
}

// Totals as correlated subqueries: each hits idx_fundraise_*_camp, so a page of 20
// campaigns costs 40 index range reads instead of a join that multiplies rows.
const TOTALS = `
    (SELECT COALESCE(SUM(amount), 0) FROM fundraise_contributions fc WHERE fc.campaign_id = c.id AND fc.deleted_at IS NULL AND fc.mode <> 'unpaid') AS collected,
    (SELECT COALESCE(SUM(amount), 0) FROM fundraise_contributions fc WHERE fc.campaign_id = c.id AND fc.deleted_at IS NULL AND fc.mode = 'unpaid') AS pending,
    (SELECT COUNT(*) FROM fundraise_contributions fc WHERE fc.campaign_id = c.id AND fc.deleted_at IS NULL) AS contribution_count,
    (SELECT COALESCE(SUM(amount), 0) FROM fundraise_expenses fe WHERE fe.campaign_id = c.id AND fe.deleted_at IS NULL) AS spent,
    (SELECT COUNT(*) FROM fundraise_expenses fe WHERE fe.campaign_id = c.id AND fe.deleted_at IS NULL) AS expense_count`;

const COLS = `c.id, c.group_id, c.kind, c.title, c.title_local, c.location, c.target_amount, c.start_date, c.end_date, c.status, c.archived_at,
    c.is_public, c.public_token, c.created_at, c.created_by, g.name AS group_name, g.name_local AS group_name_local`;

/**
 * Drafts are visible only to people who can manage them: app-level fundraise managers,
 * or admins and sub-admins of any group the draft is shown in.
 */
async function visibilityClause(user) {
    if (canManageAllFundraises(user.role)) return { sql: '1 = 1', params: {} };
    const aud = audienceFilter(user);
    const ids = await fundraiseGroupIds(user.id);
    if (!ids.length) return { sql: `c.status <> 'draft' AND ${aud.sql}`, params: aud.params };
    const list = inList(ids, 'vg');
    return {
        sql: `(c.status <> 'draft' OR EXISTS (SELECT 1 FROM fundraise_groups vfg WHERE vfg.campaign_id = c.id AND vfg.group_id IN (${list.sql}))) AND ${aud.sql}`,
        params: { ...list.params, ...aud.params },
    };
}

/**
 * @param {{id: number, role: string}} user
 * @param {{ status?: string, groupId?: number|null, page: number, perPage: number }} f
 * Campaigns with an audience rule matching the viewer sort first and carry for_you = 1.
 */
export async function listCampaigns(user, { status, groupId, q = '', archived = false, page, perPage }) {
    const vis = await visibilityClause(user);
    // Archived fundraises leave the feed; managers find them under the Archived view.
    const where = [vis.sql, archived ? 'c.archived_at IS NOT NULL' : 'c.archived_at IS NULL'];
    const params = { ...vis.params };
    if (status) {
        where.push('c.status = :status');
        params.status = status;
    }
    if (groupId) {
        where.push('EXISTS (SELECT 1 FROM fundraise_groups fg WHERE fg.campaign_id = c.id AND fg.group_id = :groupId)');
        params.groupId = groupId;
    }
    if (q) {
        where.push('(c.title LIKE :q OR c.title_local LIKE :q)');
        params.q = `%${q}%`;
    }
    const whereSql = where.join(' AND ');
    // perPage/offset are clamped integers — inlined deliberately (design-system.md §9).
    const offset = (page - 1) * perPage;
    const [rows, count] = await Promise.all([
        query(
            `SELECT ${COLS}, ${TOTALS}, ${FOR_YOU} AS for_you
               FROM fundraise_campaigns c LEFT JOIN admin_groups g ON g.id = c.group_id
              WHERE ${whereSql}
              ORDER BY for_you DESC, FIELD(c.status, 'active', 'draft', 'closed'), c.start_date IS NULL, c.start_date DESC, c.id DESC
              LIMIT ${perPage} OFFSET ${offset}`,
            { ...params, viewerId: user.id },
        ),
        queryOne(`SELECT COUNT(*) AS n FROM fundraise_campaigns c WHERE ${whereSql}`, params),
    ]);
    const pics = await getMetaMany('fundraise_campaigns', rows.map((r) => r.id), ['avatar_kind', 'avatar_value', 'avatar_color']);
    return { rows: rows.map((r) => ({ ...r, avatar: pics[r.id] ?? {} })), total: count.n };
}

/** Every group a fundraise is shown in, home group first. */
export async function campaignGroups(campaignId) {
    return query(
        `SELECT g.id, g.name, g.name_local
           FROM fundraise_groups fg JOIN admin_groups g ON g.id = fg.group_id
           JOIN fundraise_campaigns c ON c.id = fg.campaign_id
          WHERE fg.campaign_id = :campaignId
          ORDER BY g.id = c.group_id DESC, g.name`,
        { campaignId },
    );
}

export async function getCampaign(id) {
    if (!Number.isInteger(id) || id <= 0) return null;
    const row = await queryOne(
        `SELECT ${COLS}, ${TOTALS}
           FROM fundraise_campaigns c LEFT JOIN admin_groups g ON g.id = c.group_id
          WHERE c.id = :id`,
        { id },
    );
    if (!row) return null;
    const [meta, groups] = await Promise.all([getMeta('fundraise_campaigns', id), campaignGroups(id)]);
    row.meta = meta;
    row.groups = groups;
    return row;
}

/** Public lookup: only a well-formed token of a campaign that is currently public. */
export async function getCampaignByToken(token) {
    if (!TOKEN_RE.test(String(token ?? ''))) return null;
    const row = await queryOne(
        `SELECT ${COLS}, ${TOTALS}
           FROM fundraise_campaigns c LEFT JOIN admin_groups g ON g.id = c.group_id
          WHERE c.public_token = :token AND c.is_public = 1 AND c.status <> 'draft' AND c.archived_at IS NULL`,
        { token },
    );
    if (!row) return null;
    row.meta = await getMeta('fundraise_campaigns', row.id);
    return row;
}

/** @param {{ limit?: number, offset?: number }} [opts] omit for all rows (statement / print). */
/** Contributions, newest first — with who keeps the money (kept_by → name) and whether it was handed to the treasurer. */
export async function listContributions(campaignId, { limit, offset = 0 } = {}) {
    const page = limit ? `LIMIT ${Number(limit)} OFFSET ${Number(offset)}` : '';
    const rows = await query(
        `SELECT f.id, f.user_id, f.donor_name, f.amount, f.paid_on, f.mode, f.reference, f.is_anonymous, f.created_at,
                f.kept_by, f.handed_over, k.full_name AS kept_by_name, k.full_name_local AS kept_by_name_local
           FROM fundraise_contributions f LEFT JOIN users_list k ON k.id = f.kept_by
          WHERE f.campaign_id = :campaignId AND f.deleted_at IS NULL
          ORDER BY f.paid_on DESC, f.id DESC ${page}`,
        { campaignId },
    );
    return rows.map((r) => ({ ...r, handed_over: Boolean(r.handed_over) }));
}

/**
 * People who may have paid for one of its expenses: its team, the members of its groups and (a
 * Mandal) its members — active people, by name. For the expense form's "Paid by".
 */
export async function fundraisePeople(campaignId) {
    return query(
        `SELECT id, full_name, full_name_local FROM users_list
          WHERE status = 'active' AND id IN (
                SELECT user_id FROM fundraise_members WHERE campaign_id = :campaignId
                UNION SELECT gm.user_id FROM admin_group_members gm JOIN fundraise_groups fg ON fg.group_id = gm.group_id WHERE fg.campaign_id = :campaignId
                UNION SELECT user_id FROM fundraise_subscribers WHERE campaign_id = :campaignId)
          ORDER BY full_name`,
        { campaignId },
    );
}

export async function listExpenses(campaignId, { limit, offset = 0 } = {}) {
    const page = limit ? `LIMIT ${Number(limit)} OFFSET ${Number(offset)}` : '';
    const rows = await query(
        `SELECT id, title, place, category, amount, spent_on, created_at
           FROM fundraise_expenses WHERE campaign_id = :campaignId AND deleted_at IS NULL
          ORDER BY spent_on DESC, id DESC ${page}`,
        { campaignId },
    );
    // Who paid out of pocket (meta paid_by = user id) and whether the treasurer has paid them back (meta repaid = '1').
    const meta = await getMetaMany('fundraise_expenses', rows.map((r) => r.id), ['notes', 'bill_ref', 'paid_by', 'repaid']);
    const payerIds = [...new Set(rows.map((r) => Number(meta[r.id]?.paid_by) || 0).filter(Boolean))];
    const payers = payerIds.length
        ? new Map(
              (
                  await (async () => {
                      const l = inList(payerIds, 'pb');
                      return query(`SELECT id, full_name, full_name_local FROM users_list WHERE id IN (${l.sql})`, l.params);
                  })()
              ).map((u) => [u.id, u]),
          )
        : new Map();
    return rows.map((r) => {
        const paidBy = Number(meta[r.id]?.paid_by) || null;
        const payer = paidBy ? payers.get(paidBy) : null;
        return {
            ...r,
            notes: meta[r.id]?.notes ?? '',
            bill_ref: meta[r.id]?.bill_ref ?? '',
            paid_by: paidBy,
            paid_by_name: payer?.full_name ?? null,
            paid_by_name_local: payer?.full_name_local ?? null,
            repaid: meta[r.id]?.repaid === '1',
        };
    });
}

// Two literal SQL variants rather than a bound flag: under ONLY_FULL_GROUP_BY the SELECT
// expression must match the GROUP BY expression textually, and a placeholder in both
// is not recognised as the same expression.
const CONTRIB_KEY = `COALESCE(CONCAT('u:', user_id), CONCAT('n:', donor_name))`;
const PUBLIC_KEY = `IF(is_anonymous = 1, 'anon', ${CONTRIB_KEY})`;

/**
 * One row per contributor: a member is keyed by user_id (so name edits do not split
 * them), a free-text donor by name. The public view folds anonymous gifts into one row.
 */
export async function contributorTotals(campaignId, { publicView = false } = {}) {
    const key = publicView ? PUBLIC_KEY : CONTRIB_KEY;
    return query(
        `SELECT ${key} AS k, MAX(donor_name) AS donor_name, MAX(user_id) AS user_id,
                MAX(is_anonymous) AS is_anonymous, SUM(CASE WHEN mode <> 'unpaid' THEN amount ELSE 0 END) AS total,
                SUM(CASE WHEN mode = 'unpaid' THEN amount ELSE 0 END) AS pending, COUNT(*) AS entries,
                SUM(CASE WHEN mode <> 'unpaid' THEN 1 ELSE 0 END) AS paid_entries,
                MAX(paid_on) AS last_paid
           FROM fundraise_contributions WHERE campaign_id = :campaignId AND deleted_at IS NULL
          GROUP BY ${key}
          ORDER BY total DESC, donor_name`,
        { campaignId },
    );
}

/**
 * "Hide name publicly" gifts for people who do not manage the fundraise: the name becomes the
 * anonymous label ("Anonymous" / "રામભરોસે") and the member link goes. Managers see real names.
 * @param {Array<{ is_anonymous?: number, donor_name?: string, user_id?: number|null }>} rows
 * @param {string} label t('fundraise.anonymousLabel')
 */
export function maskAnonymous(rows, label) {
    return rows.map((r) => (r.is_anonymous ? { ...r, donor_name: label, user_id: null } : r));
}

/** Active groups for pickers — memoised (forget('groups') on any group change). */
export async function listGroupsForSelect() {
    return memo('groups:active', () => query(`SELECT id, name, name_local FROM admin_groups WHERE status = 'active' ORDER BY name`));
}

export function progressPct(campaign) {
    const target = Number(campaign.target_amount || 0);
    if (!target) return null;
    return Math.min(100, Math.round((Number(campaign.collected) / target) * 100));
}

// ── locations / personal views ────────────────────────────────────────────────

/** Suggestions for the location field: members' villages ∪ locations already used. */
export async function knownLocations() {
    return memo('places:locations', loadLocations);
}

async function loadLocations() {
    const rows = await query(
        `SELECT village AS v FROM users_list WHERE village IS NOT NULL AND village <> ''
         UNION
         SELECT location AS v FROM fundraise_campaigns WHERE location IS NOT NULL AND location <> '' AND kind <> 'mandal'
         ORDER BY v`,
    );
    return rows.map((r) => r.v);
}


/** My donations across every fundraise, newest first, plus my overall total. */
export async function myContributions(userId, { page, perPage }) {
    const offset = (page - 1) * perPage;
    const [rows, sum] = await Promise.all([
        query(
            `SELECT fc.id, fc.amount, fc.paid_on, fc.mode, fc.is_anonymous,
                    c.id AS campaign_id, c.title, c.title_local, c.location, c.status
               FROM fundraise_contributions fc JOIN fundraise_campaigns c ON c.id = fc.campaign_id
              WHERE fc.user_id = :userId AND fc.deleted_at IS NULL
              ORDER BY fc.paid_on DESC, fc.id DESC
              LIMIT ${perPage} OFFSET ${offset}`,
            { userId },
        ),
        queryOne(
            `SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total, COUNT(DISTINCT campaign_id) AS campaigns
               FROM fundraise_contributions WHERE user_id = :userId AND deleted_at IS NULL AND mode <> 'unpaid'`,
            { userId },
        ),
    ]);
    return { rows, total: sum.n, amount: sum.total, campaigns: sum.campaigns };
}

/** Fundraises where the user holds a team role. */
/** Fundraises the user is on the team of, once each — `roles` = their roles there, `member_role` = the main one. */
export async function myTeamCampaigns(userId) {
    const rows = await query(
        `SELECT ${COLS}, ${TOTALS},
                (SELECT GROUP_CONCAT(x.member_role ORDER BY FIELD(x.member_role, ${ROLE_ORDER}))
                   FROM fundraise_members x WHERE x.campaign_id = c.id AND x.user_id = :userId) AS roles
           FROM fundraise_campaigns c
           LEFT JOIN admin_groups g ON g.id = c.group_id
          WHERE c.id IN (SELECT campaign_id FROM fundraise_members WHERE user_id = :userId)
          ORDER BY FIELD(c.status, 'active', 'draft', 'closed'), c.id DESC`,
        { userId },
    );
    return rows.map((r) => {
        const roles = String(r.roles ?? '').split(',').filter(Boolean);
        return { ...r, roles, member_role: roles[0] ?? null };
    });
}

// ── team ──────────────────────────────────────────────────────────────────────

/** The team, one row per person: `roles` = every role they hold (rank order), `member_role` = the main one. */
export async function listTeam(campaignId) {
    const rows = await query(
        `SELECT fm.user_id, GROUP_CONCAT(fm.member_role ORDER BY FIELD(fm.member_role, ${ROLE_ORDER})) AS roles, MIN(fm.added_at) AS added_at,
                u.full_name, u.full_name_local, u.phone, u.village
           FROM fundraise_members fm JOIN users_list u ON u.id = fm.user_id
          WHERE fm.campaign_id = :campaignId
          GROUP BY fm.user_id, u.full_name, u.full_name_local, u.phone, u.village
          ORDER BY MIN(FIELD(fm.member_role, ${ROLE_ORDER})), u.full_name`,
        { campaignId },
    );
    return rows.map((r) => {
        const roles = String(r.roles ?? '').split(',').filter(Boolean);
        return { ...r, roles, member_role: roles[0] ?? null };
    });
}

// ── meetings (events_list rows with campaign_id, event_type = 'meeting') ─────

/** All meetings with agenda and minutes count; split into upcoming / past by `today`. */
export async function listMeetings(campaignId, today) {
    const rows = await query(
        `SELECT e.id, e.title, e.title_local, e.start_date, e.start_time, e.location,
                (SELECT COUNT(*) FROM fundraise_updates u WHERE u.event_id = e.id AND u.update_type = 'minutes') AS minutes_count
           FROM events_list e
          WHERE e.campaign_id = :campaignId AND e.event_type = 'meeting'
          ORDER BY e.start_date, e.start_time`,
        { campaignId },
    );
    const meta = await getMetaMany('events_list', rows.map((r) => r.id), ['description']);
    const all = rows.map((r) => ({ ...r, agenda: meta[r.id]?.description ?? '' }));
    return {
        upcoming: all.filter((m) => m.start_date >= today),
        past: all.filter((m) => m.start_date < today).reverse(),
    };
}

export async function nextMeeting(campaignId, today) {
    return queryOne(
        `SELECT id, start_date, start_time, location FROM events_list
          WHERE campaign_id = :campaignId AND event_type = 'meeting' AND start_date >= :today
          ORDER BY start_date, start_time LIMIT 1`,
        { campaignId, today },
    );
}

// ── updates & minutes ─────────────────────────────────────────────────────────

/** Timeline, newest first. `eventId` narrows to one meeting's minutes. */
export async function listUpdates(campaignId, { eventId = null } = {}) {
    const rows = await query(
        `SELECT fu.id, fu.update_type, fu.event_id, fu.created_by, fu.created_at,
                u.full_name AS author, u.full_name_local AS author_local,
                e.start_date AS meeting_date
           FROM fundraise_updates fu
           LEFT JOIN users_list u ON u.id = fu.created_by
           LEFT JOIN events_list e ON e.id = fu.event_id
          WHERE fu.campaign_id = :campaignId ${eventId ? 'AND fu.event_id = :eventId' : ''}
          ORDER BY fu.created_at DESC, fu.id DESC
          LIMIT 200`,
        eventId ? { campaignId, eventId } : { campaignId },
    );
    const meta = await getMetaMany('fundraise_updates', rows.map((r) => r.id), ['body']);
    return rows.map((r) => ({ ...r, body: meta[r.id]?.body ?? '' }));
}

// ── audience ("who should see this") ────────────────────────────────────

/** Rules of one campaign, with caste / sub-caste names resolved for display. */
export async function getAudience(campaignId) {
    return query(
        `SELECT a.kind, a.value, ac.name AS caste_name, ac.name_local AS caste_name_local
           FROM fundraise_audience a
           LEFT JOIN admin_castes ac ON a.kind IN ('caste', 'subcaste') AND ac.id = a.value
          WHERE a.campaign_id = :campaignId
          ORDER BY FIELD(a.kind, 'surname', 'caste', 'subcaste', 'city', 'village'), a.value`,
        { campaignId },
    );
}

/**
 * Suggestions for the audience editor: surnames with member counts (for the multi-select,
 * where the count helps choose), and distinct current cities / native villages.
 */
export async function audienceSuggestions() {
    return memo('places:audience', loadAudienceSuggestions);
}

async function loadAudienceSuggestions() {
    const [surnames, cities, villages] = await Promise.all([
        query(
            `SELECT COALESCE(surname, SUBSTRING_INDEX(TRIM(full_name), ' ', -1)) AS v, COUNT(*) AS n FROM users_list
              WHERE (surname IS NOT NULL OR full_name LIKE '% %') AND status = 'active'
              GROUP BY v ORDER BY v LIMIT 1000`,
        ),
        query(`SELECT DISTINCT city AS v FROM users_list WHERE city IS NOT NULL AND city <> '' ORDER BY v LIMIT 500`),
        query(`SELECT DISTINCT village AS v FROM users_list WHERE village IS NOT NULL AND village <> '' ORDER BY v LIMIT 500`),
    ]);
    const pick = (rows) => rows.map((r) => r.v).filter(Boolean);
    return {
        surname: surnames.filter((r) => r.v).map((r) => ({ value: r.v, label: r.v, count: Number(r.n) })),
        city: pick(cities),
        village: pick(villages),
    };
}

// ── ledger history ────────────────────────────────────────────────────────────

/** MariaDB returns JSON columns as strings, MySQL as objects — accept both, never throw. */
function parseSnapshot(raw) {
    if (raw == null) return null;
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** How many history rows a fundraise has (all of them, not just the latest 50 shown). */
export async function historyCount(campaignId) {
    return (await queryOne('SELECT COUNT(*) AS n FROM fundraise_history WHERE campaign_id = :campaignId', { campaignId }))?.n ?? 0;
}

/**
 * History rows, newest first, with the actor's name.
 * @param {number} campaignId
 * @param {{ entity?: 'contribution'|'expense', entityId?: number, limit?: number }} [opts]
 */
export async function listHistory(campaignId, { entity, entityId, limit = 50 } = {}) {
    const one = entity && entityId;
    const rows = await query(
        `SELECT h.id, h.entity, h.entity_id, h.action, h.actor_id, h.snapshot, h.created_at,
                u.full_name AS actor, u.full_name_local AS actor_local
           FROM fundraise_history h
           LEFT JOIN users_list u ON u.id = h.actor_id
          WHERE h.campaign_id = :campaignId ${one ? 'AND h.entity = :entity AND h.entity_id = :entityId' : ''}
          ORDER BY h.created_at DESC, h.id DESC
          LIMIT ${Math.min(200, Math.max(1, Number(limit) || 50))}`,
        one ? { campaignId, entity, entityId } : { campaignId },
    );
    return rows.map((r) => ({ ...r, snapshot: parseSnapshot(r.snapshot) }));
}
